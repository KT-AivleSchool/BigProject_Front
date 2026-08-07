import React from "react";
import { formatOfficialDate } from "./types";

interface PdfReportHeaderProps {
  facilityType: string;
  formattedDate: string;
  timestamp: string;
}

export function PdfReportHeader({ facilityType, timestamp }: PdfReportHeaderProps) {
  const officialDate = formatOfficialDate(timestamp);
  const docNumber = `입지심의과-${timestamp.substring(0, 4)}호`;

  return (
    <header className="border-b-2 border-slate-900 pb-6 mb-8 text-xs text-slate-800">
      {/* [두문 (Head)] 표준 공문서 레이아웃 */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
        <span className="text-base font-extrabold text-slate-900 tracking-wider">
          스 마 트 시 티   입 지 심 의 위 원 회
        </span>
        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          대국민공개
        </span>
      </div>

      <div className="space-y-1 mb-4 text-slate-700">
        <div><strong className="w-12 inline-block text-slate-500">수신</strong> 내부결재</div>
        <div><strong className="w-12 inline-block text-slate-500">(경유)</strong></div>
        <div className="pt-2 text-sm font-bold text-slate-900">
          <strong className="w-12 inline-block text-slate-500 font-normal text-xs">제목</strong>
          2026년 {facilityType} 설치 입지 심의 및 평가 결과 보고
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600">
        1. 관련: 스마트시티 입지선정정책과-2026호({officialDate})<br />
        2. 위 관련과 관련하여 2026년도 {facilityType} 설치 대상지 선정을 위한 모의 심의 및 입지 평가 결과를 다음과 같이 보고합니다.
      </div>
    </header>
  );
}
