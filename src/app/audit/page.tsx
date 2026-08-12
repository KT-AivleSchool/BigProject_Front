"use client"; // force reload

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import { AuditGate } from "@/components/gate/AuditGate";
import { ArtifactView } from "@/components/ui/ArtifactView";
import { PageBody, PageHeader } from "@/components/ui/Page";
import { GATE_AUDIT, openGate, gateScreen } from "@/lib/omnisite/gate";
import { loadReviewed } from "@/lib/omnisite/pipeline";
import { useRun } from "@/lib/omnisite/RunProvider";
import { SCREENS } from "@/lib/omnisite/screens";
import { ExclusionContent } from "@/app/audit/exclusion/page";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import { meters } from "@/lib/omnisite/format";
import type { ReviewedDoc, ReviewedFlag, ReviewedResult, ReviewedRole, RunDoc, RunGate } from "@/lib/omnisite/types";

const SCREEN = SCREENS.find((s) => s.no === "2")!;
const SCREEN_2B = SCREENS.find((s) => s.no === "2b")!;

const ROLE_LABEL: Record<string, string> = {
  positive_factor: "가점 요인",
  negative_factor: "감점 요인",
  hard_exclusion: "설치 금지(배제)",
  reference_only: "참조만",
};

// TODO: 백엔드에서 실제 파일명을 보내주기 전까지 UI 시연을 위해 사용하는 임시 매핑
const DATASET_NAME_MOCK: Record<string, string> = {
  "01": "B1_서울특별시_용산구_금연구역_20260131",
  "02": "BUS_STATION_BOARDING_MONTH_202605",
  "03": "CARD_SUBWAY_MONTH_202605",
  "04": "LOCAL_PEOPLE_DONG_202605",
  "05": "서울시 어린이집 정보(표준 데이터)",
  "06": "서울시 역사마스터 정보",
  "07": "서울시버스정류소위치정보(20260602)",
  "08": "서울특별시 용산구_가로휴지통_20240630",
  "09": "서울특별시_용산구_담배꽁초상습무단투기지역현황_20250806",
  "10": "소상공인시장진흥공단_상가(상권)정보_서울_202603",
  "11": "전국어린이보호구역표준데이터",
};

