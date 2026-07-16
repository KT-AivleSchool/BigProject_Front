import React from 'react';

export default function WizardPanel({
  activeView,
  pipelineStep,
  setPipelineStep,
  isAuditComplete,
  triggerFileAudit,
  injectMockData,
  uploadedFiles,
  auditReason,
  userIntent,
  setUserIntent,
  hitlJibun,
  setHitlJibun,
  hitlLng,
  setHitlLng,
  hitlLat,
  setHitlLat,
  ahpWeights,
  crValue,
  isAhpLocked,
  handleSliderChange,
  setIsAhpLocked,
  activeTab,
  setActiveTab,
  selectedParcel,
  runSingleSimulation,
  handleHitlCommit,
  handleAhpLock,
  runAllSimulation,
  handleDownloadPdf
}) {
  if (activeView !== 'map') return null;

  return (
    <div 
      className={`fixed z-40 rounded-2xl text-glass-crisp shadow-2xl glass-panel-deep p-6 flex flex-col justify-between transition-all duration-700 ease-in-out ${
        pipelineStep >= 2
          ? 'top-20 left-[calc(100%-504px)] translate-x-0 translate-y-0 w-[480px] h-[calc(100vh-110px)] max-h-[85vh]'
          : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] max-w-[95vw] h-[480px]'
      }`} 
      style={{ background: 'rgba(255, 255, 255, 0.94)' }}
    >
      <div className="flex justify-between items-start border-b border-hairline pb-3 flex-none">
        <div>
          <h2 className="text-sm font-bold text-ink mb-0.5">
            {pipelineStep === 1 && "Step 1. 파일 업로드"}
            {pipelineStep === 2 && "Step 2. 데이터 승인"}
            {pipelineStep === 3 && "Step 3. AHP 가중치 락"}
            {pipelineStep === 4 && "Step 4. AI 토론"}
            {pipelineStep === 5 && "Step 5. 보고서 발급"}
          </h2>
          <p className="text-[10px] text-ink-secondary">
            {pipelineStep === 1 && "CSV 데이터셋 파일을 업로드하고 AI 감리를 진행합니다."}
            {pipelineStep === 2 && "공간 위치와 의사결정 탐색 의도를 보정하고 최종 승인합니다."}
            {pipelineStep === 3 && "AHP 쌍대비교 상대 가중치를 조정하고 확정합니다."}
            {pipelineStep === 4 && "추천 후보지의 분석 내용과 대중교통 영향 및 갈등 지수를 검토합니다."}
            {pipelineStep === 5 && "AI 주무관 에이전트 간의 갈등 조정 토론을 실시하고 타당성 보고서를 발급받습니다."}
          </p>
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold shrink-0">
          Step {pipelineStep} / 5
        </span>
      </div>

      <div className="flex-1 py-2 my-1 flex flex-col gap-4">
        {/* Step 1 내용 */}
        {pipelineStep === 1 && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-ink-secondary">CSV 데이터셋 & RAG 법규 PDF 수집</label>
              <span className="text-[10px] text-primary font-mono font-medium">CSV 및 PDF 파일 통합 지원</span>
            </div>
            {!isAuditComplete ? (
              <div className="flex flex-col gap-2">
                <div 
                  onClick={triggerFileAudit}
                  className="border-2 border-dashed border-hairline hover:border-primary rounded-xl p-8 text-center cursor-pointer transition-all bg-white/40 hover:bg-white/60"
                >
                  <p className="text-xs text-ink font-semibold">📁 분석 CSV 및 RAG 법규 PDF 파일 일괄 드래그앤드롭</p>
                  <p className="text-[10px] text-ink-secondary mt-1">AI 감리 및 법률 규제 인코딩 일괄 수행</p>
                </div>
                <button
                  onClick={injectMockData}
                  className="text-[10px] text-primary hover:underline font-semibold text-center py-1 cursor-pointer"
                >
                  💡 테스트용 목업 데이터 원클릭 주입하기
                </button>
              </div>
            ) : (
              <div className="bg-white/50 p-4 rounded-xl border border-hairline grid grid-cols-2 gap-4 h-[160px] items-center">
                <div className="text-[11px] flex flex-col gap-1.5 text-ink leading-relaxed border-r border-hairline pr-3 max-h-[140px] overflow-y-auto">
                  <span className="text-primary font-bold">✓ 업로드된 파일 ({uploadedFiles.length}개)</span>
                  <div className="flex flex-col gap-1 mt-1 pr-1">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-100 p-1 px-2 rounded border border-hairline text-[9px]">
                        <span className="truncate max-w-[170px] font-medium">{file.name}</span>
                        <span className={`text-[8px] px-1 rounded font-mono font-bold ${file.type === 'CSV' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{file.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-[11px] flex flex-col gap-1 text-ink leading-relaxed pl-1 max-h-[140px] overflow-y-auto pr-1">
                  <span className="text-primary font-bold">✓ AI 통합 사전 감리 결과</span>
                  <p className="text-[10px] leading-relaxed"><strong className="text-ink-secondary">감리 사유:</strong> {auditReason}</p>
                  <p className="text-[10px] leading-relaxed"><strong className="text-ink-secondary">추출 의도:</strong> {userIntent}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {pipelineStep === 2 && (
          <div className="bg-white/50 p-4 rounded-xl border border-hairline flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              {/* Left Column: Intent Correction */}
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-ink-secondary font-semibold">1. 정보 탐색 의도 및 목적 수정</span>
                <textarea 
                  rows={3}
                  value={userIntent} 
                  onChange={(e) => setUserIntent(e.target.value)} 
                  className="text-input-notion resize-none leading-relaxed w-full h-[75px]"
                />
                <span className="text-[9px] text-ink-secondary">* 의도 데이터는 로컬 브라우저 세션에만 보안 격리 저장됩니다.</span>
              </div>
              {/* Right Column: Address/Coordinates */}
              <div className="flex flex-col gap-2 text-xs border-t border-hairline pt-2.5">
                <span className="text-[11px] text-ink-secondary font-semibold">2. 공간 좌표 및 임시 지번 보정</span>
                <div className="flex flex-col gap-1">
                  <span className="text-ink-secondary">지번 주소</span>
                  <input 
                    type="text" 
                    value={hitlJibun} 
                    onChange={(e) => setHitlJibun(e.target.value)} 
                    className="text-input-notion w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-ink-secondary">경도(Lng)</span>
                    <input type="number" step="0.000001" value={hitlLng} onChange={(e) => setHitlLng(parseFloat(e.target.value))} className="text-input-notion" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-ink-secondary">위도(Lat)</span>
                    <input type="number" step="0.000001" value={hitlLat} onChange={(e) => setHitlLat(parseFloat(e.target.value))} className="text-input-notion" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 내용 */}
        {pipelineStep === 3 && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-ink-secondary">AHP 인자별 상대 가중치</label>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold transition-all ${Object.keys(ahpWeights).length === 0 ? 'bg-ink-secondary/10 text-ink-secondary' : crValue < 0.1 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                C.R. = {Object.keys(ahpWeights).length === 0 ? '-' : crValue} ({Object.keys(ahpWeights).length === 0 ? '대기' : crValue < 0.1 ? '만족' : '위배'})
              </span>
            </div>
            <div className="flex flex-col gap-3.5 bg-white/40 p-4 rounded-xl border border-hairline max-h-[280px] overflow-y-auto pr-1">
              {Object.keys(ahpWeights).map(key => (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-ink-secondary">
                    <span className="font-medium">{key}</span>
                    <span className="font-mono text-ink font-semibold">{ahpWeights[key]}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="9"
                    disabled={isAhpLocked || pipelineStep !== 3}
                    value={ahpWeights[key]}
                    onChange={(e) => handleSliderChange(key, e.target.value)}
                    className="w-full accent-primary cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 & 5 내용 (의사결정 보조 및 토론/보고서 영역) */}
        {pipelineStep >= 4 && (
          <div className="flex flex-col gap-3">
            {/* Top 1 ~ Top 3 탭 (각 후보지의 실시간 심의 상태 배지 추가) */}
            <div className="flex bg-gray-200/50 p-1 rounded-lg border border-hairline flex-none">
              {['top1', 'top2', 'top3'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-all flex items-center justify-center gap-1 ${activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
                >
                  {tab.toUpperCase()}
                  {selectedParcel[tab].simulated ? (
                    <span className="text-[8px] px-1 py-0.2 rounded-full font-bold bg-emerald-500/20 text-emerald-700">완료</span>
                  ) : (
                    <span className="text-[8px] px-1 py-0.2 rounded-full font-bold bg-gray-300/40 text-ink-secondary">대기</span>
                  )}
                </button>
              ))}
            </div>

            {pipelineStep === 5 ? (
              <div className="flex flex-col gap-2.5 animate-fadeIn">
                {/* 최종 단계 심의 합의 안내 카드 */}
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/50 flex items-center gap-2 text-xs text-emerald-800">
                  <span className="text-base">📄</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-[11px]">AI 모의 심의 타당성 검토 완료</span>
                    <p className="text-[9px] text-emerald-700 leading-normal">
                      아래 종합 비교 대조표를 확인하고 필요한 후보지의 행정용 PDF 보고서를 다운로드 하십시오.
                    </p>
                  </div>
                </div>
                {/* 종합 비교 대조표 (3개 후보지의 면적, CSS, 심의여부 등 한눈에 비교 가능) */}
                <div className="bg-white/50 border border-hairline rounded-xl overflow-hidden flex flex-col">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-gray-100/80 text-ink-secondary border-b border-hairline font-bold">
                        <th className="p-2">후보지</th>
                        <th className="p-2">소유/지번</th>
                        <th className="p-2 text-right">면적(㎡)</th>
                        <th className="p-2 text-center">갈등지수(CSS)</th>
                        <th className="p-2 text-center">심의결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['top1', 'top2', 'top3'].map(tab => {
                        const p = selectedParcel[tab];
                        return (
                          <tr key={tab} className={`border-b border-hairline/50 hover:bg-gray-50/50 transition-colors ${activeTab === tab ? 'bg-primary/5 font-semibold' : ''}`}>
                            <td className="p-2 font-bold text-primary">{tab.toUpperCase()}</td>
                            <td className="p-2 truncate max-w-[120px]" title={p.jibun}>{p.jibun}</td>
                            <td className="p-2 text-right font-mono">{p.area} ㎡</td>
                            <td className="p-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                p.cssGrade === '상' ? 'bg-rose-500/10 text-rose-600' :
                                p.cssGrade === '중' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                              }`}>
                                {p.cssGrade} ({p.css}점)
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              {p.simulated ? (
                                <span className="text-emerald-600 font-bold">합의 완료</span>
                              ) : (
                                <span className="text-gray-400">미진행</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 animate-fadeIn">
                {/* Left Column: Properties */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-ink-secondary">추천지 속성 정보</span>
                  <div className="bg-white/50 p-3 rounded-xl border border-hairline flex flex-col gap-2 h-[135px] justify-between">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-secondary">지번 / 소유 구분</span>
                      <span className="text-ink font-semibold truncate max-w-[180px]">{selectedParcel[activeTab].jibun}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-secondary">면적(㎡)</span>
                      <span className="font-mono text-ink font-semibold">{selectedParcel[activeTab].area} ㎡</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-secondary">공시지가</span>
                      <span className="font-mono text-primary font-semibold">₩ {selectedParcel[activeTab].price.toLocaleString()} / ㎡</span>
                    </div>
                    <div className="flex justify-between text-[10px] border-t border-hairline pt-1.5 text-ink-secondary font-mono">
                      <span>좌표: {selectedParcel[activeTab].lat}, {selectedParcel[activeTab].lng}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Conflict */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-ink-secondary">지역 갈등 민감도 (CSS)</span>
                  <div className="bg-white/50 p-3 rounded-xl border border-hairline flex flex-col gap-3 h-[135px] justify-center">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-ink-secondary">갈등 지수</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedParcel[activeTab].cssGrade === '상' ? 'bg-rose-500/10 text-rose-600' :
                        selectedParcel[activeTab].cssGrade === '중' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        등급: {selectedParcel[activeTab].cssGrade} ({selectedParcel[activeTab].css}점)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${
                        selectedParcel[activeTab].cssGrade === '상' ? 'bg-rose-500' :
                        selectedParcel[activeTab].cssGrade === '중' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`} style={{ width: `${selectedParcel[activeTab].css}%` }} />
                    </div>
                    <p className="text-[9px] text-ink-secondary mt-1 leading-relaxed">
                      * 주민 민원 가능성 및 교육/의료시설 반경 인접도를 수치화한 갈등 지표입니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 내비게이션 컨트롤 */}
      <div className="flex flex-col border-t border-hairline pt-3 mt-1 flex-none">
        {pipelineStep === 4 && (
          <div className="flex gap-2 w-full justify-center mb-2.5">
            {['top1', 'top2', 'top3'].map(tab => (
              <button
                key={tab}
                onClick={() => runSingleSimulation(tab)}
                className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[10px] py-1.5 font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 truncate cursor-pointer"
                title={`${tab.toUpperCase()} 후보지 개별 심의 실행`}
              >
                {tab.toUpperCase()} 개별 심의
                {selectedParcel[tab].simulated && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center w-full">
          {pipelineStep > 1 ? (
            <button 
              onClick={() => setPipelineStep(prev => Math.max(1, prev - 1))}
              className="btn-secondary text-xs py-1.5 w-[70px] text-center whitespace-nowrap shrink-0"
            >
              ◀ 이전
            </button>
          ) : (
            <div className="w-[70px] shrink-0" />
          )}

          <div className="flex-1 flex justify-center px-2">
            {pipelineStep === 1 && (
              <span className="text-[10px] text-ink-secondary font-bold">
                CSV 파일을 업로드한 뒤 다음 단계로 이동하세요
              </span>
            )}
            {pipelineStep === 2 && (
              <button 
                onClick={handleHitlCommit}
                className="btn-primary bg-amber-500 hover:bg-amber-600 text-xs py-1.5 w-[170px] rounded-lg font-semibold truncate"
              >
                데이터 확정
              </button>
            )}
            {pipelineStep === 3 && (
              <div className="flex gap-1.5">
                <button
                  onClick={handleAhpLock}
                  disabled={crValue >= 0.1 || Object.keys(ahpWeights).length === 0}
                  className="btn-primary text-xs py-1.5 w-[170px] font-semibold disabled:opacity-30 rounded-lg truncate"
                >
                  🔒 가중치 확정
                </button>
                {isAhpLocked && (
                  <button
                    onClick={() => {
                      setIsAhpLocked(false);
                      setPipelineStep(3);
                      alert("AHP 가중치 잠금이 해제되었습니다.");
                    }}
                    className="btn-secondary text-[11px] py-1.5 px-2 rounded-lg"
                  >
                    🔓 해제
                  </button>
                )}
              </div>
            )}
            {pipelineStep === 4 && (
              <button 
                onClick={runAllSimulation}
                className="btn-primary text-xs py-1.5 w-[170px] rounded-lg font-semibold shadow-md truncate"
                title="3개 추천 후보지 일괄 시뮬레이션 동시 실행"
              >
                모든 조건 심의 실행
              </button>
            )}
            {pipelineStep === 5 && (
              <button 
                onClick={handleDownloadPdf}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs py-1.5 w-[170px] rounded-lg font-semibold shadow-md truncate"
                title="WeasyPrint PDF 보고서 다운로드"
              >
                📝 PDF 다운로드
              </button>
            )}
          </div>

         {pipelineStep < 5 ? (
           <button 
             onClick={() => setPipelineStep(prev => Math.max(1, Math.min(5, prev + 1)))}
             className="text-xs py-1.5 w-[70px] text-center whitespace-nowrap shrink-0 transition-all rounded-lg btn-primary bg-primary text-white shadow-md hover:scale-105 active:scale-95 animate-pulse"
           >
             다음 ▶
           </button>
         ) : (
          <div className="w-[70px] shrink-0" />
        )}
        </div>
      </div>
    </div>
  );
}
