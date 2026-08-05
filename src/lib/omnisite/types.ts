/**
 * 파이프라인 산출물 타입 — **응답 실물에서 뽑았다.**
 * ================================================
 * 근거: run `r_20260804_003` (2026-08-04, 도메인 흡연, mode=fixture) 의 실제 응답.
 * 샘플 원본은 `api-samples/r_20260804_003/` 에 그대로 보관돼 있다.
 *
 * 🔴 설계 문서의 표를 옮겨 적지 않았다. 문서 간 수치가 어긋난 전례가 있어서
 *    (계약서는 배제 union 이 "어느 산출물에도 없다"고 적혀 있지만 실제로는
 *    `report.spatial.exclusion_union_km2` 에 있다) API 응답만을 근거로 삼는다.
 *
 * 🔴 `api-samples/` 는 `src/` 밖에 둔다. import 가 불가능해야 한다 —
 *    API 가 죽었을 때 조용히 샘플로 떨어지는 코드를 애초에 못 쓰게 만든다.
 *    (절대원칙 1: 조용한 실패 금지)
 */

// ─────────────────────────────────────────────────────────────
// status.json — GET /api/v1/pipeline/runs/{run_id}
// ─────────────────────────────────────────────────────────────

/**
 * 계약 3절. `failed` 는 정상 응답이며 HTTP 200 으로 온다.
 *
 * 🔴 `awaiting_hitl` 은 **끝난 상태가 아닌데 폴링을 멈춰야 하는** 유일한 값이다
 *    (계약 7절, 2026-08-05 신설). 사람이 답을 주기 전까지 서버가 영원히 안 바꾼다 —
 *    계속 부르면 아무 일도 안 일어나는 요청을 1.5초마다 영원히 보낸다.
 *
 *    그래서 이 파일에는 **"끝났다"와 "지금 움직이고 있다"가 서로의 반대가 아니다.**
 *    `isLive`(폴링할까)와 `isFinished`(더 볼 게 없나)를 따로 판정한다. 하나로 묶으면
 *    게이트가 완료로 보이거나(값이 없는데 화면이 다 그린 척한다) 영원히 폴링한다.
 */
export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_hitl"
  | "succeeded"
  | "failed";

// ── 게이트 질문 (계약 7-4 · 7-5) ────────────────────────────────
//
// 🔴 **API 응답이 아니라 그 응답을 만드는 코드에서 뽑았다.**
//    `pipeline_runner.py:734 _questions_audit` · `:818 _questions_weight` 다.
//    이유는 이 파일 맨 위 원칙("문서 표를 옮겨 적지 않는다")과 같은 쪽이다 —
//    계약서(7-4)의 예시 JSON 은 **일부 필드가 값 예시뿐**이라 null 가능성이
//    안 보인다. 실제로 `facility_type`·`radius_source`·`col`·`verdict` 는
//    `dict.get()` 결과라 키가 없으면 `null` 로 나간다.
//
//    ⚠ 응답 실물로는 **아직 못 봤다.** 돌고 있는 서버가 `mode: hitl` 을 모르는
//      옛 빌드라(2026-08-05 실측: `"지원하지 않는 mode 입니다: 'hitl'"`) 게이트를
//      세울 수가 없었다. 생성기 코드를 근거로 삼은 것은 문서보다는 가깝지만
//      응답 실물은 아니다 — 서버가 갱신되면 실물로 한 번 대조할 것.

export interface GateExclusionQuestion {
  kind: "exclusion";
  dataset_id: string;
  role_index: number;
  /** false = 이미 확정됨. **보여주되 고칠 수 없다**(고치려 들면 400). */
  editable: boolean;
  summary: string;
  facility_type: string | null;
  exclusion_type: string | null;
  rationale: string;
  /** 현재 확정값. `null` = 아직 안 정해짐. */
  radius_m: number | null;
  radius_source: string | null;
  /** 🔴 AI 제안값. `radius_m`(확정값)과 **합치지 않는다** — 합치면 화면에서 구분이 사라진다. */
  proposed_m: number | null;
  proposal_source: string | null;
  evidence: string | null;
  /** false = 근거문장에 그 시설명이 없다. **다른 시설 규정일 수 있다** — 경고로 띄운다. */
  evidence_matches_facility: boolean | null;
}

