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
 *   화면 2  감리 확인     /audit
 *   화면 2b 배제 근거     /audit/exclusion   ← 2 의 보조 화면이라 하위 경로
 *   화면 3  가중치       /weights
 *   화면 4  위치 선정     /sites
 *   화면 5  갈등 예측     /hearing/select    ← 토론 방식 고르기 (내비가 여는 문)
 *                        /hearing           ← A 대립 토론
 *                        /dynamic-hearing   ← B 다인 토론 (셋 다 같은 화면 5 다)
 *   화면 6  보고서       /report
 *
 * 번호가 없는 경로도 있다. 여기 없으면 화면이 아니다 —
 *   /hearing-pdf   코드에 박힌 **고정 표본** 심의보고서. 실행 결과를 안 읽는다.
 *
 * ⚠ 「진행현황 `/progress`」라고 적혀 있던 두 줄을 지웠다(2026-08-10). **그런 경로는
 *   없다** — `src/app/progress` 가 없고 링크도 0개다. 진행현황은 경로가 아니라
 *   셸 안의 사이드바(`components/shell/ProgressSidebar.tsx`)다. 주석에 **상태**를
 *   적으면 상하고, 상한 주석은 남의 작업 목록이 된다.
 */

import type { ArtifactName, RunDoc } from "./types";
import { gateScreen } from "./gate";

export interface Screen {
  no: string;
  /** 그 화면의 **정본 경로**. 「지금 어느 화면인가」(`screenOf`) 는 항상 이걸로 판정한다. */
  path: string;
  /**
   * 내비에서 **들어가는 문**. 없으면 `path` 로 들어간다.
   *
   * 🔴 화면 5 만 이게 필요하다 — 경로가 셋인데(`/hearing` A · `/dynamic-hearing` B ·
   *    `/hearing/select` 고르는 화면) **들어가는 문은 고르는 화면**이어야 한다.
   *    `path` 를 `/hearing/select` 로 바꿔 버리면 안 된다: `screenOf` 가 `path` 로
   *    매칭하므로 A 화면(`/hearing`)이 화면 5 가 아니게 되고, 상단 내비에서 화면 5 가
   *    꺼진 채로 토론이 돈다. **판정용 경로와 진입용 경로는 다른 값이다.**
   */
  entryPath?: string;
  name: string;
  inNav: boolean;
  draft?: boolean;
}

export const SCREENS: readonly Screen[] = [
  { no: "1", path: "/", name: "데이터 입력", inNav: true },
  { no: "2", path: "/audit", name: "데이터 확인", inNav: true },
  { no: "2b", path: "/audit/exclusion", name: "배제 근거", inNav: false },
  { no: "3", path: "/weights", name: "중요도", inNav: true },
  { no: "4", path: "/sites", name: "위치 선정", inNav: true },
  {
    no: "5",
    path: "/hearing",
    entryPath: "/hearing/select",
    name: "갈등 예측",
    inNav: true,
  },
  { no: "6", path: "/report", name: "보고서", inNav: true, draft: true },
] as const;

export const NAV_SCREENS = SCREENS.filter((s) => s.inNav);

