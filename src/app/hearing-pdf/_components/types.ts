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
  candidate_address?: string;
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

/**
 * 공문서 날짜 표기 표준 (2025/2026 행정업무운영 편람)
 * YYYY. M. D. (연·월·일 뒤 온점 및 띄어쓰기)
 */
export function formatOfficialDate(tsStr: string): string {
  try {
    const date = new Date(tsStr);
    if (isNaN(date.getTime())) return tsStr;
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
  } catch {
    return tsStr;
  }
}

/**
 * 공문서 시간 표기 표준: 24시각제 (HH:MM)
 */
export function formatOfficialTime(tsStr: string): string {
  try {
    const date = new Date(tsStr);
    if (isNaN(date.getTime())) return "17:21";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "17:21";
  }
}
