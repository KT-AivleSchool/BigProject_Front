"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { gateScreen } from "@/lib/omnisite/gate";
import { useRun } from "@/lib/omnisite/RunProvider";
import { computeProgress, formatDuration, loadBaseline } from "@/lib/omnisite/progress";
import { percent } from "@/lib/omnisite/format";
import type { RunDoc, RunStep } from "@/lib/omnisite/types";

export function ProgressSidebar() {
  const { run, restoring, runningElapsedSec, refresh } = useRun();
  const baseline = loadBaseline();
  const pathname = usePathname();

  if (
    pathname?.startsWith("/sites") ||
    pathname?.startsWith("/hearing") ||
    pathname?.startsWith("/dynamic-hearing") ||
    pathname?.startsWith("/report")
  ) {
    return null;
  }

  return (
    <aside className="relative w-[420px] bg-gray-50/80 backdrop-blur-xl border-l border-gray-200 flex flex-col h-full shadow-sm shrink-0">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white/50">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-800">실시간 분석 모니터링</h2>
          {run && (run.status === "running" || run.status === "queued") && (
             <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        {restoring ? (
          <p className="text-xs text-gray-500 text-center mt-10">이전 실행을 확인하는 중...</p>
        ) : !run ? (
          <div className="text-center mt-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <p className="text-sm font-medium text-gray-600">진행 중인 분석이 없습니다</p>
            <p className="text-xs text-gray-400 mt-2">좌측 화면에서 분석을 시작해주세요.</p>
          </div>
        ) : (
          <SidebarContent run={run} baseline={baseline} runningElapsedSec={runningElapsedSec} refresh={refresh} />
        )}
      </div>
    </aside>
  );
}

function SidebarContent({ run, baseline, runningElapsedSec, refresh }: { run: RunDoc, baseline: any, runningElapsedSec: number, refresh: () => void }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (run.status === "awaiting_hitl") {
      const interval = setInterval(() => setTick((t) => t + 1), 500);
      return () => clearInterval(interval);
    }
  }, [run.status]);

  const p = computeProgress(run, baseline, runningElapsedSec);
  const live = run.status === "queued" || run.status === "running";

  return (
    <div className="flex flex-col gap-5">
      {/* ── 요약 메타 정보 ── */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <dl className="grid grid-cols-2 gap-y-1">
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">주제</dt>
            <dd className="text-lg font-bold text-gray-800">{run.domain}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">모드</dt>
            {/*
              🔴 **축이 둘이다.** 데이터 갈래(`mode`: 프리셋 hitl ↔ 업로드 full)와
                 분석 갈래(`auto_approve`: 맞춤형 ↔ 고속)는 서로 무관하게 조합된다.
                 예전엔 `mode === "hitl" ? "대화형" : "자동"` 한 줄이라 **게이트에
                 멈춰 선 맞춤형 full run 도 「자동」**이라고 적었다 — 그래서 화면이
                 「감리를 건너뛰었다」고 말하는 것처럼 읽혔다(2026-08-13).
            */}
            <dd className="text-lg font-bold text-gray-800">{run.mode === "hitl" ? "프리셋" : "업로드"}</dd>
            {/*
              ⚠ 키가 **없는** 옛 run 은 아무 말도 안 한다. `undefined` 를 `false` 로
                접으면 자동으로 돌린 옛 run 이 「맞춤형」으로 둔갑한다 — 모르는 것을
                모른다고 두는 편이 낫다(원칙 4).
            */}
            {run.auto_approve !== undefined && (
              <dd className="text-xs font-semibold text-gray-500 mt-0.5">
                {run.auto_approve ? "고속 자동 분석" : "맞춤형 대화 분석"}
              </dd>
            )}
          </div>
        </dl>
      </div>

      {/* ── 진행률 ── */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-gray-800">{statusLabel(run)}</span>
          <span className="text-lg font-black text-gray-900 tracking-tight">{p.ratio === null ? "—%" : percent(p.ratio, 0)}</span>
        </div>
        
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-[width] duration-500 rounded-full ${run.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: p.ratio === null ? "0%" : `${p.ratio * 100}%` }}
          />
        </div>
        
        <div className="mt-3 flex justify-between text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            남은 시간 {formatDuration(p.remainSec)}
          </span>
          <span>{p.doneCount} / {p.totalCount} 완료</span>
        </div>
      </div>

      {/* ── 사람 확인 대기 (게이트) ── */}
      {run.status === "awaiting_hitl" && <GateBlock run={run} onRefresh={refresh} />}

      {/* ── 단계 리스트 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xs font-bold text-gray-700">작업 단계</h3>
        </div>
        <ol className="p-2 flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-thin">
          {run.steps.map((s) => (
            <StepRow key={s.id} step={s} baselineSec={baseline?.[s.id] ?? null} />
          ))}
        </ol>
      </div>

      
      {/* ── 완료 후 다음 스텝 안내 ── */}
      {run.status === "succeeded" && (
         <div className="rounded-xl border-2 border-green-400 bg-green-50 p-6 flex flex-col items-center text-center shadow-sm animate-in fade-in zoom-in-95">
           <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-600"><path d="M20 6 9 17l-5-5"/></svg>
           </div>
           <h3 className="text-[13px] font-bold text-green-800">분석이 완료되었습니다!</h3>
         </div>
      )}
    </div>
  );
}

function GateBlock({ run, onRefresh }: { run: RunDoc; onRefresh: () => void }) {
  const pathname = usePathname();
  const gate = run.gate;
  const target = gate ? gateScreen(gate.id) : null;

  if (!gate) {
    return null;
  }

  const isOnTargetScreen = target && pathname?.startsWith(target.path);

  return (
    <div className={`rounded-xl border-2 p-4 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-right-4 ${
      isOnTargetScreen ? "border-yellow-400 bg-yellow-50" : "border-indigo-300 bg-indigo-50"
    }`}>
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      
      <h3 className={`text-[13px] font-extrabold mb-1 flex items-center gap-1.5 ${
        isOnTargetScreen ? "text-yellow-900" : "text-indigo-900"
      }`}>
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isOnTargetScreen ? "bg-yellow-500" : "bg-indigo-400"
          }`}></span>
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            isOnTargetScreen ? "bg-yellow-600" : "bg-indigo-500"
          }`}></span>
        </span>
        {isOnTargetScreen ? "사람의 확인이 필요합니다" : `다음 단계(${target?.name || "알 수 없음"}) 대기 중`}
      </h3>
      <p className={`text-[11px] mb-3 leading-relaxed ${
        isOnTargetScreen ? "text-yellow-800/80" : "text-indigo-800/80"
      }`}>
        {isOnTargetScreen 
          ? "다음 단계로 파이프라인을 진행하기 앞서, AI가 도출한 중간 결과에 대해 담당자의 최종 확인 및 승인이 필요하여 분석이 일시 정지되었습니다."
          : `파이프라인이 정상적으로 일시 정지되었습니다! 오류가 아니니 안심하세요. 현재 단계의 상세 결과를 충분히 검토하신 후, 화면 안내에 따라 다음 단계로 넘어가시면 됩니다.`}
      </p>
    </div>
  );
}

