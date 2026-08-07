import React from "react";
import { MapPin } from "lucide-react";

interface CandidateInfoSectionProps {
  candidateJibun: string;
  facilityType: string;
  lat: number;
  lng: number;
  intensityLevel: string;
}

export function CandidateInfoSection({
  candidateJibun,
  facilityType,
  lat,
  lng,
  intensityLevel
}: CandidateInfoSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2 border-l-4 border-blue-600 pl-3">
        <MapPin size={16} className="text-blue-600" />
        가. 후보지 기본 정보
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div>
          <span className="text-slate-400 block mb-1">1) 후보지 명칭</span>
          <strong className="text-slate-900 text-sm font-bold">{candidateJibun}</strong>
        </div>
        <div>
          <span className="text-slate-400 block mb-1">2) 시설 유형</span>
          <strong className="text-slate-900 text-sm font-bold">{facilityType}</strong>
        </div>
        <div>
          <span className="text-slate-400 block mb-1">3) 위경도 좌표</span>
          <span className="font-mono text-slate-700">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block mb-1">4) 수요 강도 수준</span>
          <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold text-xs">
            {intensityLevel}
          </span>
        </div>
      </div>
    </section>
  );
}
