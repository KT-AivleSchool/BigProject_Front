import React from 'react';

export function SimulationModal({
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
            {simMode === 'all' ? "* 모든 후보지의 모의 토론이 독립 채널을 통해 동시 진행됩니다." : `도로점용료 예상액: ₩ ${Math.round(selectedParcel[simTarget].area * selectedParcel[simTarget].price * 0.02 * (365/365)).toLocaleString()} / 년`}
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

export function LoginModal({
  showLoginModal,
  setShowLoginModal,
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  username,
  setUsername,
  department,
  setDepartment,
  handleLogin,
  handleRegister
}) {
  if (!showLoginModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-glass-crisp">
      <div className="w-[400px] glass-panel-deep p-6 flex flex-col gap-4 rounded-2xl">
        <div className="flex justify-between items-center border-b border-hairline pb-3">
          <h3 className="text-sm font-semibold text-ink">
            {authMode === 'login' ? '🔑 도시행정망 실무자 인증' : '📝 신규 실무자 계정 등록'}
          </h3>
          <button 
            onClick={() => {
              setShowLoginModal(false);
              setEmail('');
              setPassword('');
              setUsername('');
            }} 
            className="text-ink-secondary hover:text-ink text-lg font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="flex gap-2 border-b border-hairline pb-3">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setPassword('');
            }}
            className={`flex-1 text-[11px] py-2 rounded-lg font-semibold transition-all cursor-pointer border ${
              authMode === 'login' 
                ? 'bg-primary/10 text-primary border-primary/20' 
                : 'bg-transparent text-ink-secondary hover:text-ink border-transparent'
            }`}
          >
            로그인 모드
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setPassword('');
            }}
            className={`flex-1 text-[11px] py-2 rounded-lg font-semibold transition-all cursor-pointer border ${
              authMode === 'register' 
                ? 'bg-primary/10 text-primary border-primary/20' 
                : 'bg-transparent text-ink-secondary hover:text-ink border-transparent'
            }`}
          >
            회원가입 모드
          </button>
        </div>

        <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-ink-secondary">소속 자치구 / 부서</span>
            <select 
              value={department} 
              onChange={(e) => setDepartment(e.target.value)}
              className="text-input-notion w-full"
            >
              <option value="용산구 스마트도시과">용산구 스마트도시과</option>
              <option value="용산구 도시계획과">용산구 도시계획과</option>
              <option value="용산구 보건위생과">용산구 보건위생과</option>
            </select>
          </div>

          {authMode === 'register' && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-ink-secondary">실무자 이름</span>
              <input 
                type="text" 
                placeholder="홍길동 주무관"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="text-input-notion"
              />
            </div>
          )}

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-ink-secondary">행정 이메일</span>
            <input 
              type="email" 
              placeholder="admin@yongsan.go.kr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-input-notion"
            />
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-ink-secondary">행정망 비밀번호</span>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-input-notion"
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full text-xs py-2.5"
          >
            {authMode === 'login' ? '행정망 접속 승인' : '신규 실무자 등록 신청'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function RegulationModal({
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
