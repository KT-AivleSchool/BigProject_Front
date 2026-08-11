/**
 * HTTP 클라이언트 — **조용히 실패하지 않는다.**
 * ============================================
 * 절대원칙 1. 애매하면 던진다. 어디서 무엇이 왜 실패했는지를 예외에 다 싣는다.
 *
 * 하지 않는 것 (의도적으로)
 *   · 재시도 — 파이프라인 실행은 멱등이 아니다. 조용한 중복 실행이 더 나쁘다.
 *   · 응답 캐시 — 진행 중 run 의 status 를 캐시하면 화면이 과거를 보여준다.
 *   · 실패 시 샘플 데이터 폴백 — 그래서 `api-samples/` 를 `src/` 밖에 뒀다.
 */

/** API 가 준 실패를 그대로 담는다. 문구를 만들어내지 않는다. */
export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  /** FastAPI `HTTPException` 의 `detail`. 없으면 본문 앞부분. */
  readonly detail: string;

  constructor(url: string, status: number, detail: string) {
    super(`${status} ${url} — ${detail}`);
    this.name = "ApiError";
    this.url = url;
    this.status = status;
    this.detail = detail;
  }
}

/** 서버가 안 떠 있거나 네트워크가 끊긴 경우. 404 와 구분해야 안내 문구가 달라진다. */
export class NetworkError extends Error {
  readonly url: string;
  constructor(url: string, cause: unknown) {
    super(`백엔드에 닿지 못했습니다: ${url}`);
    this.name = "NetworkError";
    this.url = url;
    this.cause = cause;
  }
}

async function readDetail(res: Response): Promise<string> {
  // 🔴 `res.json()` 만 믿지 않는다. 500 은 HTML 로 올 수 있고, 그때 json() 이
  //    던지면 원래 실패 원인이 파싱 오류로 뒤바뀐다.
  const text = await res.text().catch(() => "");
  if (!text) return res.statusText || "(본문 없음)";
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
  } catch {
    /* JSON 이 아니면 본문 그대로 쓴다 */
  }
  return text.slice(0, 300);
}

import { getAuthToken, refreshAuthToken, setAuthToken } from "./auth";

async function request(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  const doFetch = async (token: string | null) => {
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return await fetch(url, { 
      cache: "no-store", 
      ...init,
      headers
    });
  };

  try {
    let token = getAuthToken();
    res = await doFetch(token);

    // 401 발생 시 토큰 갱신 후 1회 재시도 (단 refresh 엔드포인트 자체는 제외)
    if (res.status === 401 && !url.includes("/auth/refresh")) {
      const refreshed = await refreshAuthToken();
      if (refreshed) {
        token = refreshed.access_token;
        res = await doFetch(token);
      }
    }
  } catch (e) {
    throw new NetworkError(url, e);
  }
  
  if (!res.ok) throw new ApiError(url, res.status, await readDetail(res));
  return res;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await request(url);
  return (await res.json()) as T;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

/**
 * 텍스트 산출물(CSV).
 *
 * 🔴 `res.text()` 를 쓰되 **바이트에서 직접 디코딩**한다. 백엔드가 한때 `.gpkg`
 *    바이너리를 `text/plain; charset=utf-8` 로 내보낸 적이 있다(2026-08-04 실측).
 *    지금은 고쳐졌지만, 헤더를 믿고 `text()` 를 부르면 그런 사고가 조용히
 *    깨진 문자열로 흘러든다. 인코딩은 우리가 정한다.
 */
export async function getText(url: string): Promise<string> {
  const res = await request(url);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buf);
  // utf-8-sig BOM 제거 — pandas 가 `utf-8-sig` 로 쓴다.
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
