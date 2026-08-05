/**
 * 파이프라인 실행 API — `pipeline_run_contract.md` 가 유일한 기준.
 * =============================================================
 * 엔드포인트는 **4개다.** 실측(2026-08-05, app/api/v1/pipeline.py):
 *
 *   POST /api/v1/pipeline/runs                        → 202 {run_id}
 *   GET  /api/v1/pipeline/runs/{run_id}               → status.json 원문
 *   GET  /api/v1/pipeline/runs/{run_id}/artifacts/{n} → 산출물 파일 원본
 *   GET  /api/v1/pipeline/runs/{run_id}/log[?tail=N]  → 실행 로그 (커밋 836455e)
 *
 * 쓰기 API 는 **이제 있고 이제 쓴다** — 화면 2 · 3 이 게이트 답변 화면이 됐다
 * (2026-08-05, 계약 7절):
 *
 *   POST /api/v1/pipeline/runs/{id}/hitl/audit    게이트A
 *   POST /api/v1/pipeline/runs/{id}/hitl/weight   게이트B
 *   → 200 이면 본문은 **답변 직후의 status.json**(이미 `running`, `gate` 키 없음)
 *
 * 알아야 할 것:
 *
 *    - 본문에 **`run_id` 를 넣어야 한다.** 경로와 다르면 400 이다 — 프런트가 다른
 *      run 을 보고 있다는 뜻이라 조용히 경로 쪽을 쓰지 않는다.
 *    - 둘 다 **게이트 단위 배치**다. 항목 1건씩 보내면 `apply_weight_hitl` 이
 *      전 슬라이더 `sum(abs(v)) > 0` 을 검증할 수 없다 — 검증을 빼면 전 후보
 *      점수가 0 이 된다(백엔드가 실제로 겪은 사고).
 *    - 게이트A: `{run_id, exclusions[], intents[], code_prefixes[]}`. 세 배열 다
 *      선택이고 고칠 게 없으면 `{run_id}` 만. 🔴 `radius_m: null`(= 반경 없는 면
 *      배제)과 **키 생략**(= 건드리지 않음)은 **다른 뜻**이다. `editable: false`
 *      항목을 보내면 400 — 보여주되 못 고친다.
 *    - 게이트B: `{run_id, radius{}, slider{}}` **이 셋뿐**이다. 다른 키는 400.
 *      🔴 `slider` 는 `-1 ~ +1` 을 **그대로** 보낸다. 프런트가 `{seed_weight,
 *      direction}` 으로 미리 분해하면 `normalize_matrix` 의 cost 반전과 이중으로
 *      걸려 조용히 뒤집히고, `direction_source` 가 산출물에서 사라진다.
 *    - 409 는 실패가 아니라 **점유**다 — 같은 도메인을 다른 run 이 잡고 있다.
 *
 * 🔴 **run 목록 API 도 없다.** 그래서 방금 만든 run_id 를 프런트가 직접
 *    기억해야 한다(`runStore.ts`). 서버가 유일한 진실인데 목록을 못 물어보므로,
 *    브라우저에 남은 id 는 항상 서버에 되물어 확인한 뒤 쓴다.
 */
import { getJson, postJson, getText } from "./client";
import { parseCsv } from "./csv";
import type {
  ArtifactName,
  AuditAnswer,
  CleanReportDoc,
  ExclusionDoc,
  ReportDoc,
  ReviewedDoc,
  RunDoc,
  ScoreGridDoc,
  TopNCsvRow,
  WeightAnswer,
  WeightSetDoc,
} from "./types";

const BASE = "/api/v1/pipeline";

/**
 * 계약 2절. `mode` 는 이 둘뿐이다.
 *
 * - `fixture` 무입력 완주. 회귀 검증용. 게이트가 **안 선다.**
 * - `hitl`    게이트A·B 에서 멈춘다. 화면 2 · 3 에서 답해야 이어진다.
 *
 * 🔴 목록을 프런트가 정하지 않는다 — 서버가 모르는 값을 보내면 400 이고 문구도
 *    서버가 준다. 여기 있는 두 상수는 **버튼 라벨을 붙이기 위한 것**이지 화이트
 *    리스트가 아니다. (모드가 늘면 서버가 먼저 알고, 화면은 그다음이다)
 */
