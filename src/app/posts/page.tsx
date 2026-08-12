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

  // 컬럼 정렬 상태 (기본: created_at desc)
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // arca.live 스타일 특정 페이지 직접 이동 상태
  const [jumpModalOpen, setJumpModalOpen] = useState(false);
  const [jumpInput, setJumpInput] = useState("");

  useEffect(() => {
    loadPosts(page, sortBy, order);
  }, [page, sortBy, order]);

  const loadPosts = async (currentPage: number, currentSortBy = sortBy, currentOrder = order) => {
    setLoading(true);
    setError(null);

    const user = getAuthUser();
    if (!user) {
      setError("UNAUTHORIZED");
      setLoading(false);
      return;
    }

    try {
      const data = await fetchPosts(currentPage, limit, currentSortBy, currentOrder);
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

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setOrder("asc");
    }
    setPage(1); // 정렬 변경 시 1페이지로 이동
  };

  const renderSortButton = (colKey: string, label: string) => {
    const isSelected = sortBy === colKey;
    return (
      <button
        onClick={() => handleSort(colKey)}
        className="inline-flex items-center gap-1 hover:text-primary transition-colors focus:outline-none group select-none"
        title={`${label} 기준 ${isSelected && order === "asc" ? "내림차순" : "오름차순"} 정렬`}
      >
        <span>{label}</span>
        <span className={`text-[10px] ${isSelected ? "text-primary font-bold" : "text-gray-400 group-hover:text-gray-600"}`}>
          {isSelected ? (order === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
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
                  <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold select-none">
                    <th className="py-3.5 px-4 w-20 text-center">
                      {renderSortButton("id", "번호")}
                    </th>
                    <th className="py-3.5 px-4">
                      {renderSortButton("title", "제목")}
                    </th>
                    <th className="py-3.5 px-4 w-36">
                      {renderSortButton("author_name", "작성자")}
                    </th>
                    <th className="py-3.5 px-4 w-36 text-center">
                      {renderSortButton("created_at", "작성일시")}
                    </th>
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

            {/* arca.live 스타일 페이지네이션 컨트롤 */}
            {totalPages > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2 border-t border-gray-200/80">
                {/* 왼쪽: 전체 정보 */}
                <div className="text-xs text-gray-500 font-medium">
                  총 <span className="font-bold text-gray-900">{total}</span>개의 안건 (페이지{" "}
                  <span className="font-bold text-primary">{page}</span> / {totalPages})
                </div>

                {/* 중앙: 10개 단위 arca.live 스타일 번호 목록 */}
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  {/* 맨 처음 페이지 (<<) */}
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    title="첫 페이지로 이동"
                    className="h-8 w-8 rounded-lg border bg-white text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white transition-colors flex items-center justify-center shrink-0"
                  >
                    «
                  </button>

                  {/* 이전 10페이지 블록 (보이는 첫 페이지 - 10) */}
                  <button
                    disabled={Math.floor((page - 1) / 10) === 0}
                    onClick={() => setPage(Math.max(1, (Math.floor((page - 1) / 10) - 1) * 10 + 1))}
                    title="이전 10페이지"
                    className="h-8 w-8 rounded-lg border bg-white text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white transition-colors flex items-center justify-center shrink-0"
                  >
                    ‹
                  </button>

                  {/* n*10+1 ~ (n+1)*10 페이지 버튼 목록 */}
                  {Array.from({ length: Math.min(10, totalPages - Math.floor((page - 1) / 10) * 10) }, (_, i) => {
                    const pageNum = Math.floor((page - 1) / 10) * 10 + 1 + i;
                    const isActive = pageNum === page;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                          isActive
                            ? "bg-primary text-white shadow-sm scale-105"
                            : "border bg-white text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {/* 다음 10페이지 블록 */}
                  <button
                    disabled={(Math.floor((page - 1) / 10) + 1) * 10 >= totalPages}
                    onClick={() =>
                      setPage(Math.min(totalPages, (Math.floor((page - 1) / 10) + 1) * 10 + 1))
                    }
                    title="다음 10페이지"
                    className="h-8 w-8 rounded-lg border bg-white text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white transition-colors flex items-center justify-center shrink-0"
                  >
                    ›
                  </button>

                  {/* 마지막 페이지 (>>) */}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                    title="마지막 페이지로 이동"
                    className="h-8 w-8 rounded-lg border bg-white text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-white transition-colors flex items-center justify-center shrink-0"
                  >
                    »
                  </button>
                </div>

                {/* 오른쪽: 페이지 이동 버튼 (직접 번호 입력 이동) */}
                <button
                  onClick={() => setJumpModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all shrink-0"
                >
                  <span>🎯</span> 페이지 이동
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 페이지 직접 이동 모달 (Jump to Page) */}
      {jumpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span>🎯</span> 특정 페이지로 이동
              </h3>
              <button
                onClick={() => setJumpModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                let num = parseInt(jumpInput, 10);
                if (isNaN(num) || num < 1) num = 1;
                if (num > totalPages) num = totalPages;
                setPage(num);
                setJumpModalOpen(false);
                setJumpInput("");
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  이동할 페이지 번호 (1 ~ {totalPages})
                </label>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  placeholder={`예: ${Math.min(page + 3, totalPages)}`}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  * 최대 페이지({totalPages})를 초과하는 값 입력 시 {totalPages}페이지로 자동 이동합니다.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setJumpModalOpen(false)}
                  className="rounded-xl border bg-white px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow hover:bg-primary/90 transition-colors"
                >
                  이동하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


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

