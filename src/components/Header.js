import React from 'react';

export default function Header({
  setIsSidebarOpen,
  setActiveView,
  setPipelineStep,
  activeView,
  pipelineStep,
  isLoggedIn,
  department,
  municipalId,
  setShowLoginModal
}) {
  return (
    <header className="absolute top-0 left-0 right-0 h-16 glass-panel rounded-none border-t-0 border-x-0 border-b border-hairline z-50 px-8 flex justify-between items-center text-glass-crisp">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsSidebarOpen(prev => !prev)}
          className="text-ink hover:text-primary text-xl font-bold cursor-pointer p-1 transition-colors mr-1"
          title="메뉴 토글"
        >
          ☰
        </button>
        <div
          onClick={() => {
            setActiveView('map');
            setPipelineStep(1);
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-all"
          title="홈 화면으로 이동"
        >
          <span className="text-xl font-bold tracking-tight text-primary">OmniSite</span>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 font-medium">B2G SDSS v1.0</span>
        </div>
      </div>

      {/* 5단계 프로세스 시각화 (Header Steps Indicator) */}
      {activeView === 'map' && (
        <div className="hidden md:flex items-center gap-2 text-[11px] font-medium bg-white/50 border border-hairline px-4 py-1.5 rounded-full shadow-sm">
          {[
            { step: 1, label: '파일 업로드' },
            { step: 2, label: '데이터 승인' },
            { step: 3, label: '가중치 조정' },
            { step: 4, label: '시뮬레이션' },
            { step: 5, label: '결과 확인' }
          ].map((item, idx) => {
            const isCompleted = item.step < pipelineStep;
            const isCurrent = item.step === pipelineStep;
            return (
              <React.Fragment key={item.step}>
                <div
                  onClick={() => {
                    if (isCompleted) {
                      setPipelineStep(item.step);
                    }
                  }}
                  className={`flex items-center gap-1.5 ${isCompleted ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                  title={isCompleted ? `${item.label} (Step ${item.step}) 단계로 이동` : undefined}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                    isCurrent
                      ? 'bg-primary text-white scale-110 shadow-sm'
                      : isCompleted
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-gray-200/60 text-ink-secondary'
                    }`}>
                    {isCompleted ? '✓' : item.step}
                  </span>
                  <span className={isCurrent ? 'text-primary font-bold' : isCompleted ? 'text-emerald-700 font-medium' : 'text-ink-secondary'}>
                    {item.label}
                  </span>
                </div>
                {idx < 4 && (
                  <span className="text-gray-300 mx-0.5">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div>
        {isLoggedIn ? (
          <span className="text-xs text-ink-secondary font-medium">{department} | {municipalId}</span>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            className="btn-primary text-xs px-4 py-1.5 font-semibold"
          >
            로그인
          </button>
        )}
      </div>
    </header>
  );
}
