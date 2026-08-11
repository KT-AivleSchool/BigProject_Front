/**
 * 세션 갱신 — access 토큰 재발급 한 가지만 한다.
 * ============================================
 * 🔴 **`auth.ts` 에 두지 않은 이유는 순환 import 다.** `client.ts:97` 이
 *    `auth.ts` 의 `getAuthToken` 을 읽어 모든 요청에 `Bearer` 를 붙인다 —
 *    거기서 `auth.ts` 가 다시 `client.ts` 의 `postJson` 을 부르면 고리가 된다.
 *    그래서 **HTTP 를 아는 쪽을 따로** 뒀다: `auth.ts` 는 저장만, 여기가 통신만.
 *
 * 🔴 **자동 갱신을 하지 않는다.** 사람이 버튼을 눌러야 돈다.
 *    이유 둘 — ⓐ 백그라운드 타이머로 조용히 돌리면 실패가 화면에 안 남는다
 *    (RTR 실패는 **전 세션 강제 로그아웃**이라 조용히 지나갈 일이 아니다)
 *    ⓑ 지금 파이프라인 라우터는 인증을 안 걸어서(`get_current_user` 주입은
 *    `/auth/logout` 한 곳뿐) 만료돼도 실행이 안 끊긴다. 자동화가 필요해지는 건
 *    라우터에 인증이 붙는 시점이고, 그건 아직 안 정해졌다.
 */
import { postJson } from "./client";
import {
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
  tokenExpiresAt,
  type TokenResponse,
} from "./auth";

/** 갱신할 재료 자체가 없는 경우. 서버 실패와 **구분해서** 안내해야 한다. */
export class NoRefreshTokenError extends Error {
  constructor() {
    super("이 세션에는 재발급용 토큰이 없습니다. 다시 로그인하면 생깁니다.");
    this.name = "NoRefreshTokenError";
  }
}

/**
 * access 토큰 재발급. 성공하면 새 만료 시각(ms epoch)을 돌려준다.
 *
 * 🔴 **저장 순서가 중요하다 — refresh 를 먼저 쓴다.** 백엔드는 RTR(Refresh Token
 *    Rotation)이라 한 번 쓴 refresh 는 서버에서 즉시 파기되고 새것이 온다
 *    (`app/api/v1/auth.py:225-236`). 새것을 저장하기 전에 무언가 터지면 우리 손엔
 *    **이미 죽은 토큰**만 남고, 그걸 다음에 보내면 서버가 탈취로 보고
 *    **그 사용자의 모든 세션을 지운다**(Family Revocation, `auth.py:193-197`).
 *    access 저장이 늦어지는 건 새로고침이면 끝나지만, 이쪽은 되돌릴 수 없다.
 */
export async function refreshAuth(): Promise<number | null> {
  const rt = getRefreshToken();
  if (!rt) throw new NoRefreshTokenError();

  const t = await postJson<TokenResponse>("/api/v1/auth/refresh", { refresh_token: rt });

  // 서버가 새 refresh 를 안 줬으면 **지운다.** 방금 보낸 옛것은 서버에서 이미
  // 파기됐으므로, 들고 있어봐야 다음 클릭에서 Family Revocation 을 부른다.
  setRefreshToken(t.refresh_token ?? null);

  if (!t.access_token) {
    throw new Error("재발급 응답에 access_token 이 없습니다.");
  }
  setAuthToken(t.access_token);
  return tokenExpiresAt(t.access_token);
}
