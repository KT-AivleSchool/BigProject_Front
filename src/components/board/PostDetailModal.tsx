"use client";

import React, { useEffect, useState } from "react";
import { fetchPostDetail, deletePost, getPostDownloadUrl, PostResponse } from "@/lib/omnisite/posts";
import { getAuthHeader } from "@/lib/omnisite/auth";

interface PostDetailModalProps {
  postId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function PostDetailModal({ postId, isOpen, onClose, onDeleted }: PostDetailModalProps) {
  const [post, setPost] = useState<PostResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && postId) {
      loadDetail(postId);
    } else {
      setPost(null);
      setError(null);
    }
  }, [isOpen, postId]);

  const loadDetail = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPostDetail(id);
      setPost(data);
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") {
        setError("로그인이 필요합니다.");
      } else {
        setError(err.message || "상세 정보를 불러올 수 없습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!postId || !window.confirm("정말로 이 게시글을 삭제하시겠습니까?")) return;

    setDeleting(true);
    try {
      await deletePost(postId);
      onDeleted();
      onClose();
    } catch (err: any) {
      alert(err.message || "삭제 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!postId) return;
    const url = getPostDownloadUrl(postId);
    const authHeaders = getAuthHeader();

    try {
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) {
        alert("파일 다운로드에 실패했습니다.");
        return;
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = post?.original_filename || `download_${postId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      alert("다운로드 중 오류가 발생했습니다.");
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

        <div className="flex justify-between items-center pt-4 border-t mt-4 shrink-0">
          <div>
            {post && post.is_owner && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <span>🗑️</span> {deleting ? "삭제 중..." : "게시글 삭제"}
              </button>
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
      </div>
    </div>
  );
}
