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
 *
 * ── 배치에 대하여 (2026-08-05 개편) ────────────────────────────
 * 처음엔 카드 하나에 「근거 5칸 → 반경 → 슬라이더」를 **세로로 쌓았다.** 그러면
 * 읽는 순서가 뒤집힌다 — 사람이 이 화면에 온 이유는 **값을 정하려고**인데,
 * 눈에 먼저 닿는 것이 감리가 이미 정해 둔 참고값이었고 정작 만질 것은 카드
 * 맨 아래 회색 글씨 옆에 있었다. 지금은 좌우로 나눈다: **왼쪽 = 내가 정하는 값**
 * (흰 판·큰 글씨), **오른쪽 = 감리·제안 근거**(옅은 판·작은 글씨).
 * 세로 길이도 카드당 절반이 된다.
 */
import { useState } from "react";
import { GateFrame, QuestionCard } from "./GateFrame";
import { fixed, meters } from "@/lib/omnisite/format";
import { isWeightQuestion } from "@/lib/omnisite/gate";
import { indicatorLabel, type DatasetLabel } from "@/lib/omnisite/labels";
import { useRun } from "@/lib/omnisite/RunProvider";
import type { GateWeightQuestion, RunGate, WeightAnswer } from "@/lib/omnisite/types";

/** `+0.75` / `-0.30` / `0.00` — **부호가 방향**이므로 양수에도 부호를 붙인다. */
function signed(v: number, digits = 2): string {
  return `${v > 0 ? "+" : ""}${fixed(v, digits)}`;
}

function dirWord(d: string): string {
  return d === "cost" ? "낮을수록 좋음" : d === "benefit" ? "높을수록 좋음" : d;
}

