"use client";

import React, { useEffect, useState } from "react";
import { AuthModal } from "@/components/shell/AuthModal";
import { PostCreateModal } from "@/components/board/PostCreateModal";
import { PostDetailModal } from "@/components/board/PostDetailModal";
import { fetchPosts, PostListItem } from "@/lib/omnisite/posts";
import { getAuthUser } from "@/lib/omnisite/auth";


export default function PostsPage() {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 모달 제어 상태
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    loadPosts(page);
  }, [page]);

  const loadPosts = async (currentPage: number) => {
    setLoading(true);
    setError(null);

    const user = getAuthUser();
    if (!user) {
      setError("UNAUTHORIZED");
      setLoading(false);
      return;
    }

    try {
      const data = await fetchPosts(currentPage, limit);
      setPosts(data.posts);
      setTotal(data.total);
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") {
        setError("UNAUTHORIZED");
      } else {
        setError(err.message || "게시글을 불러올 수 없습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = () => {
    const user = getAuthUser();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setCreateModalOpen(true);
  };

  const handlePostClick = (postId: number) => {
    setSelectedPostId(postId);
    setDetailModalOpen(true);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="w-full flex-1 bg-slate-50 font-sans text-ink">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-8">
        {/* 상단 타이틀 영역 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <span>📋</span> 공공 안건 및 소통 게시판
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              입지 선정 및 스마트시티 안건 관련 자유로운 정보 공유 및 수렴 공간입니다.
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition-all shrink-0 self-start md:self-auto"
          >
            <span>✏️</span> 새 안건 작성
          </button>
        </div>

        {/* 미인증 상태 처리 */}
        {error === "UNAUTHORIZED" ? (
          <div className="py-16 text-center rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">로그인이 필요한 서비스입니다</h2>
            <p className="text-xs text-gray-500 mb-6">
              게시글 목록 및 작성 기능은 인증된 구정 공무원 및 관리자만 이용할 수 있습니다.
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/90 transition-colors"
            >
              로그인 / 회원가입하기
            </button>
          </div>
        ) : loading ? (
          <div className="py-20 text-center text-xs text-gray-500">
            게시글 목록을 불러오는 중입니다...
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 text-xs font-semibold text-red-600 border border-red-200">
            ⚠️ {error}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 게시글 목록 테이블 */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold">
                    <th className="py-3.5 px-4 w-16 text-center">번호</th>
                    <th className="py-3.5 px-4">제목</th>
                    <th className="py-3.5 px-4 w-32">작성자</th>
                    <th className="py-3.5 px-4 w-36 text-center">작성일시</th>
                    <th className="py-3.5 px-4 w-24 text-center">상세보기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">
                        등록된 게시글이 없습니다. 첫 안건을 등록해 보세요!
                      </td>
                    </tr>
                  ) : (
                    posts.map((post) => (
                      <tr
                        key={post.id}
                        onClick={() => handlePostClick(post.id)}
                        className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 text-center font-medium text-gray-500">
                          {post.id}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            {post.has_file && (
                              <span className="text-xs" title="첨부파일 있음">
                                📎
                              </span>
                            )}
                            <span className="hover:text-primary transition-colors">
                              {post.title}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 font-medium">
                          {post.author_name}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-400">
                          {new Date(post.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-200">
                            보기
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이징 컨트롤 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  이전
                </button>
                <span className="text-xs font-semibold text-gray-600 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 작성 모달 */}
      <PostCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => loadPosts(1)}
      />

      {/* 상세 및 삭제 모달 */}
      <PostDetailModal
        postId={selectedPostId}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onDeleted={() => loadPosts(page)}
      />

      {/* 로그인 모달 */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        onSuccess={() => {
          setAuthModalOpen(false);
          loadPosts(1);
        }}
      />
    </div>
  );
}

