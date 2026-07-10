'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function Dashboard() {
  // 가상의 과거 의사결정 이력 데이터 (크레딧 필드 제거)
  const [historyList, setHistoryList] = useState([
    { id: 104, date: '2026-06-28', region: '서울시 용산구 한강로동', infra: '스마트 쉼터형 부스', pnuCount: 3, status: '행정 종결', auditState: '검증 완료' },
    { id: 103, date: '2026-06-15', region: '서울시 마포구 공덕동', infra: '옐로카펫 보행 정화지', pnuCount: 1, status: '행정 종결', auditState: '대기 중' },
    { id: 102, date: '2026-06-02', region: '서울시 용산구 이태원동', infra: '전기차 화재방지 충전소', pnuCount: 2, status: '심의 중', auditState: '불가능' },
    { id: 101, date: '2026-05-19', region: '서울시 서대문구 신촌동', infra: '다목적 방범 스마트부스', pnuCount: 3, status: '행정 종결', auditState: '검증 완료' }
  ]);

  // Audit AI 폼 상태
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [auditFile, setAuditFile] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [isParsing, setIsParsing] = useState(false);

  // 과거 이력 상세 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 파일 업로드 및 분석 시뮬레이션
  const handleAuditUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeHistoryId) return;

    setAuditFile(file);
    setIsParsing(true);
    setAuditResult(null);

    setTimeout(() => {
      setIsParsing(false);
      setAuditResult({
        title: '서울시 용산구 한강로동 스마트쉼터 설치 준공 고시 공문',
        mappedScenario: '시나리오 A (일반적 우호 타결)',
        matchScore: 94,
        summary: '부스 여과 필터링 시간(08시~22시) 및 인근 3.0m 소방 통로 준수 규정이 1단계 AHP 의사결정 모델 설계 가이드라인에 94% 부합하여 행정 종결 승인 완료.'
      });

      // 해당 역사 행의 검증 상태 업데이트
      setHistoryList(prev => prev.map(item => {
        if (item.id === activeHistoryId) {
          return { ...item, auditState: '검증 완료' };
        }
        return item;
      }));
    }, 2000);
  };

  // 과거 토론 로그 목업 조회
  const openHistoryDetails = (item) => {
    setSelectedHistory(item);
    setShowDetailModal(true);
  };

  const getMockDebateLogs = (infra) => {
    if (!infra) return [];
    if (infra.includes('쉼터') || infra.includes('부스')) {
      return [
        { sender: '주민대표 (반대)', text: '부스 설치 예정 필지 인근의 좁은 인도 폭 때문에 보행 통로가 협소해져 통학 어린이들의 충돌 우려 등 보행 안전이 매우 우려됩니다.' },
        { sender: '상인대표 (찬성)', text: '상가 앞 길거리 간접 흡연 및 무분별한 꽁초 투기를 전용 스마트 부스로 유도 수용하여 미관 및 보행 환경이 훨씬 개선됩니다.' },
        { sender: '공무원 (조정)', text: '보행 유효 통행 폭 3.0m를 확보하고, 정화 공조 필터 등급 사양을 강화하여 안전성 우려를 최소화하는 조건으로 최종 통과시킵니다.' }
      ];
    } else if (infra.includes('옐로카펫') || infra.includes('정화지')) {
      return [
        { sender: '주민대표 (반대)', text: '옐로카펫 보행 정화지 영역이 차량 우회전 진입로 사각지대를 가려 운전자 시야 확보를 저해할 여지가 있습니다.' },
        { sender: '상인대표 (찬성)', text: '초등학교 어린이 보호구역 내 학생들의 보행 대기 시인성을 대폭 강화하여 스쿨존 교통사고를 선제적으로 막을 수 있습니다.' },
        { sender: '공무원 (조정)', text: '신호 대기부 반사 시인성 패널 면적을 2.5㎡로 제한 조정하고 반대편에 우회전 사각지대 감시용 반사경을 병행 설치하여 합의안을 통과시킵니다.' }
      ];
    } else if (infra.includes('충전소') || infra.includes('전기차')) {
      return [
        { sender: '주민대표 (반대)', text: '지상 개방 주차 구역 인근 열화 화재 발생 시 열 폭주로 인해 인접 건물로 화염이 전이되는 리스크가 매우 큽니다.' },
        { sender: '상인대표 (찬성)', text: '소화 질식포와 차수판이 완비된 화재 방지 특화 구역을 시유지에 규격화하여 구축하는 것이 분산형 충전기 방치보다 훨씬 안전합니다.' },
        { sender: '공무원 (조정)', text: '충전소 외곽에 전용 습식 소방 라인을 확충하고 화재 감지 시 배전 3중 셧다운 연동 장치를 탑재하는 조건으로 설치 인가를 최종 의결합니다.' }
      ];
    }
    return [
      { sender: '주민대표 (반대)', text: '시설물 입지 시 인근 거주 보행 환경 및 경관 침해 요소에 대해 주민 동의가 수반되지 않았습니다.' },
      { sender: '상인대표 (찬성)', text: '스마트 인프라 도입에 따른 배후 상권 활성화 및 유동 인구 분산 편익이 월등히 높습니다.' },
      { sender: '공무원 (조정)', text: '주민 안전 요구 조례 사항을 보강 반영하고 현장 실무 보정 단계를 거쳐 의사결정을 최종 수립합니다.' }
    ];
  };

  // WeasyPrint 스타일의 HTML 행정 보고서 발급 기능 (한국어 호환용 정규 규격 문서)
  const downloadReportHTML = (item) => {
    const mockDebate = getMockDebateLogs(item.infra);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>입지 타당성 및 갈등 영향 평가 보고서</title>
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px double #111; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; margin: 0; letter-spacing: -0.5px; }
          .meta-table, .content-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .meta-table th, .meta-table td, .content-table th, .content-table td { border: 1px solid #333; padding: 10px; font-size: 12px; }
          .meta-table th, .content-table th { background-color: #f5f5f5; text-align: left; font-weight: bold; }
          .section-title { font-size: 15px; font-weight: bold; border-left: 4px solid #111; padding-left: 10px; margin: 30px 0 10px 0; }
          .log-box { background-color: #fcfcfc; border: 1px solid #ccc; padding: 15px; border-radius: 4px; }
          .log-item { margin-bottom: 12px; font-size: 11.5px; border-bottom: 1px dashed #eee; padding-bottom: 8px; }
          .log-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
          .log-sender { font-weight: bold; color: #333; }
          .footer-sign { text-align: right; margin-top: 60px; font-size: 13px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">지능형 입지 선정 및 공공갈등 타당성 평가 보고서</h1>
          <p style="font-size:11px; color:#666; margin-top: 8px;">문서번호: OMS-2026-${item.id} | 심의일자: ${item.date}</p>
        </div>
        
        <table class="meta-table">
          <tr>
            <th width="20%">의사결정 ID</th>
            <td>#${item.id}</td>
            <th width="20%">대상 지역</th>
            <td>${item.region}</td>
          </tr>
          <tr>
            <th>선택 인프라</th>
            <td>${item.infra}</td>
            <th>최종 후보지 수</th>
            <td>${item.pnuCount} 개 소</td>
          </tr>
          <tr>
            <th>행정 상태</th>
            <td>${item.status} (Audit AI 검증 필)</td>
            <th>RAG 귀속 여부</th>
            <td>RAG 세그먼트 적재 완료</td>
          </tr>
        </table>

        <div class="section-title">1. AHP 계층분석 모형 프로파일</div>
        <p style="font-size:12px; color: #333; margin-bottom: 15px;">
          본 입지는 대중교통 유동성, 불법 민원빈도, 상습 무단투기, 배후 생활인구, 청소년 안심구역 거리를 다기준 쌍대비교하여 일관성 비율(C.R. = 0.04)을 만족한 행정 최적 프로파일에 의해 도출되었습니다.
        </p>

        <div class="section-title">2. AI 에이전트(LangGraph) 모의 심의 토론 아카이브</div>
        <div class="log-box">
          ${mockDebate.map(log => `
            <div class="log-item">
              <span class="log-sender">[${log.sender}]</span>
              <span>${log.text}</span>
            </div>
          `).join('')}
        </div>

        <div class="section-title">3. 행정 점용 예산 부담액 산출 요약</div>
        <table class="content-table">
          <thead>
            <tr>
              <th width="30%">지적 점용 면적</th>
              <th width="35%">㎡당 공시지가 (선정지 기준)</th>
              <th width="35%">연간 예상 도로점용료 (법정 요율 2% 적용)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>15.0 ㎡</td>
              <td>₩ 14,200,000 / ㎡</td>
              <td style="font-weight:bold; color:#d9534f; font-size: 13px;">₩ 4,260,000 / 년</td>
            </tr>
          </tbody>
        </table>

        <p style="font-size:11px; color:#666; margin-top:-10px;">
          ※ 도로법 제61조 및 동법 시행령 제71조에 따른 점용료 요율(연간 2.0%)이 적용되었으며, 실제 시공 형태에 따라 실무자 미세 좌표(HITL) 기준으로 변경될 수 있습니다.
        </p>

        <div class="footer-sign">
          <p>서울시 자치구 행정 위임 의사결정 승인</p>
          <p style="margin-top:25px; font-size:15px; letter-spacing: 2px;">도시개발 스마트도시 분과 심의 위원회 [인]</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `스마트시티_입지타당성_보고서_${item.id}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative min-h-screen bg-canvas-soft text-ink font-sans pt-20 text-glass-crisp">
      
      {/* 1. 상단 글로벌 네비게이션 헤더 */}
      <header className="absolute top-0 left-0 right-0 h-16 glass-panel rounded-none border-t-0 border-x-0 border-b border-hairline z-50 px-8 flex justify-between items-center text-glass-crisp">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className="text-ink hover:text-primary text-xl font-bold cursor-pointer p-1 transition-colors mr-1"
            title="메뉴 토글"
          >
            ☰
          </button>
          <span className="text-xl font-bold tracking-tight text-primary">OmniSite</span>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 font-medium">B2G SDSS v1.0</span>
        </div>
        <div className="text-xs text-ink-secondary font-medium">
          행정망 인증 토큰 활성화됨
        </div>
      </header>

      {/* 1-1. 왼쪽 사이드바 (Toggleable Left Sidebar) */}
      <aside className={`fixed top-0 left-0 h-full w-64 glass-panel rounded-none border-y-0 border-l-0 border-r border-hairline z-48 p-6 flex flex-col gap-6 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} text-glass-crisp pt-20 bg-white/70`}>
        <div className="flex justify-between items-center border-b border-hairline pb-4">
          <span className="text-xs font-bold text-ink-secondary">행정 시스템 메뉴</span>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="text-ink-secondary hover:text-ink text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col gap-2.5 text-xs font-semibold">
          <Link href="/" className="text-ink hover:bg-primary/5 p-3 rounded-lg transition-all flex items-center gap-2.5">
            🗺️ 입지분석 메인 (Map)
          </Link>
          <Link href="/dashboard" className="text-primary hover:bg-primary/5 p-3 rounded-lg transition-all flex items-center gap-2.5 border border-primary/10 bg-primary/5">
            📊 이력 대시보드 (Analytics)
          </Link>
          <Link href="/" className="text-left text-ink hover:bg-primary/5 p-3 rounded-lg transition-all cursor-pointer flex items-center gap-2.5">
            ⚖️ 법규 RAG 관리
          </Link>
        </nav>
      </aside>

      {/* 2. 대시보드 레이아웃 본문 */}
      <main className="max-w-7xl mx-auto p-8 flex flex-col gap-8">
        
        {/* 상단 3대 지표 분석 요약 카드 (크레딧 항목 제거 및 행정 지표 대체) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 flex flex-col gap-2">
            <span className="text-xs text-ink-secondary font-semibold">종합 입지 의사결정 수립 건수</span>
            <span className="text-3xl font-bold text-ink font-mono">18 건</span>
            <p className="text-[10px] text-emerald-600 mt-1">▲ 전월 대비 12% 상승 (용산구 최다 수립)</p>
          </div>
          <div className="glass-panel p-6 flex flex-col gap-2">
            <span className="text-xs text-ink-secondary font-semibold">평균 갈등 타결 신뢰도</span>
            <span className="text-3xl font-bold text-primary font-mono">87.5 %</span>
            <p className="text-[10px] text-ink-secondary mt-1">LangGraph 예측 시나리오 매핑 만족 수준</p>
          </div>
          <div className="glass-panel p-6 flex flex-col gap-2">
            <span className="text-xs text-ink-secondary font-semibold">RAG 축적 검증사례 수</span>
            <span className="text-3xl font-bold text-emerald-600 font-mono">12 건</span>
            <p className="text-[10px] text-ink-secondary mt-1">실제 이행 공문 분석 RAG 격리 세그먼트 적재량</p>
          </div>
        </section>

        {/* 메인 이력 테이블 및 Audit AI 영역 (2단 분할) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 좌측 2칸: 과거 이력 테이블 */}
          <div className="lg:col-span-2 glass-panel p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <h2 className="text-sm font-bold text-ink">행정 의사결정 이력 목록 (OMS-01-04-001)</h2>
              <span className="text-[10px] text-ink-secondary font-medium">지적 필지 및 갈등 시뮬레이션 이력 아카이브</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-ink-secondary font-semibold bg-gray-200/50">
                    <th className="py-3 px-4">의사결정 ID</th>
                    <th className="py-3 px-4">일자</th>
                    <th className="py-3 px-4">대상 지역</th>
                    <th className="py-3 px-4">선택 인프라</th>
                    <th className="py-3 px-4">심의 상태</th>
                    <th className="py-3 px-4">사후 검증</th>
                    <th className="py-3 px-4 text-center">조회</th>
                    <th className="py-3 px-4 text-center">선택</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(item => (
                    <tr key={item.id} className="border-b border-hairline hover:bg-gray-100/50 transition-all text-ink">
                      <td className="py-3.5 px-4 font-mono text-ink font-semibold">#{item.id}</td>
                      <td className="py-3.5 px-4 text-ink-secondary">{item.date}</td>
                      <td className="py-3.5 px-4 font-semibold text-ink">{item.region}</td>
                      <td className="py-3.5 px-4 text-ink">{item.infra}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === '행정 종결' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-semibold ${
                          item.auditState === '검증 완료' ? 'text-emerald-600' :
                          item.auditState === '대기 중' ? 'text-ink-secondary animate-pulse' : 'text-rose-600'
                        }`}>
                          {item.auditState}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => openHistoryDetails(item)}
                          className="btn-secondary text-[10px] px-2 py-1 font-bold rounded"
                        >
                          상세 조회
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setActiveHistoryId(item.id);
                            setAuditFile(null);
                            setAuditResult(null);
                          }}
                          disabled={item.status !== '행정 종결'}
                          className="btn-primary text-[10px] px-2 py-1 font-bold rounded disabled:opacity-30 disabled:pointer-events-none"
                        >
                          검증 선택
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 우측 1칸: 선택된 이력의 Audit AI 사후 검증 모듈 */}
          <div className="glass-panel p-6 flex flex-col gap-4">
            <div className="border-b border-hairline pb-3">
              <h2 className="text-sm font-bold text-ink">사후 Audit AI 검증 패널</h2>
              <p className="text-[10px] text-ink-secondary">선택된 이력의 실제 공문서 검증 피드백 루프</p>
            </div>

            {activeHistoryId ? (
              <div className="flex flex-col gap-4">
                <div className="bg-white/50 p-4 rounded-xl border border-hairline flex justify-between items-center text-xs">
                  <span className="font-semibold text-ink-secondary">선택된 이력 ID:</span>
                  <span className="font-mono text-primary font-bold">#{activeHistoryId}</span>
                </div>

                {/* 결재 공문 업로드존 */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-ink-secondary font-medium">행정 종결 고시 공문 (PDF)</label>
                  <div className="border-2 border-dashed border-hairline hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer transition-all bg-white/40 relative">
                    <input 
                      type="file" 
                      accept=".pdf" 
                      onChange={handleAuditUpload} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <p className="text-xs text-ink font-medium">
                      {auditFile ? auditFile.name : '준공/고시 공문 드롭존'}
                    </p>
                    <p className="text-[9px] text-ink-secondary mt-1">드래그앤드롭하여 분석 개시</p>
                  </div>
                </div>

                {/* 파싱 중 인디케이터 */}
                {isParsing && (
                  <div className="text-xs text-primary animate-pulse text-center my-4 font-mono">
                    📄 OCR 추출 및 시나리오 1:1 매핑 연산 중...
                  </div>
                )}

                {/* 분석 완료 리포트 */}
                {auditResult && !isParsing && (
                  <div className="bg-white/50 p-4 rounded-xl border border-hairline flex flex-col gap-3 text-xs text-ink leading-relaxed">
                    <div className="flex justify-between border-b border-hairline pb-1.5 text-emerald-600 font-semibold">
                      <span>도달 시나리오</span>
                      <span>{auditResult.mappedScenario}</span>
                    </div>
                    <div>
                      <span className="text-ink-secondary block mb-0.5">매칭 유사 신뢰도</span>
                      <span className="text-ink font-mono font-bold">{auditResult.matchScore}% 적합</span>
                    </div>
                    <div>
                      <span className="text-ink-secondary block mb-0.5">판독 공문</span>
                      <span className="text-ink font-medium">{auditResult.title}</span>
                    </div>
                    <div>
                      <span className="text-ink-secondary block mb-0.5">주요 요약 결과</span>
                      <p className="text-ink-secondary bg-white/40 p-2.5 rounded border border-hairline text-[11px]">{auditResult.summary}</p>
                    </div>
                    <div className="text-[10px] text-emerald-600 font-bold border-t border-hairline pt-2 text-right">
                      ✓ RAG 격리 세그먼트 적재 및 요약 완료
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-ink-secondary text-xs">
                의사결정 이력 테이블에서<br />[검증 선택] 버튼을 클릭하면<br />사후 검증 드롭존이 활성화됩니다.
              </div>
            )}
          </div>
        </section>

      </main>

      {/* 과거 이력 상세 모달 팝업 (찬반 토론 및 결과서 다운로드 조회용) */}
      {showDetailModal && selectedHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-glass-crisp">
          <div className="w-[750px] h-[500px] glass-panel-deep p-6 flex flex-col justify-between rounded-2xl">
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <div>
                <h3 className="text-sm font-bold text-ink">행정 심의 의사결정 상세 기록 조회</h3>
                <p className="text-[10px] text-ink-secondary">의사결정 ID: #{selectedHistory.id} | 지역: {selectedHistory.region}</p>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-ink-secondary hover:text-ink text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* 토론 이력 스크롤 - Deep Indigo (#213183) 밤하늘 테마 */}
            <div className="flex-1 my-4 bg-secondary rounded-xl p-4 overflow-y-auto font-mono text-xs flex flex-col gap-3 border border-indigo-950 shadow-inner text-white">
              <div className="text-[11px] text-cyan-300 font-bold border-b border-indigo-900 pb-1.5">
                ⚡ [AI 모의 심의 토론 아카이브]
              </div>
              {getMockDebateLogs(selectedHistory.infra).map((log, index) => (
                <div key={index} className="flex gap-2 leading-relaxed">
                  <span className={`font-semibold shrink-0 ${
                    log.sender.includes('반대') ? 'text-rose-300' :
                    log.sender.includes('찬성') ? 'text-emerald-300' : 'text-indigo-200'
                  }`}>
                    [{log.sender}]
                  </span>
                  <span className="text-gray-100">{log.text}</span>
                </div>
              ))}
            </div>

            {/* 하단 버튼 및 정보 */}
            <div className="flex justify-between items-center border-t border-hairline pt-3">
              <div className="text-[11px] text-ink-secondary">
                <span className="font-semibold text-ink">선택된 인프라:</span> {selectedHistory.infra} ({selectedHistory.pnuCount}개 후보 필지 중 최종 결정)
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => downloadReportHTML(selectedHistory)}
                  className="btn-primary text-xs px-4 py-2"
                >
                  📝 최종 행정 결과서 다운로드
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
