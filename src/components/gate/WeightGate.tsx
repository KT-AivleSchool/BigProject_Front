"use client";

/**
 * 게이트B 답변 폼 — 집계반경 [R] + 가중치 슬라이더 [W] (계약 7-5)
 * ================================================================
 * 화면 3 안에 산다. **`weight_set.json` 을 그리는 부분과 다른 층의 값이다** —
 * 여기 있는 것은 계산 **전** 입력(제안 패스가 만든 `radius_proposed` ·
 * `slider_proposed`)이고, 아래 표는 계산이 **끝난** `w_final` 이다. 그래서 이 폼이
 * 열려 있는 동안에는 아래 표가 **직전 실행의 값**이거나 아예 없다.
 *
 * 🔴 **슬라이더는 `-1 ~ +1` 을 그대로 보낸다.** 프런트가 `{seed_weight, direction}`
 *    으로 분해하지 않는다. 분해하면 (1) `normalize_matrix` 의 cost 반전과 이중으로
 *    걸려 조용히 뒤집히고 (2) `direction_source` 가 산출물에서 사라진다.
 *    분해는 `apply_weight_hitl` 이 경계에서 한다.
 *
 * 🔴 **0 은 "그 지표 제외"** 다. 그리고 전 지표 절대값 합이 0 이면 서버가 400 으로
 *    막는다 — 안 막으면 전 후보 점수가 0 이 된다(백엔드가 겪은 사고).
 */
import { useState } from "react";
import { Fact, GateFrame, QuestionCard } from "./GateFrame";
import { fixed, meters } from "@/lib/omnisite/format";
import { isWeightQuestion } from "@/lib/omnisite/gate";
import { useRun } from "@/lib/omnisite/RunProvider";
import type { GateWeightQuestion, RunGate, WeightAnswer } from "@/lib/omnisite/types";

