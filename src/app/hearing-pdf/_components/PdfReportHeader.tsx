import React from "react";

interface PdfReportHeaderProps {
  facilityType: string;
  formattedDate: string;
  timestamp: string;
}

export function PdfReportHeader({ facilityType, formattedDate, timestamp }: PdfReportHeaderProps) {
  const docNumber = `REPORT-${timestamp.substring(0, 10).replace(/-/g, "")}`;

  return (
    <header className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-start">
      <div>
        <div className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded mb-2">
          입지 심의 제출용 보고서
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {facilityType} 설치 입지 심의 및 평가 보고서
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          발행일시: {formattedDate} | 문서번호: {docNumber}
        </p>
      </div>
      <div className="text-right hidden sm:block">
        <span className="text-xs text-slate-400 block font-mono">CONFIDENTIAL</span>
        <span className="text-sm font-bold text-slate-700">입지분석 파이프라인 v2</span>
      </div>
    </header>
  );
}