export function screenOf(pathname: string): Screen | null {
  if (pathname === "/") return SCREENS[0] ?? null;

  /**
   * 화면 5 는 경로가 셋이다 — 토론 방식이 둘이기 때문이다(백엔드 엔진도 둘).
   *   고르는 화면  `/hearing/select`   ← `path` 의 하위 경로라 아래 규칙이 알아서 잡는다
   *   A 대립 토론  `/hearing`          ← SCREENS 에 있는 정본 경로(`path`)
   *   B 다인 토론  `/dynamic-hearing`  ← 경로가 `/hearing` 으로 시작하지 않아 여기서 잇는다
   *
   * 🔴 고르는 화면을 **`/hearing` 아래**에 둔 건 우연이 아니다. 아래 경계 매칭이
   *    `pathname.startsWith(s.path + "/")` 를 이미 보고 있어서 **매칭 규칙을 한 줄도
   *    안 고치고** 화면 5 로 잡힌다. 형제 경로(`/hearing-select` 같은)로 뒀으면
   *    `/dynamic-hearing` 처럼 특례가 하나 더 늘었을 것이다.
   */
  if (pathname.startsWith("/dynamic-hearing")) {
    return SCREENS.find((s) => s.no === "5") ?? null;
  }

  /**
   * 🔴 `startsWith` 를 **경계까지** 본다.
   *
   * 예전엔 맨 앞글자만 맞으면 걸렸다 — `/hearing-pdf` 가 `/hearing` 에 걸려
   * 화면 5 로 잡히는 바람에, 그걸 막으려고 `/hearing-pdf → 화면 6` 이라는
   * 특례를 두고 있었다. 그 특례 때문에 **표본 문서 화면이 화면 6 행세**를 했다
   * (상단 내비에 「6 보고서」가 켜진다). 화면 6 은 `/report` 다 — 실행 산출물
   * (`report.json`·`topN.csv`·`clean_report.json`)을 읽는 쪽이 화면 6 이고,
   * `/hearing-pdf` 는 코드에 박힌 고정 표본이다(그 파일 상단 주석 참고).
   *
   * 특례를 지우는 것만으론 안 된다 — 지우면 `/hearing-pdf` 가 화면 5 로 간다.
   * 고칠 곳은 특례가 아니라 **매칭 규칙**이었다. 이제 `/hearing-pdf` 는 어느
   * 화면도 아니다(내비 어디에도 안 켜진다). 번호 없는 화면이라 `null` 이 맞다.
   */
  const hit = SCREENS.filter(
    (s) => s.path !== "/" && (pathname === s.path || pathname.startsWith(s.path + "/")),
  ).sort((a, b) => b.path.length - a.path.length);
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

/**
 * 화면 → 그 화면이 살아 있으려면 있어야 하는 산출물. 없으면 아직 미완이다.
 *
 * 🔴 **화면 5 는 여기 없다.** 토론은 파이프라인 산출물이 아니다 — `runs/<id>/` 에
 *    파일이 안 생기고 `status.json.artifacts` 에도 안 올라온다. 예전엔 `"5": []` 로
 *    적어 뒀는데, 빈 배열은 「조건 없음(항상 완료)」이 아니라 아래 `need.length === 0`
 *    때문에 **항상 미완**이었다 — 화면 5 에는 ✓ 가 영영 안 켜졌다. 빈 배열로 두면
 *    「조건을 아직 안 적었다」와 「조건이 없다」가 같은 모양이 된다. 그래서 키를 지우고
 *    아래에서 **다른 판정기**로 갈랐다.
 */
const NEEDS: Record<string, ArtifactName[]> = {
  "1": [],
  "2": ["reviewed"],
  "3": ["weight_set"],
  "4": ["score_grid", "topN"],
  "6": ["report"],
};

/**
 * 화면이 완료됐는가.
 *
 * 🔴 `hearingDone` 은 **화면 5 전용 입력**이고 이 모듈이 스스로 구할 수 없다.
 *    토론 기록은 sessionStorage 에 있고(`hearingResult.ts`), 그걸 렌더 중에 읽으면
 *    서버 렌더와 값이 갈려 하이드레이션이 깨진다. 그래서 **읽는 쪽(셸)이 마운트 뒤에
 *    구해서 넘긴다.** 기본값 `false` = 「아직 모른다」이고, 이건 안전한 쪽이다 —
 *    모르는 상태를 완료로 그리면 안 끝난 토론이 끝난 것으로 보인다(원칙 4).
 *
 * 🔴 이 인자는 **백엔드가 토론 결과를 run 에 저장하면 사라질 자리**다. 그때는
 *    `NEEDS["5"]` 에 산출물 이름을 적으면 되고, 그러면 탭을 닫아도 완료가 남는다.
 */
export function isScreenReady(
  run: RunDoc | null,
  no: string,
  hearingDone = false,
): boolean {
  if (!run) return false;
  if (no === "1") return true; // 데이터 입력은 run이 생성되어 있으면 완료된 것
  if (no === "5") return hearingDone;
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
export function isScreenAllowed(
  run: RunDoc | null,
  no: string,
  hearingDone = false,
): boolean {
  if (no === "1") return true;
  if (isScreenReady(run, no, hearingDone)) return true;
  if (run?.status === "awaiting_hitl" && run.gate) {
    const target = gateScreen(run.gate.id);
    if (target && target.no === no) return true;
  }
  if (run?.status === "succeeded") return true;
  return false;
}