export interface GateIntentChoice {
  value: number;
  label: string;
  /** true(가점·감점)면 `weight` 를 같이 보내야 한다. */
  needs_weight: boolean;
}

export interface GateIntentQuestion {
  kind: "intent";
  dataset_id: string;
  editable: boolean;
  summary: string;
  message: string;
  current_roles: string[];
  choices: GateIntentChoice[];
}

export interface GateCodePrefixQuestion {
  kind: "code_prefix";
  dataset_id: string;
  /** 🔴 `cleaning_ops` **전체** 기준 인덱스다. filter_by_code_prefix 만 센 번호가 아니다. */
  op_index: number;
  editable: boolean;
  summary: string;
  col: string | null;
  prefix: string;
  region: string;
  verdict: string | null;
  reason: string | null;
  detail: string | null;
  suggestion: string | null;
  confirmed_by: string | null;
  /** true = 감리 때도 API 도 코드표 대조를 **못 했다.** 사람이 직접 봐야 한다. */
  recheck_skipped: boolean;
}

export type GateAuditQuestion =
  | GateExclusionQuestion
  | GateIntentQuestion
  | GateCodePrefixQuestion;

/** 결합 지표에서 geo 쪽과 val 쪽 방향 판정이 갈렸다. 슬라이더 **부호**로 확정한다. */
export interface GateDirectionConflict {
  indicator_id: string;
  geo_dataset: string;
  geo_direction: Direction;
  val_dataset: string;
  val_direction: Direction;
}

export interface GateWeightQuestion {
  kind: "weight";
  indicator_id: string;
  indicator_kind: string;
  /** `indicator_kind !== "admin"`. true 면 반경 **필수**, false 면 보내면 400. */
  radius_required: boolean;
  direction: Direction;
  seed_weight: number;
  components: Record<string, string | null> | null;
  rationale: string;
  data_note: string;
  radius_proposed: number | null;
  radius_rationale: string;
  radius_source: string | null;
  /** `-1 ~ +1`. `direction` 이 cost 면 음수다. */
  slider_proposed: number | null;
  conflict: GateDirectionConflict | null;
}

/**
 * `awaiting_hitl` 일 때만 붙는다. **그 외에는 키 자체가 없다(`null` 이 아니다)** —
 * 백엔드가 명시했다. 그래서 `RunDoc.gate` 는 `?` 이고 `null` 을 허용하지 않는다.
 *
 * 🔴 `questions` 는 **평평한 배열**이고 원소마다 `kind` 가 있다 — 게이트A
 *    `exclusion`·`intent`·`code_prefix`, 게이트B `weight`. 한 배열에 두 게이트가
 *    섞여 오지는 않지만(게이트는 한 번에 하나), 타입으로는 막지 않는다 —
 *    화면이 `kind` 로 갈라 읽으므로 섞여 와도 안 깨진다.
 */
export interface RunGate {
  /**
   * `audit` = 게이트A · `weight` = 게이트B.
   *
   * 🔴 게이트A 는 **실행의 맨 앞**에 선다. 확정하는 대상은 STEP1(감리) 결과지만
   *    STEP1 자체는 이 run 이 돌리지 않는다 — 실행 계획은
   *    `⏸audit · 2 · 3-1 · propose · ⏸weight · 3-2 · 4` 다(계약 7-1).
   *    그래서 게이트A 에서 멈춘 run 은 **단계가 하나도 시작되지 않은 상태**다.
   */
  id: string;
  /**
   * 서버가 주는 사람용 이름. 예: `"감리 확인 — 배제반경 · 데이터 용도 · 지역 코드"`.
   * 🔴 프런트가 게이트 이름을 따로 갖고 있지 않다 — 두 곳에 적으면 언젠가 갈린다.
   */
  label: string;
  questions: GateQuestion[];
}

export type GateQuestion = GateAuditQuestion | GateWeightQuestion;