export default function Screen2Page() {
  const { run } = useRun();
  const router = useRouter();
  const state = useArtifact("reviewed", loadReviewed);
  const gate = openGate(run, GATE_AUDIT);
  const [cachedGate, setCachedGate] = useState<RunGate | null>(null);

  // run_id가 나중에 로드되더라도 localStorage에서 cachedGate를 복구하도록 수정
  useEffect(() => {
    if (typeof window !== "undefined" && run?.run_id && !cachedGate) {
      try {
        const item = window.localStorage.getItem(`omnisite_gate_${run.run_id}_audit`);
        if (item) setCachedGate(JSON.parse(item));
      } catch (e) {}
    }
  }, [run?.run_id, cachedGate]);

  useEffect(() => {
    if (gate && run?.run_id) {
      setCachedGate(gate);
      window.localStorage.setItem(`omnisite_gate_${run.run_id}_audit`, JSON.stringify(gate));
    }
  }, [gate, run?.run_id]);
  
  const displayGate = gate ?? cachedGate;
  
  const [step, setStep] = useState(() => {
    if (typeof window !== "undefined" && run?.run_id) {
      const saved = window.sessionStorage.getItem(`audit_step_${run.run_id}`);
      if (saved) return parseInt(saved, 10);
    }
    return 1;
  });

  useEffect(() => {
    if (run?.run_id && typeof window !== "undefined") {
      window.sessionStorage.setItem(`audit_step_${run.run_id}`, step.toString());
    }
  }, [step, run?.run_id]);

  const [isSubmittingGate, setIsSubmittingGate] = useState(false);
  const gateSubmitRef = useRef<(() => Promise<boolean | void>) | null>(null);
  const [isGateReady, setIsGateReady] = useState(false);
  const [gateProgress, setGateProgress] = useState({ confirmed: 0, total: 0 });
  const [isWaitingForSync, setIsWaitingForSync] = useState(false);

  const handleProgressChange = useCallback((confirmed: number, total: number) => {
    setGateProgress(prev => prev.confirmed === confirmed && prev.total === total ? prev : { confirmed, total });
  }, []);

  const handleNext = async () => {
    if (step === 2 && gate) {
      if (!gateSubmitRef.current) return;
      setIsSubmittingGate(true);
      try {
        const result = await gateSubmitRef.current();
        if (result !== false) {
          setIsWaitingForSync(true);
          setStep(3); // Go to explicit processing step
        }
      } catch(e) {
        console.error(e);
      } finally {
        setIsSubmittingGate(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  useEffect(() => {
    if (isWaitingForSync && run) {
      const isRunning = run.status === "queued" || run.status === "running";
      
      if (run.status === "failed") {
        setIsWaitingForSync(false);
        return;
      }

      // 백엔드 응답이 오더라도 아직 상태 업데이트 전이라 awaiting_hitl / audit gate 상태일 수 있음.
      // 완전히 러닝(queued/running)이 끝났고, 동시에 audit gate가 아닐 때(다음 게이트로 넘어갔거나 완료됐을 때)만 통과시킴.
      if (!isRunning && (!run.gate || run.gate.id !== "audit")) {
        setIsWaitingForSync(false);
      }
    }
  }, [run?.status, run?.gate?.id, isWaitingForSync, step]);

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
      />

      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 mt-6 overflow-hidden min-h-0">
        
        {/* 전체 컨텐츠 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-4 flex-1 pr-8">
              <StepIcon current={step} stepNum={1} label="선정 대상 분석" />
              <div className="h-px flex-1 bg-gray-200" />
              <StepIcon current={step} stepNum={2} label="확인 요청" />
              <div className="h-px flex-1 bg-gray-200" />
              <StepIcon current={step} stepNum={3} label="데이터 처리 중" />
              <div className="h-px flex-1 bg-gray-200" />
              <StepIcon current={step} stepNum={4} label="배제 사유 상세" />
              <div className="h-px flex-1 bg-gray-200" />
              <StepIcon current={step} stepNum={5} label="데이터셋 감리" />
            </div>
            <div className="shrink-0 text-[11px] font-bold text-gray-500 uppercase tracking-widest px-4 py-1.5 bg-gray-50 rounded-full border border-gray-200">
              Step {step} of 5
            </div>
          </div>

          <ArtifactView state={state} what="감리 결과">
            {(doc) => (
              <>
                {step === 1 && <Body doc={doc} hideFlags hideTarget={false} />}
                {step === 2 && (
                  <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <h2 className="text-[20px] font-bold text-gray-900 tracking-tight">확인 요청</h2>
                        <span className="text-sm text-gray-500 ml-2">AI가 확정짓지 못한 예외 사항들을 직접 검토하고 확정해주세요.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!gate ? (
                          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                            제출 완료
                          </span>
                        ) : (
                          <>
                            <span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold border border-orange-200">
                              검토 대기 {gateProgress.total > 0 ? gateProgress.total - gateProgress.confirmed : (displayGate?.questions.length ?? 0)}건
                            </span>
                            <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">
                              확정 완료 {gateProgress.confirmed}건
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      {displayGate && (
                        <AuditGate 
                          gate={displayGate} 
                          runId={run!.run_id} 
                          submitRef={gateSubmitRef}
                          onReadyChange={setIsGateReady}
                          onProgressChange={handleProgressChange}
                          readOnly={!gate || run?.status !== "awaiting_hitl"}
                        />
                      )}
                    </div>
                  </div>
                )}
                {step === 3 && (
                  <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white rounded-2xl animate-in fade-in zoom-in-95 duration-300">
                    {run?.status === "running" || run?.status === "queued" || run?.gate?.id === "audit" ? (
                      <>
                        <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                        <div className="text-center">
                          <h3 className="text-[20px] font-bold text-blue-900 mb-2">AI가 다음 분석을 위해 열심히 데이터를 처리하고 있습니다...</h3>
                          <p className="text-[15px] text-gray-500">우측의 실시간 분석 모니터링 창을 통해 진행 상황을 확인하실 수 있습니다.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div className="text-center">
                          <h3 className="text-[20px] font-bold text-green-700 mb-2">데이터 처리가 모두 완료되었습니다!</h3>
                          <p className="text-[15px] text-gray-500">아래 <strong>[다음 단계 확인]</strong> 버튼을 눌러 상세 사유를 확인해 주세요.</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {step === 4 && (
                  <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <h2 className="text-[1.25rem] font-bold text-gray-900 tracking-tight">배제 사유 상세</h2>
                          <p className="text-[14px] text-gray-500">
                            AI가 흡연 부스 설치가 불가능하다고 판단한 시설물(배제 구역)과 그 구체적인 법적 근거를 확인합니다.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <ExclusionContent />
                    </div>
                  </div>
                )}
                {step === 5 && (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    {!gate && <NoGateCTA run={run ?? null} />}
                    <Body doc={doc} hideTarget hideFlags={false} />
                  </div>
                )}
              </>
            )}
          </ArtifactView>
        </div>

        {/* 바닥 내비게이션 바 */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-gray-100 bg-white shrink-0">
          <button 
             onClick={() => setStep(step - 1)}
             disabled={step === 1}
             className="px-6 py-2.5 rounded-xl font-bold text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              이전 단계
            </div>
          </button>
          {step === 5 ? (
            <button 
               onClick={() => {
                 if (run?.run_id) {
                   window.localStorage.setItem(`unlocked_weight_${run.run_id}`, "true");
                   window.dispatchEvent(new Event("storage"));
                 }
                 router.push("/weights");
               }}
               className="px-8 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-md shadow-green-200"
            >
              <div className="flex items-center gap-2 text-sm">
                감리 확인 완료, 가중치로 넘어가기
              </div>
            </button>
          ) : (
            <button 
               onClick={handleNext}
               disabled={(step === 2 && displayGate && gate && (!isGateReady || run?.status !== "awaiting_hitl")) || isSubmittingGate || (step === 3 && (run?.status === "running" || run?.status === "queued" || run?.gate?.id === "audit"))}
               className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md shadow-blue-200 disabled:bg-gray-300 disabled:shadow-none"
            >
              <div className="flex items-center gap-2 text-sm">
                {step === 3 && (run?.status === "running" || run?.status === "queued" || run?.gate?.id === "audit") ? "데이터 처리 중..." : "다음 단계 확인"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          )}
        </div>
      </div>
    </PageBody>
  );
}

function Body({ doc, hideFlags, hideTarget }: { doc: ReviewedDoc, hideFlags?: boolean, hideTarget?: boolean }) {
  const fi = doc.facility_inference;
  const [openCategory, setOpenCategory] = useState<string | null>("positive_factor");
  
  return (
    <div className="flex flex-col gap-10">
      {/* ── 선정 대상 분석 ── */}
      {!hideTarget && (
        <section className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-[1.25rem] font-bold text-gray-900 tracking-tight">선정 대상 분석</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-x divide-gray-100">
            <KV icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>} k="시설" v={fi.facility} />
            <KV icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>} k="지역" v={fi.region} />
            <KV icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} k="입력" v={fi.source_input} />
            <KV 
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              k="분석 주체" 
              v={fi.confirmed ? "사람이 직접 확정함" : "AI 자동 추론됨"} 
              tone={fi.confirmed ? "ok" : "info"} 
            />
          </div>



          {fi.mismatch && (
            <div className="mt-2 flex gap-3 p-4 rounded-xl border border-orange-200 bg-orange-50 text-orange-800">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div className="text-sm">
                <span className="font-bold">입력과 데이터 불일치:</span> {fi.mismatch_reason}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 데이터셋 판정 ── */}
      {!hideFlags && (
        <section className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-[1.25rem] font-bold text-gray-900 tracking-tight">데이터셋별 감리 판정</h2>
              <p className="text-[14px] text-gray-500">각 데이터셋을 클릭해서 AI가 분석에 사용할 데이터의 역할을 판정한 결과를 확인해 주세요.</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col gap-4">
            {(() => {
              const categories = [
                { id: 'positive_factor', label: '가점 요인', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: 'bg-blue-400', ring: 'ring-blue-100' },
                { id: 'negative_factor', label: '감점 요인', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', icon: 'bg-orange-400', ring: 'ring-orange-100' },
                { id: 'hard_exclusion', label: '설치 금지(배제)', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: 'bg-red-400', ring: 'ring-red-100' },
                { id: 'reference_only', label: '참조만', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900', icon: 'bg-gray-400', ring: 'ring-gray-100' },
              ];

              const categorizedResults = categories.map(cat => ({
                ...cat,
                items: doc.results.filter(r => r.roles.some(role => role.role === cat.id)).map(r => ({
                  dataset: r,
                  role: r.roles.find(role => role.role === cat.id)!
                }))
              })).filter(cat => cat.items.length > 0);

              return categorizedResults.map(cat => (
                <div key={cat.id} className="flex flex-col">
                  <button
                    onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors outline-none focus:ring-2 ${
                      openCategory === cat.id 
                        ? `${cat.bg} ${cat.border} ${cat.ring}` 
                        : `bg-white border-gray-200 hover:bg-gray-50`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <h3 className={`font-bold text-[15px] ${openCategory === cat.id ? cat.text : 'text-gray-800'}`}>
                        {cat.label}
                      </h3>
                      <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
                        {cat.items.length}개
                      </span>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${openCategory === cat.id ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                  
                  {openCategory === cat.id && (
                    <div className="p-4 mt-2 bg-gray-50/50 border border-gray-100 rounded-xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                      {cat.items.map((item, idx) => {
                        const excl = item.role.role === "hard_exclusion";
                        return (
                          <div key={item.dataset.dataset_id + idx} className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                            <div className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${cat.icon}`} />
                            <div className="flex-1">
                              <p className="text-[13.5px] text-gray-800 leading-relaxed">
                                {item.dataset.summary.replace(/^이 데이터는\s*/, "")}
                              </p>
                            </div>
                            <div className="shrink-0 text-[12px] font-mono text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                              {excl && item.role.배제반경_m != null ? `반경 ${meters(item.role.배제반경_m)}` : null}
                              {!excl && typeof item.role.weight === "number" ? `w: ${item.role.weight}` : null}
                              {(excl && item.role.배제반경_m == null) || (!excl && typeof item.role.weight !== "number") ? '해당사항 없음' : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </section>
      )}
    </div>
  );
}

function RoleChip({ role }: { role: ReviewedRole }) {
  const excl = role.role === "hard_exclusion";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border shadow-sm ${
        excl 
          ? "bg-red-50 text-red-700 border-red-200" 
          : "bg-white text-gray-700 border-gray-200"
      }`}
      title={role.rationale}
    >
      {ROLE_LABEL[role.role] ?? role.role}
      {excl && role.배제반경_m != null && <span className="opacity-70 font-mono ml-0.5">· {meters(role.배제반경_m)}</span>}
      {!excl && typeof role.weight === "number" && <span className="opacity-70 font-mono ml-0.5">· W:{role.weight}</span>}
    </span>
  );
}

function KV({ icon, k, v, tone }: { icon: React.ReactNode, k: string; v: string; tone?: "ok" | "warn" | "info" }) {
  return (
    <div className="flex flex-col gap-1.5 p-6 bg-white hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-2 text-gray-400">
        <div className="text-gray-300">{icon}</div>
        <dt className="text-xs font-semibold">{k}</dt>
      </div>
      <dd className={`text-[15px] font-bold ${tone === "warn" ? "text-orange-600" : tone === "ok" ? "text-green-600" : tone === "info" ? "text-blue-600" : "text-gray-900"} pl-7`}>
        {v}
      </dd>
    </div>
  );
}

function NoGateCTA({ run }: { run: RunDoc | null }) {
  // 사용자의 요청에 따라 다음 단계로 이동을 유도하는 띠 배너를 완전히 제거
  return null;
}

function NoGateNotice({ run }: { run: RunDoc | null }) {
  const status = run?.status;

  if (status === "succeeded") {
    return null;
  }
  
  if (status === "running") {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-blue-50/50 rounded-2xl border border-blue-100 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-5" />
        <h3 className="text-[15px] font-bold text-blue-900 mb-1.5">AI가 다음 분석을 위해 열심히 데이터를 처리하고 있습니다...</h3>
        <p className="text-sm text-blue-700/80">우측의 실시간 분석 모니터링 창을 통해 진행 상황을 확인하실 수 있습니다.</p>
      </div>
    );
  }

  if (status === "awaiting_hitl" && run?.gate) {
    const target = gateScreen(run.gate.id);
    if (target && target.no !== "2") {
      return (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl w-fit border border-green-200">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span className="font-bold">감리 확인이 완료되었습니다.</span>
          <span>다음 단계를 확인해 주세요.</span>
        </div>
      );
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-4 py-3 rounded-xl w-fit border border-gray-200">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>현재 감리 대기 중인 항목이 없습니다. {status && `(상태: ${status})`}</span>
    </div>
  );
}

function StepIcon({ current, stepNum, label }: { current: number; stepNum: number; label: string }) {
  const isActive = current === stepNum;
  const isPast = current > stepNum;
  
  return (
    <div className={`flex items-center gap-3 transition-opacity ${isActive ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[13px] font-bold shadow-sm ${
        isActive ? 'bg-blue-600 text-white' : isPast ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
      }`}>
        {isPast ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : stepNum}
      </div>
      <span className={`text-[14px] font-bold ${isActive ? 'text-blue-900' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}
