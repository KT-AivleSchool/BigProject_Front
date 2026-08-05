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
    <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-amber-900">
          {gate.label}
        </h2>
        <span className="tnum text-[12px] text-amber-900/70">
          {gate.questions.length}건 · gate <code>{gate.id}</code> · run{" "}
          <span className="font-medium">{runId}</span>
        </span>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-amber-900">{lead}</p>

      <div className="mt-4 flex flex-col gap-3">{children}</div>

      {error && (
        <pre className="mt-4 whitespace-pre-wrap break-all rounded border border-red-300 bg-red-50 p-3 font-mono text-[12px] text-red-800">
          {error}
        </pre>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-amber-200 pt-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="btn-primary text-[13px] disabled:opacity-40"
        >
          {submitting ? "보내는 중…" : submitLabel}
        </button>
        <span className="text-[11px] leading-relaxed text-amber-900/80">
          이 게이트의 답을 <b>한 번에</b> 보냅니다. 항목별로 나눠 보내면 서버가
          전체를 놓고 하는 검증(예: 전 지표 슬라이더 합)을 할 수 없습니다.
        </span>
      </div>
    </section>
  );
}

/** 확정돼 못 고치는 항목임을 표시한다. **감추지 않는다** — 감추면 화면이 사실의 일부만 보여준다. */
export function LockedBadge() {
  return (
    <span
      className="rounded bg-black/[0.06] px-1.5 py-0.5 text-[11px] text-ink-secondary"
      title="HITL 전에 조례·코드표에서 근거를 찾아 확정된 항목입니다. 수정을 보내면 서버가 400 으로 되돌립니다."
    >
      🔒 확정됨 · 수정 불가
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
  /** 데이터셋 id 또는 지표 id. 배지로만 쓴다. */
  id: string;
  title: React.ReactNode;
  editable: boolean;
  warn?: boolean;
  /**
   * 제목줄 **오른쪽 끝**. 이름이 아닌 것(분류 배지·변경 표시)을 제목 옆에 붙이면
   * 그것도 이름처럼 읽힌다 — 자리를 갈라 놓는다.
   */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        warn ? "border-amber-400 bg-amber-100/50" : "border-hairline bg-white"
      } ${editable ? "" : "opacity-90"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="tnum rounded bg-black/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
            {id}
          </span>
          <span className="text-[14px] font-semibold">{title}</span>
          {!editable && <LockedBadge />}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Fact({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-secondary">{k}</dt>
      <dd className="tnum text-[12px] font-medium">
        {v}
        {sub && <span className="ml-1 text-[11px] font-normal text-ink-secondary">{sub}</span>}
      </dd>
    </div>
  );
}
