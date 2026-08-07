import React, { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";

interface AhpWeightSectionProps {
  ahpWeights: Record<string, number>;
}

export function AhpWeightSection({ ahpWeights }: AhpWeightSectionProps) {
  const sortedAhpWeights = useMemo(() => {
    return Object.entries(ahpWeights).sort((a, b) => b[1] - a[1]);
  }, [ahpWeights]);

  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2 border-l-4 border-blue-600 pl-3">
        <CheckCircle2 size={16} className="text-blue-600" />
        다. AHP 지표별 가중치 분석 (수요 및 제한 요소)
      </h2>
      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs mb-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold">
              <th className="py-2.5 px-4">평가 지표 및 설명</th>
              <th className="py-2.5 px-4 w-36 text-right">가중치 (Weight)</th>
              <th className="py-2.5 px-4 w-44">시각화</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedAhpWeights.map(([indicator, weight], idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 text-slate-800 leading-snug">
                  {idx + 1}) {indicator}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700">
                  {(weight * 100).toFixed(1)}% ({weight.toFixed(2)})
                </td>
                <td className="py-2.5 px-4">
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(weight * 500, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 붙임 및 끝. 규정 100% 반영 */}
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 flex justify-between items-center">
        <span>붙임  1. 입지분석 데이터 및 AHP 산출 내역서 1부.  끝.</span>
      </div>
    </section>
  );
}
