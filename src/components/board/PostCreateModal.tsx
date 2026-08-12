"use client";

import React, { useState } from "react";
import { createPost } from "@/lib/omnisite/posts";
import { describeFailure, isUnauthorized } from "@/lib/omnisite/client";

interface PostCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PostCreateModal({ isOpen, onClose, onSuccess }: PostCreateModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 20 * 1024 * 1024) {
        setError("첨부파일 크기는 20MB를 초과할 수 없습니다.");
        return;
      }
      setError(null);
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createPost(title.trim(), content.trim(), file);
      setTitle("");
      setContent("");
      setFile(null);
      onSuccess();
      onClose();
    } catch (err) {
      // 🔴 `err.message === "UNAUTHORIZED"` 라는 **문자열 신호**를 없앴다 — 서버가
      //    본문에 같은 낱말을 담으면 구분이 안 되고, 403·404·500 은 아예 갈 자리가 없다.
      //    판정은 상태코드로 한다(`client.ts:isUnauthorized`).
      setError(isUnauthorized(err) ? "로그인이 필요합니다." : describeFailure(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>✏️</span> 게시글 작성
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-200">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="안건 또는 공유할 내용을 상세히 작성해 주세요."
              rows={6}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              첨부파일 <span className="text-gray-400 font-normal">(선택사항, 1개 제한, 최대 20MB)</span>
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                📎 파일 선택
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {file ? (
                <div className="flex items-center gap-2 text-xs text-gray-800 bg-gray-100 px-2.5 py-1.5 rounded border">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <span className="text-gray-400">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-red-500 hover:text-red-700 font-bold ml-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-400">선택된 파일 없음</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "작성 중..." : "작성 완료"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
