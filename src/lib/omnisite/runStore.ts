/**
 * 현재 run_id 보관.
 *
 * 🔴 `GET /runs` (목록) 이 계약에 없다. 그래서 방금 만든 run 을 프런트가
 *    기억하지 않으면 새로고침 한 번에 결과를 영영 못 찾는다.
 *
 * 다만 localStorage 의 값은 **주장일 뿐 사실이 아니다.** 서버에서 지워졌거나
 * 다른 서버를 보고 있을 수 있다. 그래서 읽은 뒤 반드시 `fetchRun` 으로
 * 되물어 확인하고, 404 면 조용히 무시하지 말고 지운 뒤 사용자에게 알린다.
 */
const KEY = "omnisite.runId.v1";

export function readRunId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function writeRunId(runId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, runId);
}

export function clearRunId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/**
 * 「기록 다시보기」로 연 run.
 * =========================
 * 🔴 **`run` 문서만 봐서는 다시보기인지 알 수 없다.** 마이페이지에서 연 run 과
 *    방금 내가 돌린 run 은 서버 응답이 **완전히 같다**(둘 다 `succeeded` 인 RunDoc).
 *    「지난 것을 열었다」는 서버가 아니라 **이 브라우저에서 일어난 일**이라 여기
 *    말고는 적힐 데가 없다.
 *
 * 🔴 값이 `true` 가 아니라 **run_id** 인 이유 — 불리언으로 두면 다시보기 중에
 *    새 실행을 시작했을 때(또는 다른 탭에서 run 이 바뀌었을 때) 깃발만 남아
 *    **새 run 을 지난 기록인 척** 보여준다. id 를 적어두면 현재 run 과 대조해서
 *    어긋나는 순간 저절로 무효가 된다.
 *
 * ⚠ `sessionStorage` 가 아니라 `localStorage` 다 — `omnisite.runId.v1` 과 **수명이
 *   같아야** 한다. 짧은 쪽에 두면 새로고침 뒤 run 은 그대로인데 다시보기 표시만
 *   사라져, 화면 1 이 다시 열린다.
 */
const REVIEW_KEY = "omnisite.reviewRunId.v1";

export function readReviewRunId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REVIEW_KEY);
}

export function writeReviewRunId(runId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REVIEW_KEY, runId);
}

export function clearReviewRunId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REVIEW_KEY);
}
