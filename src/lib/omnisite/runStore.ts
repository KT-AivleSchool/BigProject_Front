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
