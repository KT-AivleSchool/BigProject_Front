import React from 'react';

export default function SimulationModal({
  showSimModal,
  setShowSimModal,
  simMode,
  simTarget,
  selectedParcel,
  simLogs,
  isSimulating,
  simEndRefTop1,
  simEndRefTop2,
  simEndRefTop3,
  setPipelineStep
}) {
  if (!showSimModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-glass-crisp animate-fadeIn">
      <div className={`${simMode === 'all' ? 'w-[1180px]' : 'w-[800px]'} h-[580px] glass-panel-deep p-6 flex flex-col justify-between rounded-2xl transition-all duration-500`}>
        <div className="flex justify-between items-center border-b border-hairline pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">OMS-01-03-001 | AI 에이전트 실시간 모의 심의 토론</h3>
            <p className="text-[10px] text-ink-secondary">
              {simMode === 'all' ? "3개 추천 후보지 동시 일괄 시뮬레이션 실행" : `Target PNU: ${selectedParcel[simTarget].pnu}`}
            </p>
          </div>
          <button 
            onClick={() => setShowSimModal(false)}
            className="text-ink-secondary hover:text-ink text-lg font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 my-4 flex gap-4 overflow-hidden h-[380px]">
          {simMode === 'all' ? (
            ['top1', 'top2', 'top3'].map(tab => (
              <div key={tab} className="flex-1 flex flex-col gap-1.5 h-full">
                <span className="text-[10px] font-bold text-ink-secondary truncate">
                  [{tab.toUpperCase()}] {selectedParcel[tab].jibun.split(' ')[0]} ...
                </span>
                <div className="flex-1 bg-secondary rounded-xl p-3 overflow-y-auto font-mono text-[10px] flex flex-col gap-2.5 border border-indigo-950 shadow-inner text-white">
                  {simLogs[tab].map((log, index) => (
                    <div key={index} className="flex flex-col gap-0.5 border-b border-white/5 pb-1">
                      <span className={`font-semibold shrink-0 ${
                        log.sender.startsWith('시스템') ? 'text-cyan-300' :
                        log.sender.includes('반대') ? 'text-rose-300' :
                        log.sender.includes('찬성') ? 'text-emerald-300' : 'text-indigo-200'
                      }`}>
                        [{log.sender}]
                      </span>
                      <span className="text-gray-200 leading-relaxed">{log.text}</span>
                    </div>
                  ))}
                  {isSimulating && simLogs[tab].length === 0 && (
                    <div className="text-indigo-300 animate-pulse">심의 연결 대기 중...</div>
                  )}
                  {isSimulating && simLogs[tab].length > 0 && (
                    <div className="text-indigo-200 animate-pulse text-[9px]">● 에이전트 분석 진행 중...</div>
                  )}
                  <div ref={tab === 'top1' ? simEndRefTop1 : tab === 'top2' ? simEndRefTop2 : simEndRefTop3} />
                </div>
              </div>
            ))
          ) : (
            <div className="flex-1 flex flex-col gap-1.5 h-full">
              <span className="text-[10px] font-bold text-ink-secondary">
                [{simTarget.toUpperCase()}] {selectedParcel[simTarget].jibun}
              </span>
              <div className="flex-1 bg-secondary rounded-xl p-4 overflow-y-auto font-mono text-xs flex flex-col gap-3 border border-indigo-950 shadow-inner text-white">
                {simLogs[simTarget].map((log, index) => (
                  <div key={index} className="flex gap-2">
                    <span className={`font-semibold shrink-0 ${
                      log.sender.startsWith('시스템') ? 'text-cyan-300' :
                      log.sender.includes('반대') ? 'text-rose-300' :
                      log.sender.includes('찬성') ? 'text-emerald-300' : 'text-indigo-200'
                    }`}>
                      [{log.sender}]
                    </span>
                    <span className="text-gray-100">{log.text}</span>
                  </div>
                ))}
                {isSimulating && (
                  <div className="text-indigo-200 animate-pulse">... 에이전트 심의 분석 진행 중 ...</div>
                )}
                <div ref={simTarget === 'top1' ? simEndRefTop1 : simTarget === 'top2' ? simEndRefTop2 : simEndRefTop3} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center border-t border-hairline pt-3">
          <span className="text-[10px] text-ink-secondary">
            {simMode === 'all' ? "* 모든 후보지의 모의 토론이 독립 채널을 동시 진행됩니다." : `도로점용료 예상액: ₩ ${Math.round(selectedParcel[simTarget].area * selectedParcel[simTarget].price * 0.02 * (365/365)).toLocaleString()} / 년`}
          </span>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSimModal(false);
                setPipelineStep(5);
              }}
              disabled={isSimulating}
              className="btn-primary text-xs px-6 py-2.5 disabled:opacity-40"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
