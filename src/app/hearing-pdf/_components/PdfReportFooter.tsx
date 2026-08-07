import React from "react";

export function PdfReportFooter() {
  return (
    <footer className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500">
      <div className="flex justify-between items-end">
        <div>
          <p>본 심의 보고서는 AI 모의 심의 파이프라인 엔진에 의해 산출된 지표 기반 제출용 자료입니다.</p>
          <p className="mt-1 text-slate-400">Copyright © 2026 BigProject. All rights reserved.</p>
        </div>
        <div className="text-right border-l border-slate-200 pl-6">
          <p className="font-bold text-slate-800 mb-6">심의 제출 확인인</p>
          <div className="border-b border-slate-400 w-32 ml-auto mb-1"></div>
          <p className="text-[10px] text-slate-400">(인 또는 서명)</p>
        </div>
      </div>
    </footer>
  );
}
