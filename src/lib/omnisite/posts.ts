/**
 * 게시판 API (백엔드 `app/api/v1/posts.py`).
 *
 * 🔴 **절대 URL 을 쓰지 않는다.** PR #62 원본은
 *    `const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1"`
 *    이었는데, 그 키는 이 저장소 어느 env 파일에도 없어서 폴백이 **항상** 걸렸다.
 *    이유 셋은 `next.config.ts:126-134` 에 이미 적혀 있다(번들 유출 · 개발용 CORS
 *    의존 · `localhost`→IPv6). 같은 자리를 PR #57 에서 한 번 접었다.
 *    브라우저는 상대 경로만 부르고 오리진은 rewrite 프록시가 안다.
 *
 * 🔴 **`fetch` 를 직접 부르지 않는다.** `client.ts` 를 거쳐야 얻는 것 셋 —
 *    ⓐ `NetworkError`(서버가 안 떴을 때. 원본은 `err.message.includes("Failed to fetch")`
 *      라는 **문자열 대조**로 흉내내고 있었다. 브라우저마다 문구가 다르다)
 *    ⓑ 객체형 `detail` 풀기(`readDetail`). 안 풀면 화면에 `[object Object]` 가 뜬다
 *    ⓒ `Bearer` 자동 부착. `getAuthHeader()` 를 손으로 붙이면 붙이는 자리가 둘이 된다
 *
 * 🔴 실패는 **`ApiError` 그대로** 던진다. 원본은 401 을 `new Error("UNAUTHORIZED")`
 *    라는 **문자열 신호**로 바꿨는데, 그러면 상태코드·서버 사유·URL 이 전부 사라지고
 *    부르는 쪽은 `err.message === "UNAUTHORIZED"` 로 되받는다. 403·404·500 은
 *    구분할 방법이 없어진다. 판정은 `e instanceof ApiError && e.status === 401` 이다.
 */
import { deleteJson, getBlob, getJson, postForm, putForm } from "./client";

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

const API_BASE = "/api/v1";

/**
 * 게시글 목록 조회.
 *
 * ⚠ 경로에 슬래시를 안 붙인다 — 백엔드는 `""` 와 `"/"` 를 둘 다 등록하지만
 *   (`posts.py:143-144`) 프런트에서 두 모양을 섞으면 rewrite 매칭을 두 번 확인해야 한다.
 */
export async function fetchPosts(
  page: number = 1,
  limit: number = 10,
  sortBy: string = "created_at",
  order: string = "desc",
  searchType: string = "title_content",
  searchQuery: string = "",
  mine: boolean = false,
): Promise<PostListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort_by: sortBy,
    order: order,
    search_type: searchType,
  });

  if (searchQuery && searchQuery.trim()) {
    params.append("search_query", searchQuery.trim());
  }

  if (mine) {
    params.append("mine", "true");
  }

  return getJson<PostListResponse>(`${API_BASE}/posts?${params.toString()}`);
}

/** 게시글 상세 조회 */
export async function fetchPostDetail(postId: number): Promise<PostResponse> {
  return getJson<PostResponse>(`${API_BASE}/posts/${postId}`);
}

/** 게시글 작성 (multipart: title, content, optional file) */
export async function createPost(
  title: string,
  content: string,
  file?: File | null,
): Promise<PostResponse> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  if (file) {
    formData.append("file", file);
  }
  return postForm<PostResponse>(`${API_BASE}/posts`, formData);
}

/** 게시글 수정 (multipart: title, content, optional file, remove_file) */
export async function updatePost(
  postId: number,
  title: string,
  content: string,
  file?: File | null,
  removeFile: boolean = false,
): Promise<PostResponse> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  formData.append("remove_file", removeFile ? "true" : "false");
  if (file) {
    formData.append("file", file);
  }
  return putForm<PostResponse>(`${API_BASE}/posts/${postId}`, formData);
}

/**
 * 게시글 삭제.
 *
 * ⚠ 백엔드는 204 가 아니라 **200 + 본문**을 준다
 *   (`posts.py:288·341` `{"message": ..., "post_id": ...}`) — 그래서 `deleteJson` 이다.
 */
export async function deletePost(postId: number): Promise<void> {
  await deleteJson<{ message: string; post_id: number }>(`${API_BASE}/posts/${postId}`);
}

/**
 * 첨부파일 내려받기.
 *
 * 🔴 URL 만 돌려주던 `getPostDownloadUrl` 을 없앴다 — 그 URL 을 `<a href>` 에 넣으면
 *    `Authorization` 이 안 붙는데 백엔드는 토큰 필수다(`posts.py:348`). 실제로
 *    부르는 쪽은 URL 이 아니라 **Blob** 이 필요했다.
 */
export async function fetchPostFile(postId: number): Promise<Blob> {
  return getBlob(`${API_BASE}/posts/${postId}/download`);
}
