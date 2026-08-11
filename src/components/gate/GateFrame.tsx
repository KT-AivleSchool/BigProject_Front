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
  hideTitle,
  children,
  onSubmit,
  submitting,
  error,
  submitLabel,
  confirmedCount,
}: {
  gate: RunGate;
  runId: string;
  lead?: React.ReactNode;
  hideTitle?: boolean;
  children: React.ReactNode;
  onSubmit: () => void;
  submitting: boolean;
  /** 서버가 준 사유(`detail`) 또는 화면이 막은 사유. 문구를 지어내지 않는다. */
  error: string | null;
  submitLabel: string;
  confirmedCount?: number;
}) {
  const hasHeader = !hideTitle || !!lead;

  return (
    <>
      {hasHeader ? (
        <section className="mt-6 rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden relative">
          <div className="bg-blue-50/30 px-4 py-3 border-b border-blue-100">
            {!hideTitle && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                  {gate.label}
                </h2>
              </div>
            )}
            {lead && (
              <div className="text-[13.5px] leading-relaxed text-blue-700">
                {lead}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 p-3 sm:p-4 bg-white relative z-10">
            {children}
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-2 mt-4 relative z-10">
          {children}
        </div>
      )}

      {error && (
        <div className="mt-5 mx-4 mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800 flex items-start gap-3 shadow-sm relative z-10">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <pre className="whitespace-pre-wrap break-all font-mono">{error}</pre>
        </div>
      )}
    </>
  );
}

export function WarningBadge({ text, title }: { text: string; title?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700 border border-amber-200"
      title={title}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      {text}
    </span>
  );
}

export function QuestionCard({
  id,
  title,
  warn,
  confirmed,
  onConfirm,
  onReject,
  isEditing,
  aside,
  children,
  confirmLabel,
  rejectLabel,
  onClick,
}: {
  id: string;
  title: React.ReactNode;
  warn?: boolean;
  confirmed?: boolean;
  onConfirm?: () => void;
  onReject?: () => void;
  isEditing?: boolean;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  rejectLabel?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col sm:flex-row gap-2 sm:gap-3 rounded-xl border p-3 transition-all ${
        onClick ? "cursor-pointer hover:border-blue-400 hover:shadow-md" : ""
      } ${
        confirmed
          ? "border-blue-200 bg-blue-50/30"
          : warn
            ? "border-amber-200 bg-amber-50/10 shadow-sm"
            : "border-gray-200 bg-white shadow-sm hover:border-gray-300"
      }`}
    >
      <div className="flex shrink-0 items-start gap-3 sm:w-64">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold text-gray-500 font-mono">
          {id}
        </span>
        <h3 className="mt-0.5 text-[14px] font-bold text-gray-900 leading-snug break-all">
          {title}
        </h3>
        {aside}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">{children}</div>
      {(onConfirm || onReject) && (
        <div className="mt-2 sm:mt-0 shrink-0 self-end sm:self-center flex gap-1.5">
          {onConfirm && (
            isEditing ? (
              <button
                onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                className="px-4 py-1.5 text-[13px] font-bold rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                {confirmLabel || "적용"}
              </button>
            ) : (
              <div
                className={`px-3 py-1.5 text-[13px] font-bold rounded-lg border flex items-center gap-1.5 ${
                  confirmed
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-gray-50 text-gray-500 border-gray-200"
                }`}
              >
                {confirmed ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    승인 완료
                  </>
                ) : (
                  "승인 필요"
                )}
              </div>
            )
          )}
          {onReject && (
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className={`px-3 py-1.5 text-[13px] font-semibold rounded-lg transition-colors shadow-sm border ${
                isEditing
                  ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {rejectLabel || (isEditing ? "취소" : "수정")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Fact({
  k,
  v,
  sub,
}: {
  k: string;
  v: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px] bg-gray-50 p-2.5 rounded-lg border border-gray-100">
      <dt className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
        {k}
      </dt>
      <dd className="text-sm font-medium text-gray-900">
        {v}
        {sub && (
          <span className="block text-[11px] font-normal text-gray-400 mt-0.5">
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}