// ── 게이트 답변 (계약 7-4 · 7-5) ────────────────────────────────
//
// 🔴 **`run_id` 를 본문에 넣는다.** 경로와 다르면 400 이다 — 프런트가 다른 run 을
//    보고 있다는 뜻이라 백엔드가 조용히 경로 쪽을 쓰지 않는다.

export interface AuditAnswerExclusion {
  dataset_id: string;
  role_index: number;
  /**
   * 🔴 `null` = "반경 없음(면 배제)" 으로 **확정**. **키 생략** = 건드리지 않음(미확정 유지).
   *    둘은 다른 뜻이다. 그래서 `?` 와 `| null` 을 **둘 다** 쓴다 —
   *    `exactOptionalPropertyTypes` 가 아니어도 의도는 이 한 줄로 남는다.
   */
  radius_m?: number | null;
}

export interface AuditAnswerIntent {
  dataset_id: string;
  /** 1 가점 · 2 감점 · 3 배제 · 4 참조용 · 5 제외 */
  choice: number;
  /** 크기만. 부호는 `choice` 가 정한다. 1·2 에서만 쓰고 0 은 400(제외하려면 choice=5). */
  weight?: number;
}

export interface AuditAnswerCodePrefix {
  dataset_id: string;
  op_index: number;
  prefix: string;
}

export interface AuditAnswer {
  run_id: string;
  exclusions?: AuditAnswerExclusion[];
  intents?: AuditAnswerIntent[];
  code_prefixes?: AuditAnswerCodePrefix[];
}

/** 🔴 필드는 **이 셋뿐**이다. 다른 키가 있으면 400. */
export interface WeightAnswer {
  run_id: string;
  /** 지표ID → 정수 m(1~5000). `radius_required` 인 지표가 하나라도 빠지면 400. */
  radius: Record<string, number>;
  /**
   * 지표ID → `-1 ~ +1` **그대로**. 프런트가 `{seed_weight, direction}` 으로 분해하지
   * 않는다(분해하면 cost 반전과 이중으로 걸려 조용히 뒤집히고 `direction_source` 가
   * 산출물에서 사라진다). 생략하면 `slider_proposed` 를 쓴다.
   */
  slider: Record<string, number>;
}

/**
 * 단계 상태. `sec: null` + `done` 은 **정상**이다(gam4 마커를 놓친 경우).
 *
 * 🔴 대기 상태는 `idle` 이다. **`pending` 이 아니다** — 여기 `pending` 이라고 적어
 *    뒀던 게 2026-08-05 에 실물과 안 맞는 것으로 잡혔다(계약 3절 `steps[].status`,
 *    `pipeline_runner.py:473` 이 `"idle"` 을 쓴다). 유니온에 없는 값이 오면 화면의
 *    `{...}[step.status]` 조회가 전부 `undefined` 가 되고, **터지지 않고 빈칸으로**
 *    나온다 — 배지 글자가 사라지고 `className` 에 `undefined` 가 붙는다.
 *    타입이 틀렸는데 `tsc` 는 통과한다. 응답 실물에서 값을 뽑아야 하는 이유다.
 */
export type StepStatus = "idle" | "running" | "done" | "failed";

/**
 * 단계 id. 🔴 이건 **백엔드 STEP 번호**다. 화면 번호(1·2·2b·3·4·5·6)와 절대 섞지 않는다.
 * 화면에는 `label` 을 쓰고, id 는 회색 보조 텍스트로만 노출한다.
 */
export interface RunStep {
  id: string;
  label: string;
  status: StepStatus;
  sec: number | null;
}

/**
 * 화이트리스트 산출물 이름 (2026-08-04 기준 **8종**).
 *
 * `exclusion` 은 나중에 올라갔다(백엔드 커밋 `ea4bef3`). 그래서 **그 이전에 만들어진
 * run 의 `status.json` 에는 이 키가 없다** — 그 파일은 생성 시점의 화이트리스트로
 * 굳는다. 백엔드가 읽는 시점에 빠진 키를 채우도록 고쳤지만 프런트는 그걸 전제하지
 * 않는다. `artifacts` 가 `Partial` 인 이유가 이것이다 — **키가 없으면 "그 산출물이
 * 없다"로 취급하고 화면이 그렇게 말한다.** 옛 run 을 열었을 때 조용히 빈 값을
 * 그리는 대신 사유를 적는다(절대원칙 1·4).
 */
