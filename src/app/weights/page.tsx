"use client";

/**
 * 화면 3 · 가중치
 * ===============
 * 읽는 것: `weight_set.json`. 이름 붙이기에만 `reviewed` · `clean_report` 를 곁들인다
 * (없어도 화면은 뜬다 — id 로 표시된다).
 *
 * 🔴 **이 화면에는 층이 둘 있다. 겹치면 무엇을 만졌는지 아무도 설명 못 한다.**
 *
 *    1. **게이트B 답변 폼**(위) — `awaiting_hitl` + `gate.id === "weight"` 일 때만.
 *       묻는 것은 `slider_proposed`(`-1~+1`) · `radius_proposed`, 즉 **계산 전 입력**
 *       이고 제안 패스(`--propose-only`)가 만든 사전값이다.
 *    2. **산출물 `weight_set.json`**(아래) — **계산이 끝난 최종 가중치**다. 여기에는
 *       슬라이더를 달지 않고 **막대(bar)로** 그린다. 최종값에 슬라이더를 달면 사람은
 *       이 숫자를 조정했다고 믿는데 서버가 받는 것은 다른 층의 값이다.
 *
 *    폼이 열려 있는 동안 아래 표는 **직전 실행의 값**이거나 아예 없다. 그게 정상이다.
 *
 * 🔴 명세의 지표명("유동인구 · 건물 밀도")은 **산출물에 없다.** 지어내지 않고
 *    `labels.ts` 규칙으로 데이터에서 끌어온다. 끌어온 근거도 같이 보여준다.
 *
 * 🔴 `w_human` 은 **크기만**이다(항상 ≥ 0). 방향은 `direction`(benefit/cost).
"use client";

/**
 * 화면 3 · 가중치
 * ===============
 * 읽는 것: `weight_set.json`. 이름 붙이기에만 `reviewed` · `clean_report` 를 곁들인다
 * (없어도 화면은 뜬다 — id 로 표시된다).
 *
 * 🔴 **이 화면에는 층이 둘 있다. 겹치면 무엇을 만졌는지 아무도 설명 못 한다.**
 *
 *    1. **게이트B 답변 폼**(위) — `awaiting_hitl` + `gate.id === "weight"` 일 때만.
 *       묻는 것은 `slider_proposed`(`-1~+1`) · `radius_proposed`, 즉 **계산 전 입력**
 *       이고 제안 패스(`--propose-only`)가 만든 사전값이다.
 *    2. **산출물 `weight_set.json`**(아래) — **계산이 끝난 최종 가중치**다. 여기에는
 *       슬라이더를 달지 않고 **막대(bar)로** 그린다. 최종값에 슬라이더를 달면 사람은
 *       이 숫자를 조정했다고 믿는데 서버가 받는 것은 다른 층의 값이다.
 *
 *    폼이 열려 있는 동안 아래 표는 **직전 실행의 값**이거나 아예 없다. 그게 정상이다.
 *
 * 🔴 명세의 지표명("유동인구 · 건물 밀도")은 **산출물에 없다.** 지어내지 않고
 *    `labels.ts` 규칙으로 데이터에서 끌어온다. 끌어온 근거도 같이 보여준다.
 *
 * 🔴 `w_human` 은 **크기만**이다(항상 ≥ 0). 방향은 `direction`(benefit/cost).
 *    명세의 `-1 ~ +1` 슬라이더는 UI 표현이고, 부호를 크기에 섞으면 cost 반전과
 *    이중으로 걸려 조용히 뒤집힌다(CLAUDE.md 규약). 그래서 여기서는
 *    **크기와 방향을 분리해서** 보여준다. 합치지 않는다.
 */
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WeightGate } from "@/components/gate/WeightGate";
import { ArtifactView } from "@/components/ui/ArtifactView";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { GATE_WEIGHT, openGate, gateScreen } from "@/lib/omnisite/gate";
import { useRun } from "@/lib/omnisite/RunProvider";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import {
  loadCleanReport,
  loadReport,
  loadReviewed,
  loadWeightSet,
} from "@/lib/omnisite/pipeline";
import { buildDatasetLabels, indicatorLabel } from "@/lib/omnisite/labels";
import { fixed, int, meters, percent } from "@/lib/omnisite/format";
import { SCREENS } from "@/lib/omnisite/screens";
import type {
  CleanReportDoc,
  Indicator,
  ReportDoc,
  ReviewedDoc,
  WeightSetDoc,
  RunDoc,
  RunGate,
} from "@/lib/omnisite/types";

