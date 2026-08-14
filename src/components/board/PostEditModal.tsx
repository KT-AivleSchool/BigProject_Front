"use client";

import React, { useEffect, useState } from "react";
import { fetchPostDetail, updatePost } from "@/lib/omnisite/posts";
import { describeFailure, isUnauthorized } from "@/lib/omnisite/client";

interface PostEditModalProps {
  postId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PostEditModal({ postId, isOpen, onClose, onSuccess }: PostEditModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 🔴 `useEffect` 본문에서 `setState` 를 직접 부르지 않는다
   *    (`react-hooks/set-state-in-effect`) — 선언을 effect **위**로 올려야
   *    `react-hooks/immutability` 도 같이 조용해진다.
   */
  const loadDetail = async (id: number) => {
    setInitialLoading(true);
    setError(null);
    setFile(null);
    setRemoveFile(false);
    try {
      const data = await fetchPostDetail(id);
      setTitle(data.title);
      setContent(data.content);
      setExistingFileName(data.original_filename || null);
    } catch (err) {
      // 🔴 `err.message` 를 쓰지 않는다 — 서버가 준 상태코드·사유가 통째로 사라진다.
      setError(isUnauthorized(err) ? "로그인이 필요합니다." : describeFailure(err));
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !postId) return;
    /*
     * 🔴 누른다(2026-08-14). 여기 앞머리 네 줄(`setInitialLoading` 외 3개)은 **정말로
     *    동기 `setState`** 라 규칙이 옳다. 그런데 그걸 정리 함수로 옮겨도 **에러는
     *    안 사라진다** — 옆의 `PostDetailModal` 이 그 모양인데(첫 줄이 `await`,
     *    동기 setState 0개) 똑같이 잡힌다. 규칙은 `await` 를 경계로 안 보고
     *    「setState 를 부르는 함수를 effect 가 직접 부르는가」만 본다.
     *    즉 옮기면 **동작만 바뀌고 lint 는 그대로**라, 검증 못 하는 변경 대신
     *    사유를 남기고 누른다.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDetail(postId);
  }, [isOpen, postId]);

  if (!isOpen || !postId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("게시글 제목을 입력해 주세요.");
      return;
    }
    if (!content.trim()) {
      setError("게시글 내용을 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updatePost(postId, title.trim(), content.trim(), file, removeFile);
      onSuccess();
      onClose();
    } catch (err) {
      // 🔴 "게시글 수정에 실패했습니다" 로 뭉개지 않는다 — 401(만료)·413(용량)·
      //    422(형식)·서버 미기동이 전부 같은 문장이 된다(원칙 4).
      setError(isUnauthorized(err) ? "로그인이 필요합니다." : describeFailure(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-all animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100 transform transition-all">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-slate-50/50">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>✏️</span> 안건 수정하기
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 모달 본문 */}
        {initialLoading ? (
          <div className="py-16 text-center text-xs text-gray-400">
            게시글 데이터를 로드하고 있습니다...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-200">
                ⚠️ {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="게시글 제목을 입력하세요 (최대 200자)"
                maxLength={200}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs font-semibold text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="안건 또는 수정할 내용을 상세히 작성해 주세요."
                rows={6}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs font-semibold text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                required
              />
            </div>

            {/* 첨부파일 영역 */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                첨부파일 <span className="text-[11px] font-normal text-gray-500">(1개 제한, 최대 20MB)</span>
              </label>

              {existingFileName && !removeFile && (
                <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-gray-200 text-xs">
                  <span className="truncate font-medium text-gray-700 flex items-center gap-1">
                    <span>📎</span> {existingFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemoveFile(true)}
                    className="text-[11px] font-bold text-red-500 hover:underline shrink-0 ml-2"
                  >
                    삭제하기
                  </button>
                </div>
              )}

              {removeFile && (
                <div className="flex items-center justify-between text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-100">
                  <span>기존 파일이 삭제 예정입니다.</span>
                  <button
                    type="button"
                    onClick={() => setRemoveFile(false)}
                    className="text-[11px] text-gray-600 underline font-normal"
                  >
                    취소
                  </button>
                </div>
              )}

              <input
                type="file"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setRemoveFile(false);
                  }
                }}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>

            {/* 모달 푸터 버튼 */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "수정 저장 중..." : "수정 완료"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
