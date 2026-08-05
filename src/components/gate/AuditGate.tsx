"use client";

/**
 * 게이트A 답변 폼 — 배제반경 · 데이터 용도 · 지역 코드 (계약 7-4)
 * ==============================================================
 * 화면 2 안에 산다. **`reviewed.json` 을 그리는 부분과 다른 데이터다** —
 * 여기 그리는 것은 `run.gate.questions[]` 이고, 그건 실행이 멈춰 있는 동안에만
 * 존재한다. 산출물 쪽 카드에 「확정」 버튼을 달지 않은 이유가 이것이다.
 *
 * 🔴 **기본값이 "건너뜀" 이다.** 아무것도 안 만지고 보내면 서버에 가는 배열은
 *    비어 있다. `radius_m: null` 은 "반경 없는 면 배제로 **확정**", 키 생략은
 *    "안 건드림". 둘을 한 UI 로 뭉개면 사람이 확정한 적 없는 값이 확정된다.
 *    그래서 반경은 라디오 **3지**로 받는다 — 건너뜀 · 반경 없음 · 값 지정.
 *
 * 🔴 `editable: false` 인 항목도 **전부 보여준다.** 보내지는 않는다(보내면 400).
 *    흡연 픽스처는 4건 전부 여기 해당해서, 이 폼은 「확인하고 그대로 진행」이 된다.
 */
import { useState } from "react";
import { Fact, GateFrame, QuestionCard } from "./GateFrame";
import { isAuditQuestion } from "@/lib/omnisite/gate";
import { meters } from "@/lib/omnisite/format";
import { useRun } from "@/lib/omnisite/RunProvider";
import type {
  AuditAnswer,
  AuditAnswerCodePrefix,
  AuditAnswerExclusion,
  AuditAnswerIntent,
  GateCodePrefixQuestion,
  GateExclusionQuestion,
  GateIntentQuestion,
  RunGate,
} from "@/lib/omnisite/types";

/** 반경 답의 세 갈래. CLI 의 `s`(건너뜀) · `n`(반경 없음) · 숫자에 그대로 대응한다. */
type RadiusMode = "skip" | "none" | "value";

interface ExclusionState {
  mode: RadiusMode;
  /** 문자열로 들고 있는다 — 빈 칸과 0 을 구분해야 하고, 입력 중 상태도 있다. */
  value: string;
}

interface IntentState {
  choice: number | null;
  weight: string;
}

interface PrefixState {
  /** 체크해야 보낸다. 접두 코드는 **틀려도 행 수가 그럴듯해서 자동 검증이 못 잡는다.** */
  confirm: boolean;
  value: string;
}

const exKey = (q: GateExclusionQuestion) => `${q.dataset_id}#${q.role_index}`;
const pfKey = (q: GateCodePrefixQuestion) => `${q.dataset_id}#${q.op_index}`;