export const MODE_FIXTURE = "fixture";
export const MODE_HITL = "hitl";

export async function createRun(
  domain: string,
  mode: string = MODE_FIXTURE,
): Promise<string> {
  const { run_id } = await postJson<{ run_id: string }>(`${BASE}/runs`, {
    domain,
    mode,
  });
  return run_id;
}

/**
 * 게이트 답변. 응답은 **답변 직후의 status.json** 이므로 그대로 현재 run 으로 쓴다.
 *
 * 🔴 `gate_id` 를 인자로 받지 않고 함수를 둘로 나눈 이유 — 본문 모양이 완전히 다르고
 *    서버가 "지금 기다리는 게이트와 다른 gate_id" 를 400 으로 막는다. 하나로 합치면
 *    호출부에서 `body` 가 `any` 에 가까워지고, 잘못된 짝을 타입이 못 잡는다.
 */
export function submitAuditGate(runId: string, answer: AuditAnswer): Promise<RunDoc> {
  return postJson<RunDoc>(
    `${BASE}/runs/${encodeURIComponent(runId)}/hitl/audit`,
    answer,
  );
}

export function submitWeightGate(runId: string, answer: WeightAnswer): Promise<RunDoc> {
  return postJson<RunDoc>(
    `${BASE}/runs/${encodeURIComponent(runId)}/hitl/weight`,
    answer,
  );
}

export function fetchRun(runId: string): Promise<RunDoc> {
  return getJson<RunDoc>(`${BASE}/runs/${encodeURIComponent(runId)}`);
}

/**
 * 실행 로그(`run.log`). 백엔드 커밋 `836455e`.
 *
 * - 실행 중에도 읽힌다. **락을 안 걸므로 마지막 줄이 잘려 있을 수 있다** —
 *   자식 프로세스 출력을 막지 않으려는 의도된 선택이다. 화면은 마지막 줄을
 *   특별 취급하지 않는다(잘린 줄도 그냥 그대로 보여준다. 감추면 거짓말이 된다).
 * - run 은 있는데 로그가 아직 없으면 **200 + 빈 본문**이다. 404 가 아니다 —
 *   404 로 하면 "없는 run"과 구분이 안 되기 때문이다. 그래서 빈 문자열은
 *   오류가 아니라 "아직 안 쌓였다" 로 읽는다.
 * - `tail` 은 N ≥ 1. **0 은 422** 다(전체를 뜻하지 않는다). 전체를 원하면 생략한다.
 *
 * 🔴 이 응답만 "가공하지 않고 그대로" 의 **예외**다. 절대경로·OS 계정명·API 키가
 *    마스킹돼서 나온다(`<repo>` · `<home>` · `<마스킹:VWORLD_API_KEY>`). 지운 자리에
 *    표시를 남기는 방식이라 로그가 원본인 척하지 않는다 — 그래서 화면도 이 사실을
 *    각주로 적는다. 마스킹된 값을 원본으로 오해해 디버깅하면 시간을 버린다.
 */
export function fetchRunLog(runId: string, tail?: number): Promise<string> {
  const q = tail && tail >= 1 ? `?tail=${tail}` : "";
  return getText(`${BASE}/runs/${encodeURIComponent(runId)}/log${q}`);
}

/**
 * 산출물 URL.
 *
 * 🔴 `run.artifacts[name]` 이 있으면 **그 값을 그대로 쓴다.** 우리가 조립하지
 *    않는다. 계약 4절이 "status.json 을 가공하지 않고 그대로 내보낸다"고
 *    한 이유가, 경로 규칙이 바뀌어도 프런트가 안 깨지게 하려는 것이다.
 *    `artifacts` 에 키가 없다는 것은 "그 산출물이 아직 없다"는 뜻이므로 null.
 */
export function artifactUrl(run: RunDoc, name: ArtifactName): string | null {
  return run.artifacts[name] ?? null;
}

/** 산출물이 없으면 조용히 넘기지 않고 던진다. 화면이 "왜 비었는지"를 말해야 한다. */
function requireUrl(run: RunDoc, name: ArtifactName): string {
  const url = artifactUrl(run, name);
  if (!url) {
    throw new Error(
      `산출물 '${name}' 이 run ${run.run_id} 에 없습니다 ` +
        `(상태: ${run.status}). 아직 생성 전이거나 실행이 실패했습니다.`,
    );
  }
  return url;
}

