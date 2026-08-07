import React from "react";
import { FileText, AlertTriangle } from "lucide-react";
import { ScenarioItem } from "./types";

interface ScenarioEvaluationSectionProps {
  scenarios: ScenarioItem[];
}

export function ScenarioEvaluationSection({ scenarios }: ScenarioEvaluationSectionProps) {
  if (!scenarios || scenarios.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2 border-l-4 border-blue-600 pl-3">
        <FileText size={16} className="text-blue-600" />
        나. 시나리오 심의 평가 및 종합 의견
      </h2>

      {scenarios.map((sc, idx) => (
        <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-4">
          <div className="bg-slate-900 text-white px-5 py-3 flex justify-between items-center text-xs">
            <span className="font-bold text-sm">1) 시나리오 {sc.scenario} ({sc.scenario_description})</span>
            <div className="flex items-center gap-4">
              <span>최종 수용도: <strong className="text-blue-400">{sc.final_acceptance_score}</strong></span>
              <span>갈등위험지수: <strong className="text-red-400">{sc.conflict_risk_index}점</strong></span>
            </div>
          </div>

          <div className="p-5 space-y-4 text-xs leading-relaxed">
            <div>
              <h3 className="font-bold text-slate-700 mb-1 text-xs">가) 심의 종합 요약</h3>
              <p className="bg-white p-3.5 rounded-lg border border-slate-200 text-slate-800 font-medium">
                {sc.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-500 mb-1">나) 협상 및 수용도 평가 사유</h4>
                <p className="text-slate-700">{sc.reason}</p>
              </div>
              <div className="bg-red-50/50 p-3.5 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-700 mb-1 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  다) 갈등 위험 요소 (수용 불가 조건)
                </h4>
                <p className="text-red-900">{sc.risk_reason}</p>
              </div>
            </div>

            {sc.used_doc_ids && sc.used_doc_ids.length > 0 && (
              <div className="text-slate-400 text-[11px]">
                라) 참조 관련 조례/문서 ID: {sc.used_doc_ids.join(", ")}
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
