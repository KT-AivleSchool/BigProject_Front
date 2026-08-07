import React from "react";
import { formatOfficialDate } from "./types";

interface PdfReportHeaderProps {
  facilityType: string;
  formattedDate: string;
  timestamp: string;
}

export function PdfReportHeader({ facilityType, timestamp }: PdfReportHeaderProps) {
  const officialDate = formatOfficialDate(timestamp);

  return (
    <header className="border-b-2 border-black pb-4 mb-6 text-xs text-black">
      {/* 두문 (Head) - 이모지 및 색상 전면 배제 */}
      <div className="flex justify-between items-center border-b border-black pb-2 mb-4">
        <span className="text-lg font-bold text-black tracking-widest">
          스 마 트 시 티   입 지 심 의 위 원 회
        </span>
        <span className="text-xs text-black border border-black px-2 py-0.5">
          대국민공개
        </span>
      </div>

      <div className="space-y-1 mb-4">
        <div><span className="w-16 inline-block font-semibold">수신</span> 내부결재</div>
        <div><span className="w-16 inline-block font-semibold">(경유)</span></div>
        <div className="pt-2 text-sm font-bold">
          <span className="w-16 inline-block font-normal text-xs">제목</span>
          2026년 {facilityType} 설치 입지 심의 및 평가 결과 보고
        </div>
      </div>

      <div className="border border-black p-3 text-xs leading-relaxed">
        1. 관련: 스마트시티 입지선정정책과-2026호({officialDate})<br />
        2. 위 관련과 관련하여 2026년도 {facilityType} 설치 대상지 선정을 위한 모의 심의 및 입지 평가 결과를 다음과 같이 보고합니다.
      </div>
    </header>
  );
}