export const loadReviewed = (run: RunDoc) =>
  getJson<ReviewedDoc>(requireUrl(run, "reviewed"));

export const loadCleanReport = (run: RunDoc) =>
  getJson<CleanReportDoc>(requireUrl(run, "clean_report"));

export const loadWeightSet = (run: RunDoc) =>
  getJson<WeightSetDoc>(requireUrl(run, "weight_set"));

export const loadReport = (run: RunDoc) =>
  getJson<ReportDoc>(requireUrl(run, "report"));

export const loadScoreGrid = (run: RunDoc) =>
  getJson<ScoreGridDoc>(requireUrl(run, "score_grid"));

/**
 * 배제 레이어. **화면 2b 의 「최종 판정」 열은 이 파일에서만 나온다** —
 * `reviewed.json` 에는 감리 AI 제안(`exclusion_type`)만 있고, S9 지목 배수 판정이
 * 그걸 뒤집은 결과는 여기에 있다.
 *
 * 🔴 GeoJSON 이지만 **좌표는 안 읽는다.** 화면 2b 가 쓰는 것은 `properties` 뿐이다.
 *    285KB 를 판정 표 하나 때문에 받는 셈인데, 백엔드에 속성만 담긴 산출물이
 *    따로 없으므로 있는 것을 쓴다. 별도 요약 산출물을 만들어 달라고 하면
 *    같은 값이 두 곳에 생기고 언젠가 갈린다.
 */
export const loadExclusion = (run: RunDoc) =>
  getJson<ExclusionDoc>(requireUrl(run, "exclusion"));

/**
 * Top-N. **CSV 로 읽는다** — `report.json > topn[]` 에는 경도·위도가 없다(실측).
 * 지도에 찍으려면 이쪽이어야 한다.
 */
export async function loadTopN(run: RunDoc): Promise<TopNCsvRow[]> {
  const text = await getText(requireUrl(run, "topN"));
  return parseCsv(text).map((r) => ({
    parcel_idx: num(r, "parcel_idx"),
    from_rep: bool(r, "from_rep"),
    PNU: str(r, "PNU"),
    JIBUN: str(r, "JIBUN"),
    지목: str(r, "지목"),
    면적: num(r, "면적"),
    내접폭: num(r, "내접폭"),
    법정동코드: str(r, "법정동코드"),
    국유_건수: num(r, "국유_건수"),
    국유_지분면적: num(r, "국유_지분면적"),
    국유_지분율: num(r, "국유_지분율"),
    국유_지번일치: bool(r, "국유_지번일치"),
    점수: num(r, "점수"),
    커버기여: num(r, "커버기여"),
    누적커버율: num(r, "누적커버율"),
    순위: num(r, "순위"),
    경도: num(r, "경도"),
    위도: num(r, "위도"),
  }));
}

// ── CSV 셀 변환 ────────────────────────────────────────────────
// 🔴 없는 열을 0 이나 "" 로 때우지 않는다. 열 이름이 바뀌면 **터져야** 한다.
//    조용히 0 이 들어가면 지도에 (0, 0) 마커가 찍히고 아무도 눈치채지 못한다.

function cell(r: Record<string, string>, k: string): string {
  const v = r[k];
  if (v === undefined) {
    throw new Error(
      `topN.csv 에 '${k}' 열이 없습니다. 실제 열: ${Object.keys(r).join(", ")}`,
    );
  }
  return v;
}

const str = (r: Record<string, string>, k: string) => cell(r, k);

function num(r: Record<string, string>, k: string): number {
  const v = Number(cell(r, k));
  if (!Number.isFinite(v)) {
    throw new Error(`topN.csv '${k}' 열이 숫자가 아닙니다: ${JSON.stringify(r[k])}`);
  }
  return v;
}

/** pandas 가 쓴 파이썬 불리언. `True` / `False` 다 — 소문자가 아니다. */
function bool(r: Record<string, string>, k: string): boolean {
  const v = cell(r, k).trim();
  if (v === "True" || v === "true" || v === "1") return true;
  if (v === "False" || v === "false" || v === "0") return false;
  throw new Error(`topN.csv '${k}' 열이 불리언이 아닙니다: ${JSON.stringify(v)}`);
}
