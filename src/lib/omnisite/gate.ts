/**
 * 게이트 판별 — "지금 이 화면이 답할 게이트가 열려 있는가".
 *
 * 🔴 조건이 **세 개**다: `status === "awaiting_hitl"` · `gate` 존재 · `gate.id` 일치.
 *    하나라도 빠뜨리면 화면이 거짓말한다.
 *    - status 만 보면 → 서버가 gate 를 안 실었을 때 빈 폼이 뜬다.
 *    - gate.id 를 안 보면 → 게이트B 에서 멈춘 run 을 화면 2 가 자기 차례로 오해하고
 *      `POST …/hitl/audit` 을 쏜다. 서버는 400 으로 막지만, 그건 **막힌 것**이지
 *      화면이 맞은 게 아니다.
 *
 * 게이트 id 는 서버 값(`audit` · `weight`)을 그대로 쓴다. 화면 번호(2 · 3)와 섞지 않는다.
 */
import { SCREENS, type Screen } from "./screens";
import type {
  GateAuditQuestion,
  GateQuestion,
  GateWeightQuestion,
  RunDoc,
  RunGate,
} from "./types";

export const GATE_AUDIT = "audit";
export const GATE_WEIGHT = "weight";

/**
 * 게이트 → 그 게이트에 답하는 화면.
 *
 * 🔴 대응이 **여기 한 곳에만** 있다. 진행현황이 "화면 2 로 가라"고 안내하고
 *    화면 2 가 `openGate(run, GATE_AUDIT)` 로 폼을 여는데, 둘이 갈리면
 *    안내를 따라갔더니 폼이 없는 화면이 나온다.
 *
 * 🔴 모르는 게이트 id 는 **`null` 이다.** 아무 화면으로나 보내지 않는다 —
 *    서버가 게이트를 늘렸을 때 엉뚱한 화면에서 엉뚱한 본문을 POST 하게 된다.
 */
export function gateScreen(gateId: string): Screen | null {
  const no = { [GATE_AUDIT]: "2", [GATE_WEIGHT]: "3" }[gateId];
  return no ? (SCREENS.find((s) => s.no === no) ?? null) : null;
}

export function openGate(run: RunDoc | null, gateId: string): RunGate | null {
  if (!run || run.status !== "awaiting_hitl") return null;
  const g = run.gate;
  return g && g.id === gateId ? g : null;
}

/**
 * 🔴 `kind` 로 좁힌다. **`gate.id` 로 좁히지 않는다** — 게이트 하나에 여러 `kind` 가
 *    섞여 있고(게이트A 는 3종), 배열은 평평하다. id 로 통째로 캐스팅하면 그 안의
 *    구분이 사라진다.
 */
export function isAuditQuestion(q: GateQuestion): q is GateAuditQuestion {
  return q.kind === "exclusion" || q.kind === "intent" || q.kind === "code_prefix";
}

export function isWeightQuestion(q: GateQuestion): q is GateWeightQuestion {
  return q.kind === "weight";
}