export type ArtifactName =
  | "reviewed"
  | "clean_report"
  | "candidates"
  | "weight_set"
  | "report"
  | "topN"
  | "exclusion"
  | "score_grid";

export interface RunDoc {
  run_id: string;
  domain: string;
  mode: string;
  status: RunStatus;
  steps: RunStep[];
  /** 값은 `/api/v1/pipeline/runs/<id>/artifacts/<name>` 절대경로. 그대로 fetch 한다. */
  artifacts: Partial<Record<ArtifactName, string>>;
  /** `awaiting_hitl` 일 때만 있다. 답을 주면 즉시 사라진다. */
  gate?: RunGate;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

// ─────────────────────────────────────────────────────────────
// reviewed.json — 화면 2 (감리 확인)
// ─────────────────────────────────────────────────────────────

export type AuditRole =
  | "positive_factor"
  | "negative_factor"
  | "hard_exclusion"
  | "reference_only";

export type CoordStatus =
  | "has_coords"
  | "needs_geocoding"
  | "stat_join"
  | "spatial";

export interface ReviewedRole {
  role: AuditRole;
  rationale?: string;
  /** positive/negative 일 때만. 크기+방향이 섞인 감리 AI 제안값(-1~1). */
  weight?: number;
  /** hard_exclusion 일 때만. */
  exclusion_type?: "radius" | "polygon";
  facility_type?: string;
  배제반경_m?: number | null;
  source?: string;
  confirmed?: boolean;
  need_review?: boolean;
}

export interface ReviewedFlag {
  type: string;
  role_index: number;
  message: string;
  제안값?: number | null;
  출처?: string;
  source_type?: string;
  근거문장?: string;
  /** false 면 근거문장에 해당 시설이 없다 — 다른 규정을 긁었을 수 있다. */
  근거_시설_일치?: boolean;
  confirmed?: boolean;
  confirmed_by_human?: boolean;
}

export interface ReviewedCleaningOp {
  op_id: string;
  params: Record<string, unknown>;
}

export interface ReviewedResult {
  dataset_id: string;
  summary: string;
  roles: ReviewedRole[];
  coord_status: CoordStatus;
  cleaning_ops: ReviewedCleaningOp[];
  hitl_flags: ReviewedFlag[];
}

export interface FacilityInference {
  facility: string;
  region: string;
  근거: string;
  mismatch: boolean;
  mismatch_reason: string;
  source_input: string;
  confirmed: boolean;
}

export interface ReviewedDoc {
  _schema: Record<string, unknown>;
  results: ReviewedResult[];
  facility_inference: FacilityInference;
}

// ─────────────────────────────────────────────────────────────
// clean_report.json — 화면 2b · 진행현황
// ─────────────────────────────────────────────────────────────

export interface CleanOpLog {
  seq: number;
  op_id: string;
  params: Record<string, unknown>;
  rows_before: number;
  rows_after: number;
  n_flags: number;
  elapsed_sec: number;
}

export interface CleanFlag {
  type: string;
  severity: string;
  row_id: number;
  message: string;
  raw_text?: string;
}

export interface CleanResult {
  dataset_id: string;
  filename: string;
  roles: AuditRole[];
  reference_only: boolean;
  gis_input: boolean;
  rows_before: number;
  rows_after: number;
  drop_ratio: number;
  n_ops: number;
  n_flags: number;
  flags: CleanFlag[];
  op_logs: CleanOpLog[];
  /** 🔴 서버 절대경로가 그대로 실린다. 화면에 노출하지 않는다. */
  output: string;
  format: string;
  status: string;
  sec: number;
}

export interface CleanReportDoc {
  _schema: Record<string, unknown>;
  facility: string;
  region: string;
  results: CleanResult[];
}

// ─────────────────────────────────────────────────────────────
// weight_set.json — 화면 3
// ─────────────────────────────────────────────────────────────

/** 방향. 크기(w_human ≥ 0)와 분리돼 있다 — 부호를 크기에 섞으면 조용히 뒤집힌다. */
export type Direction = "benefit" | "cost";

export interface Indicator {
  id: string;
  kind: string;
  direction: Direction;
  /**
   * point_sum 계열은 `{geo, val}` 두 dataset_id 의 결합이다.
   * 🔴 `val` 은 **null 일 수 있다**(실측: `04` · `08` · `09` · `10`). 단일 데이터셋 지표다.
   */
  components: Record<string, string | null>;
  radius_m: number | null;
  /** 값의 출처 — `cli_fixed` · `llm` · `human` … 화면에 그대로 보여준다. */
  radius_source: string;
  radius_rationale: string | null;
  seed_rationale: string | null;
  sparse_excluded: boolean;
  w_human: number;
  w_human_source: string;
  direction_source: string;
  direction_llm: Direction | null;
  direction_conflict: string | null;
  adjusted_at: string | null;
  /**
   * 🔴 **null 일 수 있다.** 희소로 제외된 지표(`sparse_excluded: true`)는 CRITIC 을
   *    돌리지 못한다 — 실측 `09` 가 그렇다. 처음에 `indicators[0]` 만 보고
   *    `number` 로 단정했다가 화면 3 이 통째로 죽었다. 배열은 전부 훑어야 한다.
   */
  w_critic: number | null;
  /** 위와 같은 이유로 null 가능. 부트스트랩을 안 돌렸으면 신뢰구간도 없다. */
  w_critic_ci: { mean: number; std: number; ci_low: number; ci_high: number } | null;
  w_final: number;
}

export interface WeightSetDoc {
  domain: string;
  facility: string;
  region: string;
  engine_version: string;
  generated_at: string;
  inputs: Record<string, { file: string; sha256: string; mtime: string; size: number }>;
  hitl: { radius_confirmed: boolean; weight_confirmed: boolean };
  alpha: number;
  n_candidates: number;
  candidate_unit: string;
  candidate_source: Record<string, unknown>;
  indicators: Indicator[];
  notes: {
    critic_method: string;
    sparse_threshold: number;
    sparse_excluded_ids: string[];
    weight_meaning: string;
  };
  decay: { func: string; sigma_ratio: number };
  scale: string;
  diagnostics: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// report.json — 화면 6 (+ 화면 2b 의 배제 union, 화면 4 의 커버곡선)
// ─────────────────────────────────────────────────────────────

/** 🔴 여기에는 경도·위도가 **없다.** 지도 마커는 topN.csv 를 써야 한다. */
export interface TopNRow {
  parcel_idx: number;
  from_rep: boolean;
  PNU: string;
  JIBUN: string;
  지목: string;
  면적: number;
  내접폭: number;
  법정동코드: string;
  국유_건수: number;
  국유_지분면적: number;
  국유_지분율: number;
  국유_지번일치: boolean;
  점수: number;
  /**
   * 🔴 **비율이 아니다.** `report.coverage.marginal[i]` 와 같은 값이며 단위는
   *    수요값 절대량이다(실측 1위 70.0307). `percent()` 로 찍으면 "7003%" 가 된다.
   *    총 수요값은 어느 산출물에도 없어서 백분율로 환산할 수 없다.
   */
  커버기여: number;
  /** 이쪽은 0~1 비율이 맞다. 커버율 증가분은 이 값의 차분으로 구한다. */
  누적커버율: number;
  순위: number;
}

/** topN.csv 는 위 16개 + 좌표 2개 = 18열이다. */
export interface TopNCsvRow extends TopNRow {
  경도: number;
  위도: number;
}

export interface DataGap {
  kind: string;
  target: string;
  detail: string;
  impact: string;
  review?: Record<string, unknown>;
}

export interface ReportDoc {
  domain: string;
  facility: string;
  weight_set: {
    alpha: number;
    decay: { func: string; sigma_ratio: number };
    scale: string;
    n_candidates: number;
    indicators: Array<{ id: string; w_final: number; radius_m: number | null }>;
  };
  /** 시설 파라미터 — 키가 한글이다. 법정값이라 실값을 쓴다(자리표시자 아님). */
  facility_params: Record<string, number>;
  counts: { parcels: number; points: number; survive: number };
  coverage: {
    n_max: number;
    cumulative: number[];
    marginal: number[];
    /** 목표 커버율 → 필요한 설치 개수. 키가 문자열이다("0.5" · "0.7" …). */
    reach: Record<string, number>;
    knee: number;
    /** 커버 상한. 100% 가 아닌 것이 버그가 아니라 사실이다. */
    ceiling: number;
    unreached_n: number;
    unreached_val: number;
    cover_pairs: number;
    n_cand_mclp: number;
    n_demand: number;
  } | null;
  /**
   * 🔴 `spatial: null` 은 **실행 조건이 아니라 코드 버전** 때문이다(백엔드 실측,
   *    2026-08-05). 계측 코드가 2026-08-04 16:15 에 들어갔고 그 이전 실행
   *    (`r_20260804_001`·`002`)만 null 이다. 지금 코드로는 null 이 안 나온다.
   *    `--no-shape-lift` 는 `shape_lift: false` 로만 나타나고 null 을 안 만든다.
   *    분기를 지우지는 않는다 — 옛 run 은 서버에 그대로 남아 있고 열 수 있다.
   */
  spatial: {
    /** 🔴 계약서는 "없다"고 적혀 있으나 2026-08-04 S5(A) 계측으로 노출됐다. */
    exclusion_union_km2: number;
    shape_lift: boolean;
    /**
     * 🔴 **키가 통째로 없을 수 있다**(백엔드 지적, 2026-08-05). 내접폭 컬럼이 없는
     *    지적도면 계측 자체를 못 한다. `spatial !== null` 을 확인해도 여기서 터진다 —
     *    실제로 방어해야 할 곳은 `spatial === null` 이 아니라 **여기**다.
     */
    width_m?: {
      n: number;
      min: number;
      p05: number;
      median: number;
      p95: number;
      max: number;
      sum: number;
      min_width: number;
      pass_min_width: number;
    };
  } | null;
  topn: TopNRow[];
  data_gap: DataGap[];
}

// ─────────────────────────────────────────────────────────────
// exclusion.geojson — 화면 2b (배제 레이어별 최종 판정)
// ─────────────────────────────────────────────────────────────

/**
 * 배제 레이어 한 장. **실측한 파일에서 뽑았다** —
 * `runs/r_20260804_005/step4/흡연_exclusion.geojson` (5 feature, 전부 MultiPolygon).
 *
 * 🔴 `type` 과 `type_llm` 을 **둘 다** 들고 있다. 최종값만 화면에 그리면
 *    나중에 HITL 이 무엇을 뒤집는 건지 화면에서 알 수 없다(절대원칙 3).
 *    - `type`        최종 판정 (`point` · `polygon` · `mixed`)
 *    - `type_llm`    감리 AI 제안 (`radius` · `polygon`)
 *    - `type_source` 누가 정했는지 (실측 전부 `jimok_lift` — S9 지목 배수 판정)
 */
export interface ExclusionProps {
  dataset_id: string;
  type: string;
  type_source: string;
  type_llm: string;
  radius_m: number | null;
  label: string;
}

export interface ExclusionFeature {
  type: "Feature";
  properties: ExclusionProps;
  /** 화면 2b 는 판정 표만 쓴다 — 좌표는 읽지 않으므로 형태를 단정하지 않는다. */
  geometry: { type: string; coordinates: unknown } | null;
}

export interface ExclusionDoc {
  type: "FeatureCollection";
  name?: string;
  crs?: { type: string; properties: { name: string } };
  features: ExclusionFeature[];
}

// ─────────────────────────────────────────────────────────────
// score_grid.json — 화면 4
// ─────────────────────────────────────────────────────────────

/** `[경도, 위도, 점수, 배제여부(0|1)]`. 키 반복을 피하려고 배열로 온다. */
export type ScoreCell = [number, number, number, number];

export interface ScoreGridDoc {
  /** 격자 한 변(m). 사각형은 이 값으로 **화면에서** 만든다. */
  spacing_m: number;
  crs: string;
  count: number;
  score_min: number;
  score_max: number;
  cells: ScoreCell[];
}
