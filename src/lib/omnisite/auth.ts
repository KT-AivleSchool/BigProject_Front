/**
 * 인증 값의 **보관만** 한다. HTTP 는 여기 없다.
 *
 * 🔴 **`./client` 를 import 하지 않는다 — 순환이 된다.** `client.ts:97` 이 여기
 *    `getAuthToken` 을 읽어 모든 요청에 `Bearer` 를 붙인다. 재발급을 여기 두면
 *    `auth → client → auth` 고리가 생긴다(2026-08-11 에 실제로 한 번 들어왔다).
 *    통신하는 쪽은 `authSession.ts` 다.
 */
export interface UserRegister {
  email: string;
  password: string;
  username: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  /**
   * 재발급용 토큰. **로그인 응답에 원래부터 들어 있었는데 프런트가 버리고 있었다**
   * (백엔드 `app/schemas/auth.py:58` · `auth.py:155`). 스키마상 `str | None` 이라
   * 옵셔널로 받는다 — 없으면 「재발급 못 함」이지 오류가 아니다.
   */
  refresh_token?: string | null;
  token_type: string;
  expires_in_minutes: number;
}

export interface UserResponse {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

export const AUTH_TOKEN_KEY = "omnisite_auth_token";
export const AUTH_USER_KEY = "omnisite_auth_user";
/**
 * 재발급용 토큰 보관 자리(2026-08-11 신설).
 *
 * 🔴 **이 키가 없던 시절에 로그인한 세션이 있다.** 그런 세션은 access 만 들고 있어서
 *    갱신을 못 한다 — 그때는 「실패」가 아니라 **「다시 로그인하면 생긴다」**로
 *    말해야 한다. 빈 값을 오류로 뭉뚱그리면 사람이 서버를 의심한다(원칙 4).
 */
export const AUTH_REFRESH_KEY = "omnisite_auth_refresh";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function getAuthUser(): UserResponse | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setAuthUser(user: UserResponse | null) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_REFRESH_KEY);
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_REFRESH_KEY, token);
  } else {
    localStorage.removeItem(AUTH_REFRESH_KEY);
  }
}

/** 로그아웃 — 셋을 **같이** 지운다. 하나라도 남으면 다음 로그인과 섞인다. */
export function clearAuth() {
  setAuthToken(null);
  setRefreshToken(null);
  setAuthUser(null);
}

/**
 * JWT 페이로드를 읽는다. **검증이 아니다** — 서명은 서버만 검증할 수 있다.
 * 여기서 얻은 값은 화면 표시용이고, 권한 판단에 쓰면 안 된다.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const v = JSON.parse(json);
    return typeof v === "object" && v !== null ? v : null;
  } catch {
    return null;
  }
}

/**
 * access 토큰 만료 시각(ms epoch). 못 읽으면 `null`.
 *
 * 🔴 **`expires_in_minutes` 로 계산하지 않는다.** 그건 로그인한 순간부터 세는 값이라
 *    새로고침하면 기준점이 사라지고, 저장해두면 그때부터 시계를 우리가 들게 된다.
 *    JWT `exp` 는 **서버가 박은 절대 시각**이라 탭을 닫았다 열어도 같은 답이다.
 */
export function tokenExpiresAt(token: string | null = getAuthToken()): number | null {
  if (!token) return null;
  const p = decodeJwtPayload(token);
  const exp = p?.["exp"];
  return typeof exp === "number" ? exp * 1000 : null;
}
