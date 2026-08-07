export interface DebateLogItem {
  sender: string;
  text: string;
}

export interface ScenarioItem {
  scenario: string;
  scenario_description: string;
  final_acceptance_score: string | number;
  reason: string;
  summary: string;
  conflict_risk_index: number;
  risk_reason: string;
  used_doc_ids: number[];
}

export interface HearingPipelineData {
  candidate_jibun: string;
  candidate_lat: number;
  candidate_lng: number;
  facility_type: string;
  intensity_level: string;
  ahp_weights: Record<string, number>;
  timestamp: string;
  debate_logs?: DebateLogItem[];
  scenarios: ScenarioItem[];
  conflict_sensitivity_score?: number;
  conflict_factors?: Record<string, number>;
}