const STEP_NAME_MAP: Record<string, string> = {
  "정제": "데이터 정리",
  "후보 필지 생성": "후보 지역 생성",
  "가중치 산정": "중요도 산정",
  "후보점 생성": "후보 위치 선정",
  "점수화·배제 적용": "점수 계산",
  "위치 선정": "위치 확정",
  "감리 규칙 DB 적재 (토론 근거)": "토론 근거 생성",
  "후보점 DB 적재 (화면5 목록)": "후보 위치 등록",
};

function StepRow({ step, baselineSec }: { step: RunStep; baselineSec: number | null }) {
  const isRunning = step.status === "running";
  const isDone = step.status === "done";
  const isFailed = step.status === "failed";
  
  const displayLabel = STEP_NAME_MAP[step.label] || step.label;

  return (
    <li className={`flex items-center justify-between p-2 rounded-lg text-[11px] transition-colors ${
      isRunning ? 'bg-blue-50 border border-blue-100' : isFailed ? 'bg-red-50 border border-red-100' : 'hover:bg-gray-50'
    }`}>
      <div className="flex items-center gap-2 truncate">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'bg-blue-500 animate-pulse' : isDone ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-gray-300'}`} />
        <span className={`truncate ${isRunning ? 'font-bold text-blue-900' : isDone ? 'text-gray-700' : 'text-gray-500'}`}>{displayLabel}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-gray-400 font-mono">
          {typeof step.sec === "number" ? `${step.sec.toFixed(1)}s` : isDone ? "0s" : baselineSec !== null ? `~${baselineSec.toFixed(0)}s` : ""}
        </span>
      </div>
    </li>
  );
}

function statusLabel(run: RunDoc): string {
  if (run.status === "awaiting_hitl" && run.gate) {
    if (run.gate.id === "audit") return "데이터 분석 진행 중";
    // ⚠ 어휘는 아래 `STEP_NAME_MAP` 과 맞춘다 — 같은 패널 안에서 단계 이름은
    //    「중요도 산정」인데 이 줄만 「가중치」면 두 낱말이 같은 것을 가리키는지
    //    화면만 보고는 알 수 없다. (앱의 다른 화면은 도메인 용어 「가중치」 그대로다)
    if (run.gate.id === "weight") return "중요도 설정 진행 중";
  }
  return {
    queued: "대기 중",
    running: "데이터 처리 중",
    awaiting_hitl: "일시 정지됨",
    succeeded: "분석 완료",
    failed: "분석 실패",
  }[run.status] ?? run.status;
}
