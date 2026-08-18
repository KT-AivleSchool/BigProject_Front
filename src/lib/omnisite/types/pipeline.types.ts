/**
 * OmniSite 파이프라인 & 게이트 관련 타입 정의
 */

export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_hitl"
  | "succeeded"
  | "failed";

export interface GateExclusionQuestion {
  kind: "exclusion";
  dataset_id: string;
  role_index: number;
  editable: boolean;
  summary: string;
  facility_type: string | null;
  exclusion_type: string | null;
  rationale: string;
  radius_m: number | null;
  radius_source: string | null;
  proposed_m: number | null;
  proposal_source: string | null;
  evidence: string | null;
  evidence_matches_facility: boolean | null;
  source_geometry: "point" | "unknown" | string | null;
  source_rows: number | null;
  source_geometry_why: string | null;
}

export interface GateIntentChoice {
  value: number;
  label: string;
  needs_weight: boolean;
  needs_radius: boolean;
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
  recheck_skipped: boolean;
}

export type GateAuditQuestion =
  | GateExclusionQuestion
  | GateIntentQuestion
  | GateCodePrefixQuestion;

export type Direction = "benefit" | "cost";

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
  radius_required: boolean;
  direction: Direction;
  seed_weight: number;
  components: Record<string, string | null> | null;
  rationale: string;
  data_note: string;
  radius_proposed: number | null;
  radius_rationale: string;
  radius_source: string | null;
  slider_proposed: number | null;
  conflict: GateDirectionConflict | null;
}

export interface RunGate {
  id: string;
  label: string;
  questions: GateQuestion[];
}

export type GateQuestion = GateAuditQuestion | GateWeightQuestion;

export interface AuditAnswerExclusion {
  dataset_id: string;
  role_index: number;
  radius_m?: number | null;
}

export interface AuditAnswerIntent {
  dataset_id: string;
  choice: number;
  weight?: number;
  radius_m?: number | null;
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

export interface WeightAnswer {
  run_id: string;
  radius: Record<string, number>;
  slider: Record<string, number>;
}

export type StepStatus = "idle" | "running" | "done" | "failed";

export interface RunStep {
  id: string;
  label: string;
  status: StepStatus;
  sec: number | null;
}

export type ArtifactName =
  | "reviewed"
  | "facility"
  | "clean_report"
  | "candidates"
  | "weight_set"
  | "report"
  | "topN"
  | "exclusion"
  | "score_grid";

export interface RunLoaded {
  run_id: string;
  audit_rules?: number;
  booth_candidates?: number;
}

export interface RunDoc {
  run_id: string;
  domain: string;
  mode: string;
  auto_approve?: boolean;
  status: RunStatus;
  steps: RunStep[];
  artifacts: Partial<Record<ArtifactName, string>>;
  gate?: RunGate;
  loaded?: RunLoaded | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

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
  weight?: number;
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