export function WeightGate({
  gate,
  runId,
  labels,
}: {
  gate: RunGate;
  runId: string;
  /**
   * 지표 이름 짓기용. **없으면 id 로 떨어진다** — 지어내지 않는다.
   * 게이트B 시점에는 `reviewed`(STEP1)·`clean_report`(STEP2)가 이미 있으므로
   * 실제로는 거의 항상 채워진다(실측 r_20260805_013).
   */
  labels: Map<string, DatasetLabel>;
}) {
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
  /** 제안과 달라진 지표. 「내가 뭘 만졌는지」를 보내기 전에 볼 수 있어야 한다. */
  const changed = questions.filter((q) => {
    const r = (radius[q.indicator_id] ?? "").trim();
    const rDiff =
      q.radius_required && r !== (q.radius_proposed === null ? "" : String(q.radius_proposed));
    const sDiff = (slider[q.indicator_id] ?? null) !== (q.slider_proposed ?? null);
    return rDiff || sDiff;
  });
  /** 비어 있으면 서버가 400 으로 되돌린다. 버튼을 끄는 대신 **미리 말해 준다.** */
  const missingRadius = questions.filter(
    (q) => q.radius_required && !(radius[q.indicator_id] ?? "").trim(),
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
        </>
      }
    >
      {/* ── 슬라이더 읽는 법 ───────────────────────────────
          카드마다 되풀이하면 여섯 번 읽어야 한다. 규칙은 전 지표 공통이므로
          맨 위에 한 번만 둔다. */}
      <div className="rounded-lg border border-amber-200 bg-white/70 px-4 py-3">
        <p className="text-[12px] font-medium">슬라이더 읽는 법</p>
        <div className="mt-2 grid gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-3">
          <Legend tone="cost" head="−1 … 0 미만">
            <b>낮을수록 좋음</b>(cost). 값이 클수록 점수가 <b>내려갑니다</b>.
          </Legend>
          <Legend tone="zero" head="정확히 0">
            이 지표를 <b>점수에서 뺍니다</b>. 「중요도 낮음」이 아니라 <b>제외</b>입니다.
          </Legend>
          <Legend tone="benefit" head="0 초과 … +1">
            <b>높을수록 좋음</b>(benefit). 값이 클수록 점수가 <b>올라갑니다</b>.
          </Legend>
        </div>
      </div>

      {/* ── 요약 띠 ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-hairline bg-white px-4 py-2.5 text-[12px]">
        <Metric label="지표" value={`${questions.length}개`} />
        <Metric label="슬라이더 절대값 합" value={fixed(sum, 3)} />
        <Metric
          label="제안과 다르게 정한 지표"
          value={`${changed.length}개`}
          note={changed.length > 0 ? changed.map((q) => q.indicator_id).join(", ") : undefined}
        />
        {sum === 0 && (
          <span className="rounded bg-red-50 px-2 py-1 text-red-700">
            🔴 합이 0 이면 모든 후보 점수가 0 이 됩니다 — 서버가 400 으로 되돌립니다.
          </span>
        )}
        {missingRadius.length > 0 && (
          <span className="rounded bg-red-50 px-2 py-1 text-red-700">
            🔴 집계 반경이 빈 지표 {missingRadius.length}개(
            {missingRadius.map((q) => q.indicator_id).join(", ")}) — 서버가 400 으로 되돌립니다.
          </span>
        )}
      </div>

      {questions.map((q) => (
        <WeightCard
          key={q.indicator_id}
          q={q}
          name={indicatorLabel(q.indicator_id, q.components ?? {}, labels)}
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

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-ink-secondary">{label}</span>
      <b className="tnum text-[13px]">{value}</b>
      {note && <span className="tnum text-[11px] text-ink-secondary">({note})</span>}
    </span>
  );
}

function Legend({
  tone,
  head,
  children,
}: {
  tone: "cost" | "zero" | "benefit";
  head: string;
  children: React.ReactNode;
}) {
  const dot =
    tone === "cost" ? "bg-red-600" : tone === "benefit" ? "bg-emerald-600" : "bg-ink-secondary";
  return (
    <div className="flex gap-2">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <p className="leading-relaxed">
        <span className="tnum font-medium">{head}</span>
        <span className="mx-1.5 text-ink-secondary">·</span>
        <span className="text-ink-secondary">{children}</span>
      </p>
    </div>
  );
}

function WeightCard({
  q,
  name,
  radius,
  slider,
  acked,
  onRadius,
  onSlider,
  onAck,
}: {
  q: GateWeightQuestion;
  name: string;
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
  const radiusChanged =
    q.radius_required &&
    radius.trim() !== (q.radius_proposed === null ? "" : String(q.radius_proposed));
  const sliderChanged = (slider ?? null) !== (q.slider_proposed ?? null);

  return (
    <QuestionCard
      id={q.indicator_id}
      editable
      warn={!!q.conflict}
      title={name}
      /* 지표 종류는 이름이 아니라 **분류**다. 제목 자리에 두면 「point_sum」 이
         시설 이름인 것처럼 읽힌다 — 오른쪽 끝에 배지로 뺀다. */
      aside={
        <span className="flex items-center gap-2">
          {(radiusChanged || sliderChanged) && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              제안과 다름
            </span>
          )}
          <span className="tnum rounded bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-ink-secondary">
            {q.indicator_kind}
          </span>
        </span>
      }
    >
      {q.rationale && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">{q.rationale}</p>
      )}

      {/* ── 정할 값 — 반경과 슬라이더를 **한 줄에** 나란히 ────────────
          처음엔 좌우 2단(왼쪽 입력·오른쪽 근거)으로 짰다. 입력이 앞으로 오긴
          했는데 오른쪽 근거가 세로 5줄이 되면서 **카드가 213px → 304px 로
          되레 길어졌다**(실측). 근거는 값 5개짜리 한 줄이면 충분하다 —
          입력만 판으로 띄우고 근거는 아래 한 줄로 깐다. */}
      <div className="mt-2.5 flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border border-primary/25 bg-white px-4 py-3">
        {/* [R] 집계 반경 */}
        <div className="shrink-0">
          <label className="block text-[11px] font-semibold text-primary" htmlFor={`r-${q.indicator_id}`}>
            집계 반경
          </label>
          {q.radius_required ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                id={`r-${q.indicator_id}`}
                type="number"
                min={1}
                max={5000}
                step={1}
                value={radius}
                onChange={(e) => onRadius(e.target.value)}
                /* `.text-input-notion` 은 레이어 밖이라 `font-size:14px` 가
                   Tailwind 의 `text-*` 를 이긴다(globals.css 주석 참조).
                   그래서 크기를 유틸리티로 낮추려 하지 않는다 — 입력칸은
                   읽기값보다 커야 맞기도 하다. */
                className="text-input-notion tnum w-24 py-1.5"
              />
              <span className="text-[11px] text-ink-secondary">m · 정수 1~5000</span>
            </div>
          ) : (
            /* 🔴 admin 지표에 반경을 보내면 400 이다. 칸 자체를 안 만든다. */
            <p className="mt-1.5 max-w-[220px] text-[11px] leading-relaxed text-ink-secondary">
              행정동 단위 지표라 <b>반경이 없습니다</b> — 보내면 400 입니다.
            </p>
          )}
        </div>

        {/* [W] 가중치 슬라이더 */}
        <div className="min-w-[280px] flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold text-primary">가중치</span>
            <span className="flex items-baseline gap-2">
              <b
                className={`tnum text-[18px] leading-none ${
                  v === 0 ? "text-ink-secondary" : cost ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {signed(v)}
              </b>
              <span className="text-[11px] text-ink-secondary">
                {v === 0 ? "이 지표를 뺍니다" : dirWord(cost ? "cost" : "benefit")}
              </span>
            </span>
          </div>

          <SignedSlider id={`w-${q.indicator_id}`} v={v} onChange={onSlider} />

          {slider === undefined && (
            <p className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">
              제안값이 없습니다 — 슬라이더를 움직여야 값이 지정됩니다.
            </p>
          )}
        </div>
      </div>

      {/* ── 감리·제안 (읽기) — 한 줄 ──────────────────────── */}
      <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[11px] text-ink-secondary">
        <Ref k="데이터" v={q.data_note || "—"} />
        <Ref k="감리" v={`${dirWord(q.direction)} · seed ${fixed(q.seed_weight, 3)}`} />
        <Ref
          k="제안"
          v={
            (q.radius_required ? `${meters(q.radius_proposed)} · ` : "") +
            (typeof q.slider_proposed === "number" ? signed(q.slider_proposed, 2) : "—")
          }
          sub={q.radius_source ?? undefined}
        />
      </dl>
      {q.radius_rationale && (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">
          반경 근거 · {q.radius_rationale}
        </p>
      )}

      {q.conflict && (
        <div className="mt-3 rounded border border-amber-400 bg-amber-100 px-3 py-2 text-[12px] text-amber-900">
          <p className="leading-relaxed">
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

/**
 * 부호 있는 슬라이더 — **0 을 가운데 놓고 거기서부터 칠한다.**
 *
 * 🔴 네이티브 `input[type=range]` 의 기본 채움은 **최솟값(-1)에서 시작**한다.
 *    그래서 `+0.50` 이 「75% 찬 막대」로 보였다 — 이 위젯의 의미는 크기가 아니라
 *    **부호(방향)** 인데 그림이 정반대로 말하고 있었다. 채움을 우리가 그리고
 *    네이티브 썸은 투명하게 덮어 둔다(조작·키보드 접근성은 네이티브 그대로).
 *
 * 썸 지름 16px 만큼 네이티브 트랙이 양끝에서 안으로 물러나므로, 우리가 그리는
 * 좌표도 같은 보정을 넣는다 — 안 넣으면 양 끝에서 8px 어긋난다.
 */
function SignedSlider({
  id,
  v,
  onChange,
}: {
  id: string;
  v: number;
  onChange: (v: number) => void;
}) {
  const T = 16; // 썸 지름(px)
  const pct = (v + 1) * 50; // 0~100
  const at = (p: number) => `calc(${p}% + ${(T / 2 - (p * T) / 100).toFixed(3)}px)`;
  const half = Math.abs(pct - 50);
  const color = v === 0 ? "bg-ink-secondary" : v < 0 ? "bg-red-600" : "bg-emerald-600";

  return (
    <>
      <div className="relative mt-2 h-5">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-black/[0.10]" />
        <div
          className={`pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${color}`}
          style={{
            left: pct >= 50 ? at(50) : at(pct),
            width: `calc(${half}% - ${((half * T) / 100).toFixed(3)}px)`,
          }}
        />
        {/* 0 눈금. 「가운데가 0」이 그림으로 보여야 부호를 글로 안 읽어도 안다. */}
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-black/40"
          style={{ left: at(50) }}
        />
        <div
          className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${color}`}
          style={{ left: at(pct) }}
        />
        <input
          id={id}
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent
                     [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:opacity-0
                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:opacity-0"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-secondary">
        <span className="tnum">−1 낮을수록 좋음</span>
        <span className="tnum">0 제외</span>
        <span className="tnum">+1 높을수록 좋음</span>
      </div>
    </>
  );
}

/** 참고값 한 칸. 이름과 값을 같은 줄에 두되 **값만 진하게** — 눈이 값을 먼저 잡는다. */
function Ref({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="shrink-0">{k}</dt>
      <dd className="tnum font-medium text-ink">
        {v}
        {sub && <span className="ml-1 font-normal text-ink-secondary">({sub})</span>}
      </dd>
    </div>
  );
}