export function WeightGate({ gate, runId }: { gate: RunGate; runId: string }) {
  const { answerWeight } = useRun();

  const questions = gate.questions.filter(isWeightQuestion);

  /**
   * 🔴 제안값으로 **초기화**한다(빈 값이 아니라). 게이트B 는 「확인하고 고친다」이지
   *    「처음부터 채운다」가 아니다 — 빈 칸으로 두면 사람이 제안값을 다시 옮겨 적게
   *    되고, 옮겨 적는 값은 언젠가 틀린다.
   *
   *    `slider_proposed` 가 `null` 인 지표는 **키를 안 만든다.** 없는 제안을 0 으로
   *    채우면 "이 지표를 빼기로 했다" 는 뜻이 돼 버린다(0 = 제외).
   */
  const [radius, setRadius] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const q of questions) {
      if (q.radius_required && typeof q.radius_proposed === "number") {
        o[q.indicator_id] = String(q.radius_proposed);
      }
    }
    return o;
  });
  const [slider, setSlider] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const q of questions) {
      if (typeof q.slider_proposed === "number") o[q.indicator_id] = q.slider_proposed;
    }
    return o;
  });
  /** 방향 충돌은 규칙으로 못 정한다 — 사람이 봤다는 표시를 따로 받는다. */
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sum = questions.reduce(
    (s, q) => s + Math.abs(slider[q.indicator_id] ?? 0),
    0,
  );

  function build(): WeightAnswer | string {
    const outR: Record<string, number> = {};
    for (const q of questions) {
      if (!q.radius_required) continue; // admin 지표에 보내면 400
      const raw = (radius[q.indicator_id] ?? "").trim();
      if (!raw) continue; // 서버가 "집계반경이 빠진 지표" 로 되돌린다
      const n = Number(raw);
      if (!Number.isInteger(n)) {
        return `[${q.indicator_id}] 집계반경은 정수 m 이어야 합니다 (입력: ${JSON.stringify(raw)}).`;
      }
      outR[q.indicator_id] = n;
    }

    /**
     * 🔴 충돌 지표는 서버가 `slider` 에 **반드시 있어야 한다**고 요구한다. 우리는
     *    모든 지표를 보내므로 형식상 항상 충족된다 — 그래서 여기서 한 겹 더 막는다.
     *    형식만 맞추고 사람이 안 본 채 제안값이 확정되면, 백엔드가 일부러 사람에게
     *    넘긴 판단(원칙 3)이 조용히 자동 처리된다.
     */
    const unacked = questions
      .filter((q) => q.conflict && !acked[q.indicator_id])
      .map((q) => q.indicator_id);
    if (unacked.length) {
      return (
        `방향 판정이 충돌한 지표를 확인해 주세요: ${unacked.join(", ")}\n` +
        "geo 쪽과 val 쪽 방향이 갈렸습니다. 슬라이더 부호로 확정한 뒤 「확인했습니다」를 체크하십시오."
      );
    }

    return { run_id: runId, radius: outR, slider };
  }

  async function onSubmit() {
    const built = build();
    if (typeof built === "string") {
      setError(built);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await answerWeight(built);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GateFrame
      gate={gate}
      runId={runId}
      submitting={submitting}
      error={error}
      onSubmit={() => void onSubmit()}
      submitLabel="이 값으로 계속 진행"
      lead={
        <>
          실행이 <b>여기서 멈춰</b> 사람을 기다리고 있습니다. 칸에 들어 있는 값은
          <b> 제안값</b>(제안 패스가 만든 것)이고, 그대로 보내면 제안대로 갑니다.
          슬라이더는 <code>-1 ~ +1</code> 이며 <b>부호가 방향</b>(+ 높을수록 좋음 /
          − 낮을수록 좋음), <b>0 은 그 지표를 빼는 것</b>입니다.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-hairline bg-white px-4 py-2.5 text-[12px]">
        <span>
          지표 <b className="tnum">{questions.length}</b>개
        </span>
        <span>
          슬라이더 절대값 합 <b className="tnum">{fixed(sum, 3)}</b>
        </span>
        {sum === 0 && (
          <span className="text-red-700">
            🔴 합이 0 이면 모든 후보 점수가 0 이 됩니다 — 서버가 400 으로 되돌립니다.
          </span>
        )}
      </div>

      {questions.map((q) => (
        <WeightCard
          key={q.indicator_id}
          q={q}
          radius={radius[q.indicator_id] ?? ""}
          slider={slider[q.indicator_id]}
          acked={acked[q.indicator_id] ?? false}
          onRadius={(v) => setRadius((p) => ({ ...p, [q.indicator_id]: v }))}
          onSlider={(v) => setSlider((p) => ({ ...p, [q.indicator_id]: v }))}
          onAck={(v) => setAcked((p) => ({ ...p, [q.indicator_id]: v }))}
        />
      ))}
    </GateFrame>
  );
}

function WeightCard({
  q,
  radius,
  slider,
  acked,
  onRadius,
  onSlider,
  onAck,
}: {
  q: GateWeightQuestion;
  radius: string;
  /** `undefined` = 제안값이 없어 아직 아무 값도 안 보낸다. `0` 과 다르다. */
  slider: number | undefined;
  acked: boolean;
  onRadius: (v: string) => void;
  onSlider: (v: number) => void;
  onAck: (v: boolean) => void;
}) {
  const v = slider ?? 0;
  const cost = v < 0;
  const geo = q.components?.geo ?? null;
  const val = q.components?.val ?? null;

  return (
    <QuestionCard
      id={q.indicator_id}
      editable
      warn={!!q.conflict}
      title={
        <>
          {q.indicator_kind}
          <span className="ml-2 font-normal text-ink-secondary">
            {geo ?? "—"}
            {val ? ` + ${val}` : ""}
          </span>
        </>
      }
    >
      {q.rationale && (
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{q.rationale}</p>
      )}

      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
        <Fact k="데이터" v={q.data_note || "—"} />
        <Fact k="감리 방향" v={q.direction} />
        <Fact k="감리 크기 seed" v={fixed(q.seed_weight, 3)} />
        <Fact k="제안 반경" v={meters(q.radius_proposed)} sub={q.radius_source ?? undefined} />
        <Fact k="제안 슬라이더" v={fixed(q.slider_proposed, 3)} />
      </dl>

      {q.radius_rationale && (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">
          반경 근거 · {q.radius_rationale}
        </p>
      )}

      {/* ── 집계 반경 [R] ─────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="w-[86px] shrink-0 text-ink-secondary">집계 반경</span>
        {q.radius_required ? (
          <>
            <input
              type="number"
              min={1}
              max={5000}
              step={1}
              value={radius}
              onChange={(e) => onRadius(e.target.value)}
              className="text-input-notion tnum w-28 py-1 text-[12px]"
            />
            <span className="text-ink-secondary">m (정수 1~5000, 필수)</span>
          </>
        ) : (
          /* 🔴 admin 지표에 반경을 보내면 400 이다. 칸 자체를 안 만든다. */
          <span className="text-ink-secondary">
            행정동 단위 지표라 반경이 없습니다 — 보내면 400 입니다.
          </span>
        )}
      </div>

      {/* ── 슬라이더 [W] ──────────────────────────────── */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
        <span className="w-[86px] shrink-0 text-ink-secondary">가중치</span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={v}
          onChange={(e) => onSlider(Number(e.target.value))}
          className="w-[240px]"
        />
        <span
          className={`tnum w-[52px] text-right font-medium ${
            v === 0 ? "text-ink-secondary" : cost ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {fixed(v, 2)}
        </span>
        <span className="text-[11px] text-ink-secondary">
          {v === 0
            ? "0 — 이 지표를 점수에서 뺍니다"
            : cost
              ? "− 낮을수록 좋음 (cost)"
              : "+ 높을수록 좋음 (benefit)"}
        </span>
        {slider === undefined && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">
            제안값 없음 — 움직이면 지정됩니다
          </span>
        )}
      </div>

      {q.conflict && (
        <div className="mt-3 rounded border border-amber-400 bg-amber-100 px-3 py-2 text-[12px] text-amber-900">
          <p>
            ⚠ <b>방향 판정이 갈렸습니다.</b> {q.conflict.geo_dataset} 은{" "}
            <b>{q.conflict.geo_direction}</b>, {q.conflict.val_dataset} 은{" "}
            <b>{q.conflict.val_direction}</b> 로 판정됐습니다. 엔진은 크기는 평균을 쓰고
            방향은 val 쪽만 쓰므로, 그대로 두면 geo 쪽 판정이 조용히 사라집니다.
            어느 쪽이 옳은지는 도메인마다 달라 규칙으로 정하지 않습니다.
          </p>
          <label className="mt-2 flex items-center gap-1.5 font-medium">
            <input type="checkbox" checked={acked} onChange={(e) => onAck(e.target.checked)} />
            슬라이더 부호로 방향을 확정했습니다
          </label>
        </div>
      )}
    </QuestionCard>
  );
}
