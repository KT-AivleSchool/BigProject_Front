"use client";

/**
 * 게이트 답변 폼의 공통 껍데기.
 * ============================
 * 게이트A(화면 2)와 게이트B(화면 3)가 같은 모양을 쓴다. 머리말 · 제출 바 ·
 * 오류 표시가 두 벌이 되면 한쪽만 고쳐지고 언젠가 다르게 말한다.
 *
 * 🔴 **제출 버튼을 조건부로 끄지 않는다.** 2026-08-05 화면 1 에서 같은 실수를 했다 —
 *    꺼진 버튼은 눌러도 아무 일이 없고, 그러면 왜 못 보내는지 알아낼 방법이 화면에
 *    없다. 여기서는 항상 눌리고, 못 보낼 사정이 있으면 **그 사정을 글로 말한다.**
 *    (보내는 중일 때만 끈다 — 중복 제출은 다른 문제다)
 */
import type { RunGate } from "@/lib/omnisite/types";

export function GateFrame({
  gate,
  runId,
  lead,
  children,
  onSubmit,
  submitting,
  error,
  submitLabel,
}: {
  gate: RunGate;
  runId: string;
  lead: React.ReactNode;
  children: React.ReactNode;
  onSubmit: () => void;
  submitting: boolean;
  /** 서버가 준 사유(`detail`) 또는 화면이 막은 사유. 문구를 지어내지 않는다. */
  error: string | null;
  submitLabel: string;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>

      <div className="flex items-center gap-3 mb-5 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl shadow-sm relative z-10 animate-in fade-in slide-in-from-top-2">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </span>
        <div className="text-sm leading-relaxed">
          <strong className="text-amber-700 mr-1.5">[HITL 작동 중]</strong> 
          AI가 전문가(사용자)님의 승인 및 개입을 기다리며 분석을 일시 중단했습니다. 확인을 완료해야 다음 단계가 진행됩니다.
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
        <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
          {gate.label}
        </h2>
        <span className="text-xs font-semibold text-blue-800 bg-blue-100/50 px-3 py-1.5 rounded-full border border-blue-200/50 shadow-sm">
          검토 대기: <span className="text-blue-900 font-bold">{gate.questions.length}건</span>
        </span>
      </div>

      <div className="text-[13px] leading-relaxed text-blue-800 mb-6 bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative z-10">
        {lead}
      </div>

      <div className="flex flex-col gap-5 relative z-10">{children}</div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800 flex items-start gap-3 shadow-sm relative z-10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <pre className="whitespace-pre-wrap break-all font-mono">{error}</pre>
        </div>
      )}

      <div className="sticky bottom-6 mt-10 flex flex-wrap items-center justify-between gap-4 border-2 border-blue-200 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 animate-pulse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
          <span className="text-[13px] leading-relaxed text-blue-900 max-w-lg font-medium">
            항목들을 꼼꼼히 확인하셨나요? 우측 버튼을 눌러 <strong>{gate.label}</strong>을(를) 승인하고 다음 분석을 계속 진행합니다.
          </span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              제출 및 승인 중...
            </>
          ) : (
            <>
              {submitLabel}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </>
          )}
        </button>
      </div>
    </section>
  );
}

export function LockedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-500 border border-gray-200"
      title="법령 및 조례를 통해 AI가 명확한 근거를 찾아 확정한 항목입니다. (읽기 전용)"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      자동 확정됨
    </span>
  );
}

export function QuestionCard({
  id,
  title,
  editable,
  warn,
  aside,
  children,
}: {
  id: string;
  title: React.ReactNode;
  editable: boolean;
  warn?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`rounded-xl border bg-white p-5 shadow-sm transition-colors ${
        warn ? "border-amber-300" : editable ? "border-blue-200 hover:border-blue-300" : "border-gray-200 opacity-90"
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-gray-50 pb-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold ${editable ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
            {id}
          </span>
          <h3 className={`text-sm font-bold ${editable ? 'text-gray-900' : 'text-gray-600'}`}>{title}</h3>
          {!editable && <LockedBadge />}
        </div>
        {aside && <div className="text-sm">{aside}</div>}
      </header>
      <div className="space-y-3">{children}</div>
    </article>
  );
}

export function Fact({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px] bg-gray-50 p-2.5 rounded-lg border border-gray-100">
      <dt className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{k}</dt>
      <dd className="text-sm font-medium text-gray-900">
        {v}
        {sub && <span className="block text-[11px] font-normal text-gray-400 mt-0.5">{sub}</span>}
      </dd>
    </div>
  );
}
