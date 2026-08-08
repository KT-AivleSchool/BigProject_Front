"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gateScreen } from "@/lib/omnisite/gate";
import { useRun } from "@/lib/omnisite/RunProvider";
import { computeProgress, formatDuration, loadBaseline } from "@/lib/omnisite/progress";
import { fetchRunLog } from "@/lib/omnisite/pipeline";
import { datetime, int, percent } from "@/lib/omnisite/format";
import { SCREENS } from "@/lib/omnisite/screens";
import type { RunDoc, RunStep } from "@/lib/omnisite/types";

export function ProgressSidebar() {
  const { run, restoring, runningElapsedSec, refresh } = useRun();
  const baseline = loadBaseline();
  const [isOpen, setIsOpen] = useState(false);

  // Auto-open sidebar when a run exists and is not succeeded/failed
  useEffect(() => {
    if (run && (run.status === "running" || run.status === "awaiting_hitl" || run.status === "queued")) {
      setIsOpen(true);
    }
  }, [run?.status]);

  if (!isOpen) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-white border border-gray-200 border-r-0 rounded-l-xl shadow-md p-3 flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors"
          title="진행 현황 열기"
        >
          <span className="writing-vertical text-xs font-semibold text-gray-500 tracking-widest" style={{ writingMode: 'vertical-rl' }}>
            분석 현황
          </span>
          {run && (run.status === "running" || run.status === "queued") && (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mt-2" />
          )}
          {run && run.status === "awaiting_hitl" && (
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse mt-2" />
          )}
        </button>
      </div>
    );
  }

  return (
    <aside className="w-[420px] bg-gray-50/80 backdrop-blur-xl border-l border-gray-200 flex flex-col h-[calc(100vh-56px)] sticky top-[56px] shadow-sm shrink-0">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white/50">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-800">실시간 분석 모니터링</h2>
          {run && (run.status === "running" || run.status === "queued") && (
             <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        {restoring ? (
          <p className="text-xs text-gray-500 text-center mt-10">이전 실행을 확인하는 중…</p>
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
  const p = computeProgress(run, baseline, runningElapsedSec);
  const live = run.status === "queued" || run.status === "running";

  return (
    <div className="flex flex-col gap-5">
      {/* ── 요약 메타 정보 ── */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <dl className="grid grid-cols-2 gap-y-3 text-xs">
          <div className="col-span-2">
            <dt className="text-gray-400 mb-0.5">Run ID</dt>
            <dd className="font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded inline-block text-[10px] break-all">{run.run_id}</dd>
          </div>
          <div>
            <dt className="text-gray-400 mb-0.5">도메인</dt>
            <dd className="font-semibold text-gray-700">{run.domain}</dd>
          </div>
          <div>
            <dt className="text-gray-400 mb-0.5">모드</dt>
            <dd className="font-medium text-gray-700">{run.mode === "hitl" ? "대화형" : "자동"}</dd>
          </div>
        </dl>
      </div>

      {/* ── 진행률 ── */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
          <div 
            className={`h-full transition-[width] duration-500 ${run.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: p.ratio === null ? "0%" : `${p.ratio * 100}%` }}
          />
        </div>
        
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-800">{statusLabel(run.status)}</span>
          <span className="text-lg font-black text-gray-900 tracking-tight">{p.ratio === null ? "—%" : percent(p.ratio, 0)}</span>
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

      {/* ── 로그 ── */}
      <LogPanel runId={run.run_id} live={live} />
      
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
  const gate = run.gate;
  const target = gate ? gateScreen(gate.id) : null;

  return (
    <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-right-4">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      
      <h3 className="text-[13px] font-extrabold text-yellow-900 mb-1 flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-600"></span>
        </span>
        사람의 확인이 필요합니다
      </h3>
      <p className="text-[11px] text-yellow-800/80 mb-3 leading-relaxed">
        AI가 중간 결과를 도출했습니다. 다음 단계로 넘어가기 위해 피드백을 입력해주세요.
      </p>

      {target ? (
        <Link href={target.path} className="flex items-center justify-between w-full px-4 py-2.5 bg-yellow-400 text-yellow-900 rounded-lg text-xs font-bold hover:bg-yellow-500 transition-colors shadow-sm">
          <span>{target.name} 하러 가기</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </Link>
      ) : (
        <p className="text-[11px] text-red-600">게이트 정보를 찾을 수 없습니다.</p>
      )}
    </div>
  );
}

function StepRow({ step, baselineSec }: { step: RunStep; baselineSec: number | null }) {
  const isRunning = step.status === "running";
  const isDone = step.status === "done";
  const isFailed = step.status === "failed";
  
  return (
    <li className={`flex items-center justify-between p-2 rounded-lg text-[11px] transition-colors ${
      isRunning ? 'bg-blue-50 border border-blue-100' : isFailed ? 'bg-red-50 border border-red-100' : 'hover:bg-gray-50'
    }`}>
      <div className="flex items-center gap-2 truncate">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'bg-blue-500 animate-pulse' : isDone ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-gray-300'}`} />
        <span className={`truncate ${isRunning ? 'font-bold text-blue-900' : isDone ? 'text-gray-700' : 'text-gray-500'}`}>{step.label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-gray-400 font-mono">
          {typeof step.sec === "number" ? `${step.sec.toFixed(1)}s` : isDone ? "0s" : baselineSec !== null ? `~${baselineSec.toFixed(0)}s` : ""}
        </span>
      </div>
    </li>
  );
}

function LogPanel({ runId, live }: { runId: string; live: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const preRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const t = await fetchRunLog(runId);
        if (!cancelled) setText(t);
      } catch (e) {
        // ignore
      }
    };
    void load();
    if (!live) return () => void (cancelled = true);
    const timer = setInterval(() => void load(), 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [runId, live]);

  useEffect(() => {
    if (!live || !preRef.current) return;
    preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [text, live]);

  return (
    <div className="bg-black/95 rounded-xl border border-gray-800 overflow-hidden shadow-sm flex flex-col h-[200px]">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between bg-black">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
          Terminal
        </h3>
        {live && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
      </div>
      <div className="flex-1 overflow-auto p-3" ref={preRef}>
        <pre className="font-mono text-[10px] leading-relaxed text-gray-400 whitespace-pre-wrap break-all">
          {text === null ? "Loading logs..." : text === "" ? "Waiting for output..." : text}
        </pre>
      </div>
    </div>
  );
}

function statusLabel(s: string): string {
  return {
    queued: "대기 중",
    running: "분석 진행 중",
    awaiting_hitl: "일시 정지됨",
    succeeded: "분석 완료",
    failed: "분석 실패",
  }[s] ?? s;
}
