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
  /**
   * 파싱된 응답 본문 원본. JSON 이 아니었으면 `null`.
   *
   * 🔴 `detail` 만으로는 부족해서 생겼다(2026-08-11). 백엔드가 404 의 `detail` 을
   *    **객체**로 주기 시작했는데(`{code, message, run_id, domain, loaded, current}`)
   *    `readDetail()` 은 그중 `message` 문자열만 뽑는다 — 표시에는 그게 맞지만
   *    `code` 로 갈라야 할 때 남는 게 없다. 그래서 **뽑은 것과 원본을 둘 다** 든다.
   *    `detail` 을 객체로 바꾸지 않은 이유: 그러면 이걸 쓰는 화면 십수 곳이
   *    전부 문자열 가정을 깨고, 하필 그 자리가 「실패 사유를 띄우는」 자리다.
   */
  readonly body: unknown;

  constructor(url: string, status: number, detail: string, body: unknown = null) {
    super(`${status} ${url} — ${detail}`);
    this.name = "ApiError";
    this.url = url;
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

/**
 * 실패 본문의 `detail.code`. 없으면 `null`.
 *
 * 🔴 **이 값으로 문구를 만들지 않는다.** 백엔드와 합의한 규약이 그렇다 —
 *    코드 집합은 늘어날 수 있고(2026-08-11 회신에서 넷 → 다섯), 모르는 코드에
 *    분기를 만들면 프런트 배포를 기다려야 한다. 대신 `message` 가 어느 갈래에서도
 *    항상 채워져 오므로 **표시는 언제나 `detail`(= message) 그대로**이고,
 *    이 코드는 「어느 갈래였는지」를 사유에 덧붙이는 데만 쓴다.
 */
export function apiErrorCode(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  const b = e.body;
  if (typeof b !== "object" || b === null) return null;
  const d = (b as { detail?: unknown }).detail;
  if (typeof d !== "object" || d === null) return null;
  const code = (d as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
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

async function readDetail(res: Response): Promise<{ detail: string; body: unknown }> {
  // 🔴 `res.json()` 만 믿지 않는다. 500 은 HTML 로 올 수 있고, 그때 json() 이
  //    던지면 원래 실패 원인이 파싱 오류로 뒤바뀐다.
  const text = await res.text().catch(() => "");
  if (!text) return { detail: res.statusText || "(본문 없음)", body: null };
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") return { detail: j.detail, body: j };
    // 🔴 `detail` 이 **객체**인 경우가 있다 — 업로드 422 는
    //    `{message, domain, saved_to, files[]}` 를 통째로 넣고
    //    (`app/api/v1/upload.py:483-488`), `/simulations/hearings` 404 는
    //    `{code, message, run_id, domain, loaded, current}` 를 넣는다
    //    (`simulations.py:_missing_run_detail`). 이 분기가 없으면 본문 전체가
    //    300자에서 잘려 **날 JSON 이 화면에 그대로 뜬다**(2026-08-11 에 한 번
    //    되돌려졌던 자리다). 두 엔드포인트 다 `message` 를 **항상** 채우기로
    //    했으므로 그걸 쓴다.
    if (j.detail && typeof j.detail === "object") {
      const d = j.detail as { message?: unknown };
      if (typeof d.message === "string") return { detail: d.message, body: j };
      return { detail: JSON.stringify(j.detail).slice(0, 300), body: j };
    }
    return { detail: text.slice(0, 300), body: j };
  } catch {
    /* JSON 이 아니면 본문 그대로 쓴다 */
  }
  return { detail: text.slice(0, 300), body: null };
}

import { getAuthToken } from "./auth";

/**
 * 🔴 **401 을 만나도 자동 재발급하지 않는다.** 백엔드는 RTR 이라 재발급이 실패하면
 *    그 사용자의 **모든 세션이 지워진다**(`app/api/v1/auth.py:193-197`). 요청 경로에
 *    숨겨두면 그 사고가 어느 클릭에서 났는지 화면에 안 남는다. 갱신은 사람이
 *    헤더의 버튼으로만 한다(`SessionBadge` → `authSession.refreshAuth`).
 *    여기서 `./auth` 의 재발급 함수를 부르면 순환 import 도 같이 생긴다.
 */
async function request(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    const headers = new Headers(init?.headers);
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    res = await fetch(url, {
      cache: "no-store",
      ...init,
      headers,
    });
  } catch (e) {
    throw new NetworkError(url, e);
  }
  if (!res.ok) {
    const { detail, body } = await readDetail(res);
    throw new ApiError(url, res.status, detail, body);
  }
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

/**
 * multipart/form-data POST (업로드).
 *
 * 🔴 `Content-Type` 을 **직접 넣지 않는다.** FormData 를 주면 브라우저가
 *    `multipart/form-data; boundary=...` 를 만들어 붙이는데, 우리가 헤더를
 *    먼저 박으면 boundary 가 빠져 서버가 파트를 하나도 못 읽는다.
 *    (증상: 파일을 붙였는데 422 `files: Field required`)
 */
export async function postForm<T>(url: string, form: FormData): Promise<T> {
  const res = await request(url, { method: "POST", body: form });
  return (await res.json()) as T;
}

/** DELETE. 실패는 `ApiError` 로 던진다 — 204 를 안 주는 엔드포인트라 본문을 읽는다. */
export async function deleteJson<T>(url: string): Promise<T> {
  const res = await request(url, { method: "DELETE" });
  return (await res.json()) as T;
}