export function AuditGate({ gate, runId }: { gate: RunGate; runId: string }) {
  const { answerAudit } = useRun();

  const exclusions = gate.questions.filter(
    (q): q is GateExclusionQuestion => q.kind === "exclusion",
  );
  const intents = gate.questions.filter(
    (q): q is GateIntentQuestion => q.kind === "intent",
  );
  const prefixes = gate.questions.filter(
    (q): q is GateCodePrefixQuestion => q.kind === "code_prefix",
  );

  const [ex, setEx] = useState<Record<string, ExclusionState>>({});
  const [it, setIt] = useState<Record<string, IntentState>>({});
  const [pf, setPf] = useState<Record<string, PrefixState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 🔴 `"editable" in q` 로 좁히지 않는다. 그건 **모양을 보고 종류를 정하는 것**이라
   *    나중에 다른 kind 에 같은 이름의 필드가 생기면 조용히 섞인다. 종류는
   *    `kind` 로 판정한다(`isAuditQuestion`).
   */
  const editableCount = gate.questions.filter((q) => isAuditQuestion(q) && q.editable).length;

  function build(): AuditAnswer | string {
    const outEx: AuditAnswerExclusion[] = [];
    for (const q of exclusions) {
      if (!q.editable) continue;
      const s = ex[exKey(q)];
      if (!s || s.mode === "skip") continue;
      if (s.mode === "none") {
        outEx.push({ dataset_id: q.dataset_id, role_index: q.role_index, radius_m: null });
        continue;
      }
      const n = Number(s.value);
      if (!s.value.trim() || !Number.isInteger(n)) {
        return `[${q.dataset_id}] 배제반경에 정수를 입력해 주세요 (현재: ${JSON.stringify(s.value)}).`;
      }
      outEx.push({ dataset_id: q.dataset_id, role_index: q.role_index, radius_m: n });
    }

    const outIt: AuditAnswerIntent[] = [];
    for (const q of intents) {
      if (!q.editable) continue;
      const s = it[q.dataset_id];
      if (!s || s.choice === null) continue;
      const choice = q.choices.find((c) => c.value === s.choice);
      if (!choice) return `[${q.dataset_id}] 알 수 없는 선택지입니다.`;
      if (!choice.needs_weight) {
        outIt.push({ dataset_id: q.dataset_id, choice: s.choice });
        continue;
      }
      const w = Number(s.weight);
      if (!s.weight.trim() || !Number.isFinite(w)) {
        return `[${q.dataset_id}] 「${choice.label}」 은 크기를 같이 정해야 합니다.`;
      }
      outIt.push({ dataset_id: q.dataset_id, choice: s.choice, weight: w });
    }

    const outPf: AuditAnswerCodePrefix[] = [];
    for (const q of prefixes) {
      if (!q.editable) continue;
      const s = pf[pfKey(q)];
      if (!s || !s.confirm) continue;
      if (!s.value.trim()) return `[${q.dataset_id}] 지역 코드가 비어 있습니다.`;
      outPf.push({
        dataset_id: q.dataset_id,
        op_index: q.op_index,
        prefix: s.value.trim(),
      });
    }

    const answer: AuditAnswer = { run_id: runId };
    if (outEx.length) answer.exclusions = outEx;
    if (outIt.length) answer.intents = outIt;
    if (outPf.length) answer.code_prefixes = outPf;
    return answer;
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
      await answerAudit(built);
      // 성공하면 run 이 `running` 으로 바뀌어 이 컴포넌트가 통째로 사라진다.
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
      submitLabel="이 답으로 계속 진행"
      lead={
        <>
          실행이 <b>여기서 멈춰</b> 사람을 기다리고 있습니다. 답을 보내면 STEP2 부터
          이어집니다. <b>고칠 수 있는 항목은 {editableCount}건</b>이고, 나머지는
          이미 확정돼 읽기 전용입니다(감추지 않고 보여줍니다). 아무것도 안 고치고
          그대로 보내도 됩니다 — 그때 서버로 가는 것은 <code>{"{run_id}"}</code> 뿐입니다.
        </>
      }
    >
      {gate.questions.length === 0 && (
        <p className="rounded-lg border border-hairline bg-white px-4 py-3 text-[13px] text-ink-secondary">
          질문이 0건입니다. 그대로 보내면 이어집니다.
        </p>
      )}

      {exclusions.map((q) => (
        <ExclusionCard
          key={exKey(q)}
          q={q}
          state={ex[exKey(q)] ?? { mode: "skip", value: "" }}
          onChange={(s) => setEx((p) => ({ ...p, [exKey(q)]: s }))}
        />
      ))}

      {intents.map((q) => (
        <IntentCard
          key={q.dataset_id}
          q={q}
          state={it[q.dataset_id] ?? { choice: null, weight: "" }}
          onChange={(s) => setIt((p) => ({ ...p, [q.dataset_id]: s }))}
        />
      ))}

      {prefixes.map((q) => (
        <PrefixCard
          key={pfKey(q)}
          q={q}
          state={pf[pfKey(q)] ?? { confirm: false, value: q.suggestion ?? q.prefix }}
          onChange={(s) => setPf((p) => ({ ...p, [pfKey(q)]: s }))}
        />
      ))}
    </GateFrame>
  );
}

