"use client";

import React, { useEffect, useState } from "react";
import { fetchPostDetail, deletePost, fetchPostFile, PostResponse } from "@/lib/omnisite/posts";
import { describeFailure, isUnauthorized } from "@/lib/omnisite/client";
import { PostEditModal } from "@/components/board/PostEditModal";

interface PostDetailModalProps {
  postId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function PostDetailModal({ postId, isOpen, onClose, onDeleted }: PostDetailModalProps) {
  const [post, setPost] = useState<PostResponse | null>(null);
  /**
   * 🔴 초기값이 `true` 다. 「열리면 곧바로 조회 중」이 이 모달의 첫 상태라
   *    effect 가 `setLoading(true)` 를 **동기로** 부를 이유가 없어진다
   *    (`react-hooks/set-state-in-effect`). 닫힐 때 정리 함수가 다시 `true` 로
   *    되돌리므로 다음에 열 때도 같은 자리에서 시작한다.
   */
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * 🔴 조회 실패(`error`)와 갈라 둔다. 삭제·다운로드 실패를 `error` 에 담으면
   *    본문 자리가 통째로 에러 상자로 바뀌어 **읽고 있던 글이 사라진다** —
   *    실패한 건 그 동작 하나지 조회가 아니다.
   */
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * 🔴 `useEffect` 보다 **먼저** 선언한다(`react-hooks/immutability`).
   * 🔴 `setLoading(true)` 를 여기 두지 않는다 — 그러면 effect 가 이 함수를 부르는
   *    순간이 「동기 setState」가 된다. 켜는 쪽은 **부르는 사람**이 맡는다
   *    (열 때는 초기값·정리 함수가, 수정 후 재조회는 `onSuccess` 가).
   *    ⚠ **이 옮김으로 lint 가 조용해지진 않는다**(2026-08-14 실측). 이 함수는
   *      첫 줄이 `await` 라 동기 `setState` 가 **한 개도 없는데도**
   *      `react-hooks/set-state-in-effect` 가 아래 호출부를 잡는다 — 규칙은
   *      `await` 를 경계로 안 보고 「setState 를 부르는 함수를 effect 가 직접
   *      부르는가」만 본다. 그래도 이 옮김은 **유지한다**: 규칙 때문이 아니라
   *      실제로 렌더 한 번을 덜기 때문이다(초기값이 이미 `true` 다).
   */
  const loadDetail = async (id: number) => {
    try {
      const data = await fetchPostDetail(id);
      setPost(data);
      setError(null);
    } catch (err) {
      setError(isUnauthorized(err) ? "로그인이 필요합니다." : describeFailure(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !postId) {
      // 🔴 닫힐 때의 초기화는 effect 본문에서 `setState` 를 직접 부르지 않는다
      //    (`react-hooks/set-state-in-effect`). 정리 함수로 옮기면 「열려 있는
      //    동안의 상태」와 「닫힌 뒤의 상태」가 한 자리에서 안 섞인다.
      return;
    }
    // 🔴 누른다(고친 게 아니다). 위 주석대로 이 함수엔 동기 `setState` 가 없는데도
    //    규칙이 **호출 자체**를 잡는다. 피하려면 조회를 마이크로태스크로 미루는
    //    수밖에 없는데 그건 규칙만 조용해지고 동작은 그대로다 — 속이느니 남긴다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDetail(postId);
    return () => {
      setPost(null);
      setError(null);
      setActionError(null);
      setLoading(true);
    };
  }, [isOpen, postId]);

  const handleDelete = async () => {
    if (!postId || !window.confirm("정말로 이 게시글을 삭제하시겠습니까?")) return;

    setActionError(null);
    setDeleting(true);
    try {
      await deletePost(postId);
      onDeleted();
      onClose();
    } catch (err) {
      setActionError(describeFailure(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!postId) return;
    setActionError(null);
    try {
      // Blob 으로 받는다 — `<a href>` 로 열면 `Authorization` 이 안 붙는데
      // 백엔드 다운로드는 토큰이 필수다(`posts.py:348`).
      const blob = await fetchPostFile(postId);
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = post?.original_filename || `download_${postId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // 🔴 "다운로드 중 오류가 발생했습니다" 로 뭉개지 않는다 — 401(만료) ·
      //    404(파일이 지워짐) · 서버 미기동이 전부 같은 문장이 된다(원칙 4).
      setActionError(describeFailure(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b pb-4 mb-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📌</span> 게시글 상세 보기
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-gray-500">
            데이터를 불러오는 중입니다...
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-50 text-xs font-semibold text-red-600 border border-red-200">
            ⚠️ {error}
          </div>
        ) : post ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="border-b pb-3">
              <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                {post.has_file && <span title="첨부파일 포함">📎</span>}
                {post.title}
              </h3>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  작성자: <strong className="text-gray-700">{post.author_name}</strong> ({post.author_email})
                </span>
                <span>{new Date(post.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="py-2 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed min-h-[120px]">
              {post.content}
            </div>

            {post.has_file && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mt-4">
                <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span>📎</span> 첨부파일
                </div>
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-base">📄</span>
                    <span className="text-xs font-semibold text-gray-800 truncate max-w-[300px]">
                      {post.original_filename}
                    </span>
                    {post.file_size && (
                      <span className="text-[11px] text-gray-400">
                        ({(post.file_size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <span>⬇️</span> 다운로드
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/*
          🔴 삭제·다운로드 실패를 **화면에 띄운다.** 원본은 `console.error` 로만 남기고
             화면에는 아무 말도 안 했다 — 사용자에게는 「눌렀는데 아무 일도 안 일어남」이다.
             본문(`error`) 자리가 아니라 여기다: 읽고 있던 글은 그대로 두고
             실패한 동작만 말한다.
        */}
        {actionError && (
          <div className="mt-4 shrink-0 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
            ⚠️ {actionError}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t mt-4 shrink-0">
          <div className="flex items-center gap-2">
            {post && post.is_owner && (
              <>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <span>✏️</span> 게시글 수정
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <span>🗑️</span> {deleting ? "삭제 중..." : "게시글 삭제"}
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>

        {/* 수정 모달 */}
        <PostEditModal
          postId={postId}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            // 🔴 `setLoading(true)` 는 **부르는 쪽**이 켠다 — `loadDetail` 이 켜면
            //    effect 가 그걸 부르는 순간이 「동기 setState」가 된다(위 주석).
            //    여기서 안 켜면 수정 직후 **옛 본문**이 그대로 보인 채 갱신된다.
            if (postId) {
              setLoading(true);
              loadDetail(postId);
            }
            onDeleted();
          }}
        />
      </div>
    </div>
  );
}

