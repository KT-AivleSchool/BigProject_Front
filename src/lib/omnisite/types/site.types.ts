/**
 * OmniSite 입지 평가, 지표 가중치, GIS 격자 및 보고서 관련 타입 정의
 */

import { Direction } from "./pipeline.types";

export interface Indicator {
  id: string;
  kind: string;
  direction: Direction;
  components: Record<string, string | null>;
  radius_m: number | null;
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
  w_critic: number | null;
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
  hitl: {
    radius_confirmed: boolean;
    weight_confirmed: boolean;
    value_source?: "human" | "fixture" | "cli" | null;
    radius_sources?: string[];
    weight_sources?: string[];
  };
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
  커버기여: number;
  누적커버율: number;
  순위: number;
}

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
  facility_params: Record<string, number>;
  counts: { parcels: number; points: number; survive: number };
  coverage: {
    n_max: number;
    cumulative: number[];
    marginal: number[];
    reach: Record<string, number>;
    knee: number;
    ceiling: number;
    unreached_n: number;
    unreached_val: number;
    cover_pairs: number;
    n_cand_mclp: number;
    n_demand: number;
  } | null;
  spatial: {
    exclusion_union_km2: number;
    shape_lift: boolean;
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

export interface ExclusionProps {
  dataset_id: string;
  type: string;
  type_source: string;
  type_llm: string;
  radius_m: number | null;
  label: string;
}

export type GeoRing = [number, number][];
export type GeoPolygon = GeoRing[];

export interface ExclusionFeature {
  type: "Feature";
  properties: ExclusionProps;
  geometry: { type: string; coordinates: unknown } | null;
}

export interface ExclusionDoc {
  type: "FeatureCollection";
  name?: string;
  crs?: { type: string; properties: { name: string } };
  features: ExclusionFeature[];
}

export type ScoreCell = [number, number, number, number];

export interface ScoreGridDoc {
  spacing_m: number;
  crs: string;
  count: number;
  score_min: number;
  score_max: number;
  cells: ScoreCell[];
}