function ExclusionCard({
  q,
  state,
  onChange,
}: {
  q: GateExclusionQuestion;
  state: ExclusionState;
  onChange: (s: ExclusionState) => void;
}) {
  // 근거문장에 시설명이 없다 = 다른 시설 규정을 긁었을 수 있다.
  const suspect = q.evidence_matches_facility === false;
  return (
    <QuestionCard
      id={q.dataset_id}
      editable={q.editable}
      warn={suspect}
      title={`배제 반경 — ${q.facility_type ?? "(시설 미상)"}`}
    >
      <p className="mt-1 text-[12px] text-ink-secondary">{q.summary}</p>
      {q.rationale && (
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{q.rationale}</p>
      )}

      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
        <Fact k="현재 확정값" v={meters(q.radius_m)} sub={q.radius_source ?? undefined} />
        {/* 🔴 제안값과 확정값을 한 칸에 합치지 않는다. 합치면 어느 쪽인지 사라진다. */}
        <Fact k="AI 제안값" v={meters(q.proposed_m)} sub={q.proposal_source ?? undefined} />
        <Fact k="배제 형태" v={q.exclusion_type ?? "—"} />
      </dl>

      {q.evidence && (
        <blockquote className="mt-2 border-l-2 border-hairline pl-3 text-[12px] italic text-ink-secondary">
          {q.evidence}
        </blockquote>
      )}
      {suspect && (
        <p className="mt-2 rounded border border-amber-400 bg-amber-100 px-3 py-2 text-[12px] text-amber-900">
          ⚠ 근거문장에 <b>이 시설 이름이 없습니다.</b> 다른 시설의 규정을 가져온 것일 수
          있습니다 — 값을 그대로 받아들이기 전에 근거를 확인하십시오.
        </p>
      )}

      {q.editable ? (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px]">
          <Radio
            name={`ex-${exKey(q)}`}
            checked={state.mode === "skip"}
            onChange={() => onChange({ ...state, mode: "skip" })}
            label="건너뜀 (미확정 유지)"
            title="키를 아예 보내지 않습니다. 지금 값이 그대로 남습니다."
          />
          <Radio
            name={`ex-${exKey(q)}`}
            checked={state.mode === "none"}
            onChange={() => onChange({ ...state, mode: "none" })}
            label="반경 없음 (면 배제로 확정)"
            title="radius_m: null 을 보냅니다 — 건너뜀과 다른 뜻입니다."
          />
          <Radio
            name={`ex-${exKey(q)}`}
            checked={state.mode === "value"}
            onChange={() =>
              onChange({
                mode: "value",
                value: state.value || String(q.proposed_m ?? q.radius_m ?? ""),
              })
            }
            label="반경 지정"
          />
          <label className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={5000}
              step={1}
              value={state.value}
              onChange={(e) => onChange({ mode: "value", value: e.target.value })}
              className="text-input-notion tnum w-24 py-1 text-[12px]"
            />
            <span className="text-ink-secondary">m (1~5000)</span>
          </label>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-ink-secondary">
          조례·코드표에서 근거를 찾아 이미 확정된 항목입니다. 값을 보내면 서버가 400 으로
          되돌립니다. 바꾸려면 감리(STEP1)부터 다시 돌려야 합니다.
        </p>
      )}
    </QuestionCard>
  );
}

