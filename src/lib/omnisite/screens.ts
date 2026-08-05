/**
 * 화면 번호 ↔ 경로 ↔ 이름 — **여기 한 곳에만 있다.**
 * ================================================
 * 🔴 화면 번호(1 · 2 · 2b · 3 · 4 · 5 · 6)와 백엔드 STEP 번호(0-1 · 1-2 · 2 · 3-1 · 4-1 …)
 *    는 **다른 체계다.** 문서 · 코드 · 대화에서 절대 섞지 않는다(명세 2쪽).
 *
 * 그래서 경로에 숫자를 안 쓴다. `/step2` 도 `/screen2` 도 아니다. 숫자를 URL 에
 * 넣는 순간 누군가는 그게 STEP 번호라고 읽는다. 경로는 **뜻으로** 짓는다.
 *
 *   화면 1  데이터 입력   /
 *   진행현황            /progress      ← 번호가 없는 화면이다
 *   화면 2  감리 확인     /audit
 *   화면 2b 배제 근거     /audit/exclusion   ← 2 의 보조 화면이라 하위 경로
 *   화면 3  가중치       /weights
 *   화면 4  위치 선정     /sites
 *   화면 5  갈등 예측     /hearing
 *   화면 6  보고서       /report
 */

export interface Screen {
  /** 명세의 화면 번호. 문자열인 이유는 `2b` 때문이다. */
  no: string;
  path: string;
  name: string;
  /** 상단 6단계 내비에 나오는가. 2b(보조)와 진행현황은 안 나온다. */
  inNav: boolean;
  /** 명세가 "임시(안)" 표시를 요구하는 화면. */
  draft?: boolean;
}

export const SCREENS: readonly Screen[] = [
  { no: "1", path: "/", name: "데이터 입력", inNav: true },
  { no: "2", path: "/audit", name: "감리 확인", inNav: true },
  { no: "2b", path: "/audit/exclusion", name: "배제 근거", inNav: false },
  { no: "3", path: "/weights", name: "가중치", inNav: true },
  { no: "4", path: "/sites", name: "위치 선정", inNav: true },
  { no: "5", path: "/hearing", name: "갈등 예측", inNav: true, draft: true },
  { no: "6", path: "/report", name: "보고서", inNav: true, draft: true },
] as const;

export const NAV_SCREENS = SCREENS.filter((s) => s.inNav);

export const PROGRESS_PATH = "/progress";

/** 현재 경로가 어느 화면인지. 가장 긴 접두사가 이긴다(`/audit/exclusion` vs `/audit`). */
export function screenOf(pathname: string): Screen | null {
  if (pathname === "/") return SCREENS[0] ?? null;
  const hit = SCREENS.filter((s) => s.path !== "/" && pathname.startsWith(s.path)).sort(
    (a, b) => b.path.length - a.path.length,
  );
  return hit[0] ?? null;
}

/** 내비 상의 이전/다음. 보조 화면(2b)은 순서에서 빠진다. */
export function neighbours(no: string): { prev: Screen | null; next: Screen | null } {
  const i = NAV_SCREENS.findIndex((s) => s.no === no);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: NAV_SCREENS[i - 1] ?? null,
    next: NAV_SCREENS[i + 1] ?? null,
  };
}
