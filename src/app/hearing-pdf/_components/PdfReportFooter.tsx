import React from "react";
import { formatOfficialDate } from "./types";

interface PdfReportFooterProps {
  timestamp?: string;
}

export function PdfReportFooter({ timestamp = "2026-08-06T17:21:13.783284" }: PdfReportFooterProps) {
  const officialDate = formatOfficialDate(timestamp);

  return (
    <footer className="mt-12 pt-6 border-t-2 border-slate-900 text-xs text-slate-700">
      {/* [결문 (Tail)] 표준 공문서 발신 명의 및 결재선 구조 */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-widest">
          스 마 트 시 티   입 지 심 의 위 원 장
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-[11px] leading-relaxed">
        <div className="space-y-1">
          <div><span className="text-slate-400">결재정보:</span> 담당자 홍길동 | 팀장 김철수 | 과장 이영희</div>
          <div><span className="text-slate-400">시행번호:</span> 입지심의과-2026호 ({officialDate})</div>
        </div>
        <div className="space-y-1 sm:text-right">
          <div><span className="text-slate-400">주소:</span> 우 03187 서울특별시 종로구 세종대로 209</div>
          <div><span className="text-slate-400">연락처:</span> 전화 02-123-4567 | 이메일 omnisite@korea.kr</div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
        <span>본 심의 보고서는 「행정업무의 운영 및 혁신에 관한 규정」에 따라 작성된 공식 문서입니다.</span>
        <span>Copyright © 2026 OmniSite Platform. All rights reserved.</span>
      </div>
    </footer>
  );
}