function IntentCard({
  q,
  state,
  onChange,
}: {
  q: GateIntentQuestion;
  state: IntentState;
  onChange: (s: IntentState) => void;
}) {
  const picked = q.choices.find((c) => c.value === state.choice) ?? null;
  return (
    <QuestionCard id={q.dataset_id} editable={q.editable} title="데이터 용도">
      <p className="mt-1 text-[12px] text-ink-secondary">{q.summary}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">{q.message}</p>
      <p className="mt-1 text-[11px] text-ink-secondary">
        현재 역할 · {q.current_roles.length ? q.current_roles.join(" · ") : "—"}
      </p>

      {q.editable ? (
        <div className="mt-3 flex flex-col gap-2 text-[12px]">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Radio
              name={`it-${q.dataset_id}`}
              checked={state.choice === null}
              onChange={() => onChange({ choice: null, weight: state.weight })}
              label="건너뜀"
            />
            {q.choices.map((c) => (
              <Radio
                key={c.value}
                name={`it-${q.dataset_id}`}
                checked={state.choice === c.value}
                onChange={() => onChange({ ...state, choice: c.value })}
                label={`${c.value}. ${c.label}`}
              />
            ))}
          </div>
          {picked?.needs_weight && (
            <label className="flex items-center gap-2">
              <span>크기</span>
              <input
                type="number"
                step={0.1}
                min={-1}
                max={1}
                value={state.weight}
                onChange={(e) => onChange({ ...state, weight: e.target.value })}
                className="text-input-notion tnum w-24 py-1 text-[12px]"
              />
              {/* 🔴 부호는 choice 가 정한다. 여기에 부호를 넣으면 두 곳에서 방향을 정하게 된다. */}
              <span className="text-[11px] text-ink-secondary">
                크기만 정합니다 — 가점/감점(부호)은 위 선택이 정합니다. 0 은 안 됩니다
                (빼려면 「잘못 넣음·제외」).
              </span>
            </label>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-ink-secondary">이미 확정된 항목입니다.</p>
      )}
    </QuestionCard>
  );
}

function PrefixCard({
  q,
  state,
  onChange,
}: {
  q: GateCodePrefixQuestion;
  state: PrefixState;
  onChange: (s: PrefixState) => void;
}) {
  return (
    <QuestionCard
      id={q.dataset_id}
      editable={q.editable}
      warn={q.recheck_skipped}
      title={`지역 코드 접두 — ${q.col ?? "(열 미상)"}`}
    >
      <p className="mt-1 text-[12px] text-ink-secondary">{q.summary}</p>

      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
        <Fact k="현재 값" v={q.prefix || "—"} />
        <Fact k="대상 지역" v={q.region || "—"} />
        <Fact k="판정" v={q.verdict ?? "—"} sub={q.confirmed_by ?? undefined} />
        <Fact k="제안" v={q.suggestion ?? "—"} />
      </dl>

      {q.reason && <p className="mt-1 text-[12px] text-ink-secondary">{q.reason}</p>}
      {q.detail && <p className="mt-1 text-[11px] text-ink-secondary">{q.detail}</p>}

      {q.recheck_skipped && (
        <p className="mt-2 rounded border border-amber-400 bg-amber-100 px-3 py-2 text-[12px] text-amber-900">
          ⚠ 코드표 대조를 <b>하지 못했습니다</b>(감리 때도, 접수 때도). 사람이 직접
          확인해야 합니다.
        </p>
      )}

      {q.editable ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={state.confirm}
              onChange={(e) => onChange({ ...state, confirm: e.target.checked })}
            />
            이 값으로 확정
          </label>
          <input
            value={state.value}
            onChange={(e) => onChange({ ...state, value: e.target.value })}
            placeholder="예) 11170"
            className="text-input-notion tnum w-32 py-1 text-[12px]"
          />
          <span className="text-[11px] text-ink-secondary">
            🔴 접두가 틀려도 행 수는 그럴듯하게 나옵니다 — <b>자동 검증으로 못 걸러냅니다.</b>
            체크하지 않으면 보내지 않습니다.
          </span>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-ink-secondary">
          코드표로 이미 확정된 항목입니다({q.confirmed_by ?? "출처 미기재"}).
        </p>
      )}
    </QuestionCard>
  );
}

function Radio({
  name,
  checked,
  onChange,
  label,
  title,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  title?: string;
}) {
  return (
    <label className="flex items-center gap-1.5" title={title}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
