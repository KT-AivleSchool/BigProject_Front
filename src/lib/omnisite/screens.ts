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

import type { ArtifactName, RunDoc } from "./types";
import { gateScreen } from "./gate";

export interface Screen {
  no: string;
  path: string;
  name: string;
  inNav: boolean;
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

export function screenOf(pathname: string): Screen | null {
  if (pathname === "/") return SCREENS[0] ?? null;

  // 특수 경로 매핑 (/hearing-pdf -> 보고서, /dynamic-hearing -> 갈등 예측)
  if (pathname.startsWith("/hearing-pdf")) {
    return SCREENS.find((s) => s.no === "6") ?? null;
  }
  if (pathname.startsWith("/dynamic-hearing")) {
    return SCREENS.find((s) => s.no === "5") ?? null;
  }

  const hit = SCREENS.filter((s) => s.path !== "/" && pathname.startsWith(s.path)).sort(
    (a, b) => b.path.length - a.path.length,
  );
  return hit[0] ?? null;
}

export function neighbours(no: string): { prev: Screen | null; next: Screen | null } {
  const i = NAV_SCREENS.findIndex((s) => s.no === no);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: NAV_SCREENS[i - 1] ?? null,
    next: NAV_SCREENS[i + 1] ?? null,
  };
}

/** 화면 → 그 화면이 살아 있으려면 있어야 하는 산출물. 없으면 아직 미완이다. */
const NEEDS: Record<string, ArtifactName[]> = {
  "1": [],
  "2": ["reviewed"],
  "3": ["weight_set"],
  "4": ["score_grid", "topN"],
  "5": [], 
  "6": ["report"],
};

export function isScreenReady(run: RunDoc | null, no: string): boolean {
  if (!run) return false;
  if (no === "1") return true; // 데이터 입력은 run이 생성되어 있으면 완료된 것
  const need = NEEDS[no];
  if (!need || need.length === 0) return false;
  return need.every((n) => Boolean(run.artifacts[n]));
}

/**
 * 단계별 네비게이션 제어: 
 * 사용자가 특정 화면에 접근 가능한지 판단합니다.
 * - 1단계는 항상 허용.
 * - 이미 준비된 화면은 허용.
 * - 현재 HITL 게이트로 지정된 화면은 허용.
 */
export function isScreenAllowed(run: RunDoc | null, no: string): boolean {
  if (no === "1") return true;
  if (isScreenReady(run, no)) return true;
  if (run?.status === "awaiting_hitl" && run.gate) {
    const target = gateScreen(run.gate.id);
    if (target && target.no === no) return true;
  }
  if (run?.status === "succeeded") return true;
  return false;
}