const SCREEN = SCREENS.find((s) => s.no === "3")!;

export default function Screen3Page() {
  const { run } = useRun();
  const router = useRouter();
  const gate = openGate(run, GATE_WEIGHT);
  
  const [cachedGate, setCachedGate] = useState<RunGate | null>(() => {
    if (typeof window !== "undefined" && run?.run_id) {
      try {
        const item = window.localStorage.getItem(`omnisite_gate_${run.run_id}_weight`);
        if (item) return JSON.parse(item);
      } catch (e) {}
    }
    return null;
  });

  useEffect(() => {
    if (gate && run?.run_id) {
      setCachedGate(gate);
      window.localStorage.setItem(`omnisite_gate_${run.run_id}_weight`, JSON.stringify(gate));
    }
  }, [gate, run?.run_id]);
  
  const displayGate = gate ?? cachedGate;
  
  const gateSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const [isSubmittingGate, setIsSubmittingGate] = useState(false);
  const [isWaitingForSync, setIsWaitingForSync] = useState(false);
  
  const ws = useArtifact<WeightSetDoc>("weight_set", loadWeightSet);
  const reviewed = useArtifact<ReviewedDoc>("reviewed", loadReviewed);
  const clean = useArtifact<CleanReportDoc>("clean_report", loadCleanReport);
  // 후보 필지 수는 weight_set 에도 있지만, 실제 통과 수(survive)는 report 에만 있다.
  const report = useArtifact<ReportDoc>("report", loadReport);

  const labels = buildDatasetLabels(reviewed.data, clean.data);

  const [currentStep, setCurrentStep] = useState(() => {
    if (!gate) {
      if (run?.status === "running" || run?.status === "queued") {
        return 2;
      } else {
        return 3;
      }
    }
    return 1;
  });

  useEffect(() => {
    if (isWaitingForSync && run) {
      const isRunning = run.status === "queued" || run.status === "running";
      if (run.status === "failed") {
        setIsWaitingForSync(false);
        return;
      }
      if (!isRunning && (!run.gate || run.gate.id !== "weight")) {
        setIsWaitingForSync(false);
        setCurrentStep(3);
      } else if (isRunning && currentStep !== 2) {
        setCurrentStep(2);
      }
    }
  }, [run?.status, run?.gate?.id, isWaitingForSync, currentStep]);

  const handleNext = async () => {
    if (currentStep === 1) {
      if (run?.status === "awaiting_hitl" && displayGate) {
        if (!gateSubmitRef.current) return;
        setIsSubmittingGate(true);
        try {
          await gateSubmitRef.current();
          setIsWaitingForSync(true);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSubmittingGate(false);
        }
      } else {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (!isWaitingForSync) {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      router.push("/sites");
    }
  };

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="최종 분석에 반영할 지표별 중요도를 설정하는 단계입니다. 지표의 가중치를 조정하여 분석 결과를 세밀하게 제어할 수 있습니다."
      />

      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 mt-6 overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-8">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-4 flex-1 pr-8">
              <StepIcon current={currentStep} stepNum={1} label="가중치 값 설정" />
              <div className="h-px flex-1 bg-gray-200" />
              <StepIcon current={currentStep} stepNum={2} label="가중치 계산" />
              <div className="h-px flex-1 bg-gray-200" />
              <StepIcon current={currentStep} stepNum={3} label="가중치 확정 및 확인" />
            </div>
            <div className="shrink-0 text-[11px] font-bold text-gray-500 uppercase tracking-widest px-4 py-1.5 bg-gray-50 rounded-full border border-gray-200">
              Step {currentStep} of 3
            </div>
          </div>

          {currentStep === 1 && displayGate && (
            <WeightGate gate={displayGate} runId={run!.run_id} labels={labels} submitRef={gateSubmitRef} />
          )}
          {currentStep === 1 && !displayGate && (
            <NoGateNotice run={run ?? null} step={currentStep} />
          )}
          
          {currentStep === 2 && (
            <NoGateNotice run={run ?? null} step={currentStep} />
          )}

          {currentStep === 3 && (
            <ArtifactView state={ws} what="가중치">
            {(w) => {
              const sorted = [...w.indicators].sort((a, b) => b.w_final - a.w_final);
              const maxFinal = Math.max(...w.indicators.map((i) => i.w_final), 0);
  
              return (
                <>
                  <section className="mt-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-[14px] font-semibold">지표별 가중치</h2>
                      <p className="text-[11px] text-ink-secondary">
                        가중치가 큰 순. 막대 길이는 <b>최종 가중치(w_final)</b> 기준입니다.
                      </p>
                    </div>
                    <WeightChart indicators={sorted} labels={labels} max={maxFinal} />
                  </section>

                  <Method w={w} />
                </>
              );
            }}
            </ArtifactView>
          )}
      </div>

        {/* 바닥 내비게이션 바 */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-gray-100 bg-white shrink-0">
          {currentStep === 1 ? (
            <div />
          ) : (
            <button 
               onClick={() => setCurrentStep(currentStep - 1)}
               disabled={currentStep === 2 && isWaitingForSync}
               className="px-6 py-2.5 rounded-xl font-bold text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                이전 단계
              </div>
            </button>
          )}
          
          <button 
             onClick={handleNext}
             disabled={(currentStep === 2 && isWaitingForSync) || isSubmittingGate}
             className={`px-8 py-2.5 rounded-xl font-bold text-white transition-colors shadow-md disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none ${
               currentStep === 3
                 ? "bg-green-600 hover:bg-green-700 shadow-green-200"
                 : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
             }`}
          >
            <div className="flex items-center gap-2 text-sm">
              {isSubmittingGate || (currentStep === 2 && isWaitingForSync) ? "처리 중..." : (currentStep === 3 ? "가중치 확인 완료, 위치선정으로 넘어가기 >" : "다음 단계 확인 >")}
            </div>
          </button>
        </div>
      </div>
    </PageBody>
  );
}

function WeightChart({ indicators, labels, max }: { indicators: Indicator[], labels: Map<string, any>, max: number }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeInd = indicators.find((i) => i.id === hoveredId) || indicators[0];

  return (
    <div className="mt-4 flex flex-col md:flex-row gap-6 items-start relative pb-8">
      {/* Chart Column */}
      <div className="flex-1 flex flex-col gap-2 w-full">
        {indicators.map((ind) => {
          const name = indicatorLabel(ind.id, ind.components, labels);
          const pct = max > 0 ? (ind.w_final / max) * 100 : 0;
          const cost = ind.direction === "cost";
          const excluded = ind.sparse_excluded;
          const isHovered = hoveredId === ind.id;
          
          return (
            <div 
              key={ind.id} 
              className={`relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
                isHovered 
                  ? 'bg-blue-50/50 border-blue-200 shadow-sm' 
                  : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
              } ${excluded ? 'opacity-60 grayscale' : ''}`}
              onMouseEnter={() => setHoveredId(ind.id)}
            >
              <div className="w-8 shrink-0">
                <span className={`inline-flex h-5 w-full items-center justify-center rounded px-1 font-mono text-[9px] font-bold ${
                  excluded ? "bg-gray-200 text-gray-600" : cost ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {ind.id}
                </span>
              </div>
              <div className="w-1/3 truncate text-[11px] font-bold text-gray-700 text-right" title={name}>
                {name}
              </div>
              <div className="flex-1 relative h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out ${
                    excluded ? "bg-gray-400" : cost ? "bg-gradient-to-r from-red-400 to-red-500" : "bg-gradient-to-r from-emerald-400 to-emerald-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className={`w-14 text-right font-mono text-xs font-black ${
                isHovered ? 'text-blue-600' : excluded ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {fixed(ind.w_final, 4)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Panel Column */}
      <div className="w-full md:w-[340px] shrink-0 sticky top-6">
        {activeInd ? (
          <IndicatorDetailPanel ind={activeInd} labels={labels} />
        ) : (
          <div className="h-64 rounded-2xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
            차트에 마우스를 올려 상세 정보를 확인하세요
          </div>
        )}
      </div>
    </div>
  );
}

function IndicatorDetailPanel({ ind, labels }: { ind: Indicator, labels: Map<string, any> }) {
  const name = indicatorLabel(ind.id, ind.components, labels);
  const cost = ind.direction === "cost";
  const excluded = ind.sparse_excluded;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-md overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-right-4">
      <div className={`p-4 border-b ${excluded ? 'bg-gray-50 border-gray-200' : cost ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center justify-center rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
            excluded ? "bg-gray-200 text-gray-600" : cost ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
          }`}>
            {ind.id}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              cost ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            }`}
          >
            {cost ? "낮을수록 좋음 (cost)" : "높을수록 좋음 (benefit)"}
          </span>
          {excluded && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
              희소 제외
            </span>
          )}
        </div>
        <h3 className="text-[13px] font-bold text-gray-900 leading-tight">{name}</h3>
      </div>
      
      <div className="p-4 bg-white">
        <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-gray-50">
          <span className="text-[11px] font-bold text-gray-400">최종 가중치</span>
          <span className={`text-xl font-black ${excluded ? "text-gray-400" : "text-blue-600"}`}>
            {fixed(ind.w_final, 4)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Cell k="사용자 설정 가중치" v={fixed(ind.w_human, 4)} />
          <Cell k="AI 분석 가중치" v={fixed(ind.w_critic, 4)} />
          <Cell k="데이터 집계 반경" v={meters(ind.radius_m)} />
          <Cell k="영향 방향성" v={cost ? "부정적 요인 (감점)" : "긍정적 요인 (가점)"} />
        </div>

        {(ind.direction_conflict || ind.radius_rationale || ind.seed_rationale) && (
          <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 border border-gray-100 text-[11px] leading-relaxed">
            {ind.direction_conflict && (
              <p className="flex items-start gap-1.5 text-amber-800">
                <svg className="mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                <span><strong>방향 충돌:</strong> {ind.direction_conflict}</span>
              </p>
            )}
            {ind.radius_rationale && (
              <p className="text-gray-600">
                <strong className="text-gray-700">반경 근거:</strong> {ind.radius_rationale}
              </p>
            )}
            {ind.seed_rationale && (
              <p className="text-gray-600">
                <strong className="text-gray-700">가중치 근거:</strong> {ind.seed_rationale}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex flex-col justify-center rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{k}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 font-mono text-sm font-semibold text-gray-900">
        {v}
        {sub && <span className="text-[10px] font-medium text-gray-400">{sub}</span>}
      </dd>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  const isWarn = note ? note.includes("🔴") : false;
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
      isWarn ? "border-red-200 bg-gradient-to-br from-red-50 to-white" : "border-gray-200 bg-gradient-to-br from-gray-50 to-white"
    }`}>
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl ${
        isWarn ? "bg-red-500" : "bg-blue-500"
      }`}></div>
      <div className="relative z-10">
        <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</div>
        <div className={`mt-2 text-3xl font-black tracking-tight ${isWarn ? "text-red-700" : "text-gray-900"}`}>{value}</div>
        {note && <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{note}</p>}
      </div>
    </div>
  );
}

function HitlState({ hitl }: { hitl: WeightSetDoc["hitl"] }) {
  const src = hitl.value_source;
  const trusted = src === "human" || src === "fixture";
  
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <span className="text-sm font-bold text-gray-700">전문가 개입 여부</span>
        </div>
        <Chip ok={hitl.radius_confirmed} label="집계 반경 [R]" trusted={trusted} />
        <Chip ok={hitl.weight_confirmed} label="가중치 [W]" trusted={trusted} />
      </div>
      
      {!trusted && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5 text-sm text-gray-600 mt-2">
          <svg className="mt-0.5 shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span className="text-[13px] leading-relaxed">
            과거 버전의 분석이거나 자동화된 테스트 모드로 실행되어 전문가의 개입 기록이 없는 결과입니다. 최신 모드로 다시 실행하시면 정확한 개입 기록이 남습니다.
          </span>
        </div>
      )}
    </div>
  );
}

function Chip({ ok, label, trusted }: { ok: boolean; label: string; trusted: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-sm transition-all ${
        !trusted
          ? "bg-gray-100 text-gray-400 line-through decoration-gray-400/50"
          : ok
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-gray-50 text-gray-600 border border-gray-200"
      }`}
    >
      {ok && trusted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      {!ok && trusted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
      {label} {ok && trusted ? "(사람이 확정)" : !trusted ? "" : "(기본값 사용)"}
    </span>
  );
}

function Method({ w }: { w: WeightSetDoc }) {
  const sparse = w.notes.sparse_excluded_ids;
  return (
    <section className="mt-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500"><path d="M2 12h20"/><path d="M12 2v20"/></svg>
          <h2 className="text-base font-bold text-gray-900">제외된 지표 (희소 임계 미달)</h2>
        </div>
        {sparse.length > 0 ? (
          <>
            <p className="text-sm leading-relaxed text-gray-600 mb-4">
              값이 거의 없어(희소 임계 {percent(w.notes.sparse_threshold, 2)} 미만) 점수 산정에서 
              제외된 지표들입니다. <strong className="text-gray-800">데이터가 적다는 뜻이며, 중요하지 않다는 의미는 아닙니다.</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {sparse.map((id) => (
                <span
                  key={id}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-sm font-bold text-gray-600 shadow-sm"
                >
                  {id}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 mb-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p className="text-sm font-medium text-gray-400">제외된 지표가 없습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col justify-center rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{k}</dt>
      <dd className="mt-0.5 font-mono text-sm font-bold text-gray-900 truncate" title={v}>{v}</dd>
    </div>
  );
}

function NoGateNotice({ run, step }: { run: RunDoc | null, step?: number }) {
  const status = run?.status;

  if (status === "succeeded") {
    if (step === 2) {
      return (
        <section className="mt-6 rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden relative animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-emerald-50/50 px-4 py-3 border-b border-emerald-100">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[12px] font-bold text-white shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                가중치 점수 계산 완료
              </h2>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center p-14 bg-white text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-sm text-emerald-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h3 className="text-[16px] font-bold text-emerald-900 mb-1.5">가중치 계산 및 위치 선정이 모두 완료되었습니다.</h3>
            <p className="text-[14px] text-emerald-700/80">다음 단계(가중치 확정 및 확인)에서 최종 결과를 확인해주세요.</p>
          </div>
        </section>
      );
    }
    if (step === 1) {
      return (
        <div className="mt-6 flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border border-gray-200 text-center shadow-sm">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 mb-3"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          <h3 className="text-[15px] font-bold text-gray-700 mb-2">이전 세션의 폼 데이터를 불러올 수 없습니다.</h3>
          <p className="text-[13px] text-gray-500 max-w-md leading-relaxed">
            게이트 제출 시 캐시된 데이터가 없어 입력 폼을 표시할 수 없습니다.<br/>
            (가중치 확정 및 확인 단계에서 최종 산출물을 확인하실 수 있습니다)
          </p>
        </div>
      );
    }
    return null;
  }
  
  if (status === "running" || status === "queued") {
    return (
      <section className="mt-6 rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden relative animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-blue-50/30 px-4 py-3 border-b border-blue-100">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[12px] font-bold text-white shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </span>
            <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              가중치 점수 계산 및 위치 선정 진행 중
            </h2>
          </div>
          <div className="text-[13.5px] leading-relaxed text-blue-700 pl-9">
            설정된 가중치를 바탕으로 모든 지역의 점수를 계산하고 최종 후보지를 도출하는 단계입니다.
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center p-14 bg-white text-center">
          <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin mb-4 shadow-sm" />
          <h3 className="text-[15px] font-bold text-blue-900 mb-1.5">AI가 가중치 계산을 위해 열심히 데이터를 처리하고 있습니다...</h3>
          <p className="text-[13px] text-blue-700/80">우측의 실시간 분석 모니터링 창을 통해 진행 상황을 확인하실 수 있습니다.</p>
        </div>
      </section>
    );
  }

  if (status === "awaiting_hitl" && run?.gate) {
    const target = gateScreen(run.gate.id);
    if (target && target.no !== "3") {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 rounded-2xl border-2 border-yellow-300 text-center shadow-sm animate-in fade-in slide-in-from-bottom-4 mt-5">
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-yellow-600"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
          <h3 className="text-base font-bold text-yellow-900 mb-2">다음 단계({target.name}) 분석이 완료되었습니다!</h3>
          <p className="text-sm text-yellow-800/80 mb-5">AI가 다음 단계를 위한 제안을 준비했습니다. 확인을 위해 이동해주세요.</p>
          <Link href={target.path} className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-yellow-900 font-bold text-sm rounded-xl hover:bg-yellow-500 hover:-translate-y-0.5 transition-all shadow-md">
            {target.name} 단계로 바로 이동하기
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      );
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-hairline bg-white px-4 py-3 text-[12px] leading-relaxed text-ink-secondary">
      <p className="font-medium text-ink">
        지금 답할 게이트가 열려 있지 않습니다{status ? ` (상태: ${status})` : ""}.
      </p>
      <p className="mt-1">
        아래 표는 <b>계산이 끝난 최종 가중치</b>(<code>weight_set.json</code>)라서
        슬라이더가 없습니다. 게이트B 가 받는 것은 이 값이 아니라 <b>이 값을 만들어 낸
        앞단의 입력</b>(집계반경 · 슬라이더 <code>-1~+1</code>)이고, 그 입력은 실행이
        게이트에서 <b>멈춰 있는 동안에만</b> 존재합니다.
      </p>
      <p className="mt-1">
        게이트를 세우려면 화면 1 에서 실행을 <code>mode: hitl</code> 로 만드십시오.
        <b> 픽스처(<code>fixture</code>)는 게이트가 서지 않습니다.</b>
      </p>
    </div>
  );
}

function StepIcon({ current, stepNum, label }: { current: number; stepNum: number; label: string }) {
  const isPast = current > stepNum;
  const isCurrent = current === stepNum;
  
  return (
    <div className={`flex items-center gap-2 ${isPast || isCurrent ? "" : "opacity-50"}`}>
      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
        isCurrent ? "bg-blue-600 text-white shadow-sm" : 
        isPast ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
      }`}>
        {stepNum}
      </div>
      <span className={`text-[13px] font-bold ${
        isCurrent ? "text-blue-900" :
        isPast ? "text-blue-800" : "text-gray-400"
      }`}>
        {label}
      </span>
    </div>
  );
}
