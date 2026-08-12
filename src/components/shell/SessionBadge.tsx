"use client";

/**
 * 로그인 만료 표시 + 수동 갱신 버튼.
 *
 * 🔴 **Header 안에 인라인으로 넣지 않고 따로 뺐다.** 남은 시간을 1초마다 새로
 *    그리는데, Header 에 상태를 두면 헤더 전체(내비 6칸 · `useHearingDone` 폴링
 *    판정)가 **초당 한 번씩** 다시 렌더된다. 여기만 다시 그리게 가둔다.
 *
 * 🔴 **첫 렌더에서는 아무것도 안 그린다.** 남은 시간은 `localStorage` 와 로컬
 *    시계에서 나오는데 둘 다 서버 렌더 때 없다 — 렌더 중에 읽으면 하이드레이션이
 *    깨진다(2026-08-05 에 한 번 밟은 자리다).
 *
 *    그 「아직 아니다」를 예전엔 `useState(null)` + 마운트 `useEffect` 로 만들었는데
 *    그건 **effect 안의 동기 setState** 라 `react-hooks/set-state-in-effect` 가 잡는다.
 *    지금은 **시계의 서버 스냅샷(`null`)이 곧 그 신호**다 — 상태를 하나도 안 쓴다.
 */
import React, { useCallback, useState, useSyncExternalStore } from "react";
import { getRefreshToken, tokenExpiresAt } from "@/lib/omnisite/auth";
import { refreshAuth, NoRefreshTokenError } from "@/lib/omnisite/authSession";
import { ApiError, NetworkError } from "@/lib/omnisite/client";

/** 남은 밀리초 → `mm:ss`. 한 시간을 넘으면 `h:mm:ss`. */
function remainText(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * 1초마다 째깍이는 시계. **외부 저장소로 구독한다** — 시간은 React 밖의 값이다.
 * 서버 스냅샷이 `null` 인 것이 곧 「아직 마운트 전」이다.
 *
 * 초 단위로 끊어서 스냅샷을 만든다. `Date.now()` 를 그대로 주면 렌더 한 판 안에서도
 * 값이 달라져 `useSyncExternalStore` 가 무한 루프로 본다.
 */
const subscribeSecond = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};
const nowSecond = () => Math.floor(Date.now() / 1000);

function useNow(): number | null {
  const sec = useSyncExternalStore<number | null>(subscribeSecond, nowSecond, () => null);
  return sec === null ? null : sec * 1000;
}

export function SessionBadge() {
  /** `null` = 아직 마운트 전. */
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 🔴 상태로 들고 있지 않는다 — `localStorage` 는 React 밖의 값이라 「언제 읽었나」를
   *    상태로 굳히면 갱신 뒤에 손으로 다시 넣어줘야 한다(넣는 걸 빠뜨리면 조용히
   *    옛 값이 남는다). 마운트 뒤에는 매 초 다시 읽으므로 항상 지금 값이다.
   */
  const expiresAt = now === null ? null : tokenExpiresAt();
  const hasRefresh = now === null ? false : getRefreshToken() !== null;

  const onRefresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // 반환값(새 만료 시각)은 `localStorage` 에 이미 적혔다 — 위에서 다시 읽는다.
      await refreshAuth();
    } catch (e) {
      // 사유를 만들어내지 않는다 — 서버가 준 문구를 그대로 띄운다.
      if (e instanceof NoRefreshTokenError) setError(e.message);
      else if (e instanceof ApiError) setError(`${e.status} — ${e.detail}`);
      else if (e instanceof NetworkError) setError(e.message);
      else if (e instanceof Error) setError(e.message);
      else setError("알 수 없는 오류로 갱신하지 못했습니다.");
      // 🔴 여기서 토큰을 지우지 않는다. 갱신 실패가 곧 로그아웃은 아니다 —
      //    남은 시간이 있으면 그동안은 여전히 유효하다.
    } finally {
      setBusy(false);
    }
  }, []);

  if (now === null) return null; // 마운트 전

  const left = expiresAt === null ? null : expiresAt - now;
  const expired = left !== null && left <= 0;
  const soon = left !== null && left > 0 && left < 5 * 60 * 1000;

  // 만료 시각을 못 읽는 경우(옛 형식 토큰 등)는 **모른다고 말한다**. 0 으로 두면
  // 「방금 만료됐다」로 읽힌다.
  const label = left === null ? "만료 미상" : expired ? "만료됨" : remainText(left);

  return (
    <span
      className="flex items-center gap-1"
      title={
        error
          ? `갱신 실패: ${error}`
          : expiresAt === null
            ? "토큰에서 만료 시각(exp)을 읽지 못했습니다."
            : `로그인 만료: ${new Date(expiresAt).toLocaleString("ko-KR")}`
      }
    >
      <span
        className={[
          "tabular-nums text-[11px] font-semibold",
          error ? "text-red-600" : expired ? "text-red-600" : soon ? "text-amber-600" : "text-gray-500",
        ].join(" ")}
      >
        {error ? "갱신 실패" : label}
      </span>

      <button
        type="button"
        onClick={onRefresh}
        disabled={busy || !hasRefresh}
        aria-label="로그인 연장"
        title={
          hasRefresh
            ? "로그인 연장 (토큰 재발급)"
            : "이 세션에는 재발급용 토큰이 없습니다. 다시 로그인하면 생깁니다."
        }
        className="grid h-5 w-5 place-items-center rounded text-gray-500 transition-colors hover:bg-black/[0.06] hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-500"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={busy ? "animate-spin" : ""}
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
      </button>
    </span>
  );
}
