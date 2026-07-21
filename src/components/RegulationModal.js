import React from 'react';

export default function RegulationModal({
  showRegulationModal,
  setShowRegulationModal,
  regulationsList,
  isUploading,
  handleRegulationUpload,
  handleRegulationDelete
}) {
  if (!showRegulationModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-glass-crisp">
      <div className="w-[550px] glass-panel-deep p-6 flex flex-col gap-5 border border-hairline rounded-2xl">
        <div className="flex justify-between items-center border-b border-hairline pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">⚖️ 법규 RAG 지식베이스 관리</h3>
            <p className="text-[10px] text-ink-secondary mt-0.5">RAG에 활용될 조례 PDF 목록을 관리하고 다중 업로드합니다.</p>
          </div>
          <button 
            onClick={() => setShowRegulationModal(false)} 
            className="text-ink-secondary hover:text-ink text-xl font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="bg-white/50 border border-hairline p-4 rounded-xl flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-semibold text-ink-secondary">조례 PDF 다중 업로드</span>
            <span className="text-[10px] text-ink-secondary font-mono">PDF 파일만 허용</span>
          </div>
          <div className="relative border-2 border-dashed border-hairline hover:border-primary rounded-lg p-5 text-center cursor-pointer transition-all bg-white/40">
            <input 
              type="file" 
              multiple 
              accept=".pdf"
              onChange={handleRegulationUpload}
              className="absolute inset-0 opacity-0 cursor-pointer" 
            />
            <p className="text-xs text-ink font-medium">📁 PDF 파일 일괄 드래그 또는 클릭</p>
            <p className="text-[10px] text-ink-secondary mt-1">동일 파일명 업로드 시 중복 방지 가드가 작동합니다.</p>
          </div>
          {isUploading && <p className="text-[10px] text-primary animate-pulse text-center">조례 분석 및 RAG 임베딩 텍스트 파싱 중...</p>}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-ink-secondary">📋 적재된 조례 목록 ({regulationsList.length}건)</span>
          <div className="max-h-[220px] overflow-y-auto bg-white/50 rounded-xl border border-hairline p-2">
            {regulationsList.length === 0 ? (
              <p className="text-center text-xs text-ink-secondary py-6">적재된 조례 문서가 없습니다.</p>
            ) : (
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-ink-secondary font-medium">
                    <th className="pb-2 pl-2">파일명</th>
                    <th className="pb-2">크기 (KB)</th>
                    <th className="pb-2 text-right pr-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {regulationsList.map((item, idx) => (
                    <tr key={idx} className="border-b border-hairline hover:bg-gray-100 text-ink">
                      <td className="py-2 pl-2 max-w-[280px] truncate" title={item.filename}>{item.filename}</td>
                      <td className="py-2">{(item.size / 1024).toFixed(1)} KB</td>
                      <td className="py-2 text-right pr-2">
                        <button 
                          onClick={() => handleRegulationDelete(item.filename)}
                          className="text-rose-500 hover:text-rose-600 font-bold hover:scale-110 transition-all cursor-pointer"
                          title="조례 및 RAG 캐시 삭제"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
