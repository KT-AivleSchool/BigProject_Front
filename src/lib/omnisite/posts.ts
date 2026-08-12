import { getAuthHeader } from "./auth";

export interface PostListItem {
  id: number;
  user_id: number;
  author_name: string;
  title: string;
  has_file: boolean;
  created_at: string;
}

export interface PostListResponse {
  total: number;
  page: number;
  limit: number;
  posts: PostListItem[];
}

export interface PostResponse {
  id: number;
  user_id: number;
  author_name: string;
  author_email: string;
  title: string;
  content: string;
  has_file: boolean;
  original_filename?: string;
  file_size?: number;
  created_at: string;
  is_owner: boolean;

}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

/**
 * 게시글 목록 조회
 */
export async function fetchPosts(
  page: number = 1,
  limit: number = 10,
  sortBy: string = "created_at",
  order: string = "desc",
  searchType: string = "title_content",
  searchQuery: string = ""
): Promise<PostListResponse> {
  const headers = getAuthHeader();
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort_by: sortBy,
    order: order,
    search_type: searchType,
  });

  if (searchQuery && searchQuery.trim()) {
    params.append("search_query", searchQuery.trim());
  }

  const res = await fetch(`${API_BASE}/posts?${params.toString()}`, {
    headers: {
      ...headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "게시글 목록을 불러오지 못했습니다.");
  }

  return res.json();
}


/**
 * 게시글 상세 조회
 */
export async function fetchPostDetail(postId: number): Promise<PostResponse> {
  const headers = getAuthHeader();
  const res = await fetch(`${API_BASE}/posts/${postId}`, {
    headers: {
      ...headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    throw new Error("게시글 상세 정보를 불러오는데 실패했습니다.");
  }

  return res.json();
}

/**
 * 게시글 작성 (Form Data: title, content, optional file)
 */
export async function createPost(title: string, content: string, file?: File | null): Promise<PostResponse> {
  const headers = getAuthHeader();
  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  if (file) {
    formData.append("file", file);
  }

  const res = await fetch(`${API_BASE}/posts`, {
    method: "POST",
    headers: {
      ...headers, // Content-Type은 FormData 전송 시 브라우저가 자동 설정함
    },
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    throw new Error(errorData.detail || "게시글 작성에 실패했습니다.");
  }

  return res.json();
}

/**
 * 게시글 삭제
 */
export async function deletePost(postId: number): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API_BASE}/posts/${postId}`, {
    method: "DELETE",
    headers: {
      ...headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    if (res.status === 403) {
      throw new Error("자신이 작성한 게시글만 삭제할 수 있습니다.");
    }
    throw new Error(errorData.detail || "게시글 삭제에 실패했습니다.");
  }
}

/**
 * 첨부파일 다운로드 URL 링크 반환
 */
export function getPostDownloadUrl(postId: number): string {
  return `${API_BASE}/posts/${postId}/download`;
}
