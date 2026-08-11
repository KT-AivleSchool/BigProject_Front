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
import React, { useState, useMemo, useEffect, MutableRefObject } from "react";
import { Fact, GateFrame, QuestionCard, WarningBadge } from "./GateFrame";
import { isAuditQuestion } from "@/lib/omnisite/gate";
import { meters } from "@/lib/omnisite/format";
import { useRun } from "@/lib/omnisite/RunProvider";
import { PageFooter } from "@/components/ui/Page";
import { SCREENS } from "@/lib/omnisite/screens";
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
  /**
   * 배제 승격(`needs_radius`)의 반경. **`ExclusionState` 와 같은 3지**다 —
   * 반경 규약이 같으니 UI 도 같아야 한다. 여기만 2지(빈칸/값)로 만들면
   * 「입력 안 함」과 「반경 없음」이 뭉개진다.
   */
  radiusMode: RadiusMode;
  radiusValue: string;
}

const emptyIntent = (): IntentState => ({
  choice: null,
  weight: "",
  radiusMode: "skip",
  radiusValue: "",
});

interface PrefixState {
  /** 체크해야 보낸다. 접두 코드는 **틀려도 행 수가 그럴듯해서 자동 검증이 못 잡는다.** */
  confirm: boolean;
  value: string;
}

const exKey = (q: GateExclusionQuestion) => `${q.dataset_id}#${q.role_index}`;
const pfKey = (q: GateCodePrefixQuestion) => `${q.dataset_id}#${q.op_index}`;

export function AuditGate({ 
  gate, 
  runId,
  submitRef,
  onReadyChange,
  onProgressChange
}: { 
  gate: RunGate; 
  runId: string;
  submitRef: React.MutableRefObject<(() => Promise<boolean | void>) | null>;
  onReadyChange: (ready: boolean) => void;
  onProgressChange?: (confirmed: number, total: number) => void;
}) {
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

  const [ex, setEx] = useState<Record<string, ExclusionState>>(() => {
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(`omnisite_gate_ex_${runId}`);
        if (item) return JSON.parse(item);
      } catch {}
    }
    return {};
  });
  const [it, setIt] = useState<Record<string, IntentState>>(() => {
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(`omnisite_gate_it_${runId}`);
        if (item) return JSON.parse(item);
      } catch {}
    }
    return {};
  });
  const [pf, setPf] = useState<Record<string, PrefixState>>(() => {
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(`omnisite_gate_pf_${runId}`);
        if (item) return JSON.parse(item);
      } catch {}
    }
    return {};
  });
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>(() => {
    let initial: Record<string, boolean> = {};
    if (typeof window !== "undefined") {
      try {
        const item = window.localStorage.getItem(`omnisite_gate_confirmed_${runId}`);
        if (item) initial = JSON.parse(item);
      } catch {}
    }
    for (const q of gate.questions) {
      if ("editable" in q && !q.editable && initial[q.dataset_id] === undefined) {
        initial[q.dataset_id] = true;
      }
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SCREEN = SCREENS.find((s) => s.no === "2")!;
  const auditQuestions = gate.questions.filter(isAuditQuestion);
  const isAllConfirmed =
    auditQuestions.length > 0 &&
    auditQuestions.every((q) => confirmed[q.dataset_id]);

  /**
   * 🔴 `"editable" in q` 로 좁히지 않는다. 그건 **모양을 보고 종류를 정하는 것**이라
   *    나중에 다른 kind 에 같은 이름의 필드가 생기면 조용히 섞인다. 종류는
   *    `kind` 로 판정한다(`isAuditQuestion`).
   */
  function build(): AuditAnswer | string {
    /**
     * 🔴 미확정으로 남은 반경을 **제출 전에** 막는다(2026-08-10 백엔드 회신 체크⑥).
     *    서버는 이 제출을 **200 으로 받는다** — 안 보낸 키는 「안 건드림」이고
     *    그건 정상적인 답이기 때문이다. 대신 STEP2 정제가 `SystemExit` 으로
     *    멈춰 run 이 `failed` 가 된다. 즉 **게이트에서는 성공으로 보이고 몇 분 뒤
     *    다른 단계에서 죽는다** — 사람은 자기가 답한 줄 안다. 원인이 보이는
     *    자리에서 멈추는 게 낫다.
     */
    const unanswered: string[] = [];

    const outEx: AuditAnswerExclusion[] = [];
    for (const q of exclusions) {
      if (!q.editable) continue;
      const s = ex[exKey(q)];
      if (!s || s.mode === "skip") {
        unanswered.push(`${q.dataset_id} (배제 반경 — ${q.facility_type ?? "시설 미상"})`);
        continue;
      }
      if (s.mode === "none") {
        outEx.push({
          dataset_id: q.dataset_id,
          role_index: q.role_index,
          radius_m: null,
        });
        continue;
      }
      const n = Number(s.value);
      if (!s.value.trim() || !Number.isInteger(n)) {
        return `[${q.dataset_id}] 배제반경에 정수를 입력해 주세요 (현재: ${JSON.stringify(s.value)}).`;
      }
      outEx.push({
        dataset_id: q.dataset_id,
        role_index: q.role_index,
        radius_m: n,
      });
    }

    const outIt: AuditAnswerIntent[] = [];
    for (const q of intents) {
      if (!q.editable) continue;
      const s = it[q.dataset_id];
      if (!s || s.choice === null) continue;
      const choice = q.choices.find((c) => c.value === s.choice);
      if (!choice) return `[${q.dataset_id}] 알 수 없는 선택지입니다.`;

      const out: AuditAnswerIntent = { dataset_id: q.dataset_id, choice: s.choice };

      if (choice.needs_weight) {
        const w = Number(s.weight);
        if (!s.weight.trim() || !Number.isFinite(w)) {
          return `[${q.dataset_id}] 「${choice.label}」 은 크기를 같이 정해야 합니다.`;
        }
        out.weight = w;
      }

      /**
       * 🔴 `choice === 3` 이 아니라 `needs_radius` 로 판정한다. 그리고 이 값은
       *    **`intents` 항목 안에** 실어야 한다 — `exclusions` 로 보내면 400 이다
       *    (승격될 role 의 질문이 아직 없다). 필요 없는데 보내도 400 이라
       *    `needs_radius` 가 false 면 키를 아예 만들지 않는다.
       */
      if (choice.needs_radius) {
        if (s.radiusMode === "skip") {
          unanswered.push(`${q.dataset_id} (「${choice.label}」 의 배제 반경)`);
        } else if (s.radiusMode === "none") {
          out.radius_m = null;
        } else {
          const n = Number(s.radiusValue);
          if (!s.radiusValue.trim() || !Number.isInteger(n)) {
            return `[${q.dataset_id}] 배제 승격의 반경에 정수를 입력해 주세요 (현재: ${JSON.stringify(s.radiusValue)}).`;
          }
          out.radius_m = n;
        }
      }

      outIt.push(out);
    }

    const outPf: AuditAnswerCodePrefix[] = [];
    for (const q of prefixes) {
      if (!q.editable) continue;
      const s = pf[pfKey(q)];
      if (!s || !s.confirm) continue;
      if (!s.value.trim())
        return `[${q.dataset_id}] 지역 코드가 비어 있습니다.`;
      outPf.push({
        dataset_id: q.dataset_id,
        op_index: q.op_index,
        prefix: s.value.trim(),
      });
    }

    if (unanswered.length) {
      return `반경이 미확정인 항목이 ${unanswered.length}건 있습니다 — ${unanswered.join(" · ")}. 「반경 없음」 또는 「반경 직접 지정」 중 하나를 골라 주세요. 미확정으로 제출하면 게이트는 통과하지만 다음 단계(정제)에서 실행이 중단됩니다.`;
    }

    const answer: AuditAnswer = { run_id: runId };
    if (outEx.length) answer.exclusions = outEx;
    if (outIt.length) answer.intents = outIt;
    if (outPf.length) answer.code_prefixes = outPf;
    return answer;
  }

  const allIds = [
    ...exclusions.map((q) => q.dataset_id),
    ...intents.map((q) => q.dataset_id),
    ...prefixes.map((q) => q.dataset_id),
  ];
  const totalCount = allIds.length;
  const confirmedCount = allIds.filter((id) => confirmed[id]).length;
  const isReady = totalCount > 0 && confirmedCount === totalCount;

  useEffect(() => {
    onReadyChange(isReady);
    if (onProgressChange) onProgressChange(confirmedCount, totalCount);
  }, [isReady, confirmedCount, totalCount, onReadyChange, onProgressChange]);

  async function onSubmit() {
    const built = build();
    if (typeof built === "string") {
      setError(built);
      return false;
    }
    setSubmitting(true);
    setError(null);
    try {
      await answerAudit(built);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (submitRef) {
      submitRef.current = onSubmit;
    }
  }, [submitRef, ex, it, pf, confirmed]);

  return (
    <>
      <GateFrame
        gate={gate}
        runId={runId}
        submitting={submitting}
        error={error}
        onSubmit={() => void onSubmit()}
        submitLabel="감리 결과 확정 및 다음 단계로 이동"
        confirmedCount={[
          ...exclusions.map((q) => q.dataset_id),
          ...intents.map((q) => q.dataset_id),
          ...prefixes.map((q) => q.dataset_id),
        ].filter(id => confirmed[id]).length}
        hideTitle={true}

      >
        {gate.questions.length === 0 && (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 shadow-sm">
            검토할 질문이 없습니다. 그대로 제출 버튼을 누르면 다음 단계로
            넘어갑니다.
          </p>
        )}

        {exclusions.map((q) => {
          const defaultState: ExclusionState = !q.editable
            ? { mode: "value", value: String(q.proposed_m ?? q.radius_m ?? "") }
            : { mode: "none", value: "" };
          return (
            <ExclusionCard
              key={exKey(q)}
              q={q}
              state={ex[exKey(q)] ?? defaultState}
              onChange={(s) => setEx((p) => ({ ...p, [exKey(q)]: s }))}
              confirmed={!!confirmed[q.dataset_id]}
              onConfirm={(val) =>
                setConfirmed((p) => ({ ...p, [q.dataset_id]: val }))
              }
            />
          );
        })}

        {intents.map((q) => {
          return (
            <IntentCard
              key={q.dataset_id}
              q={q}
              state={it[q.dataset_id] ?? emptyIntent()}
              onChange={(s) => setIt((p) => ({ ...p, [q.dataset_id]: s }))}
              confirmed={!!confirmed[q.dataset_id]}
              onConfirm={(val) =>
                setConfirmed((p) => ({ ...p, [q.dataset_id]: val }))
              }
            />
          );
        })}

        {prefixes.map((q) => (
          <PrefixCard
            key={pfKey(q)}
            q={q}
            state={
              pf[pfKey(q)] ?? {
                confirm: false,
                value: q.suggestion ?? q.prefix,
              }
            }
            onChange={(s) => setPf((p) => ({ ...p, [pfKey(q)]: s }))}
            confirmed={!!confirmed[q.dataset_id]}
            onConfirm={(val) =>
              setConfirmed((p) => ({ ...p, [q.dataset_id]: val }))
            }
          />
        ))}

      </GateFrame>

    </>
  );
}

function ExclusionCard({
  q,
  state,
  onChange,
  confirmed,
  onConfirm,
}: {
  q: GateExclusionQuestion;
  state: ExclusionState;
  onChange: (s: ExclusionState) => void;
  confirmed: boolean;
  onConfirm: (val: boolean) => void;
}) {
  const suspect = q.evidence_matches_facility === false;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <QuestionCard
      id={q.dataset_id}
      warn={suspect}
      confirmed={confirmed}
      isEditing={isExpanded}
      onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
      onConfirm={
        isExpanded
          ? () => { onConfirm(true); setIsExpanded(false); }
          : () => onConfirm(!confirmed)
      }
      confirmLabel={isExpanded ? "적용" : (confirmed ? "승인됨" : "승인")}
      title={
        <div 
          className={`flex flex-col ${!isExpanded ? "group py-1" : "gap-2"}`}
        >
          <div className="flex items-center flex-wrap gap-2">
            <span className={`leading-snug ${!isExpanded ? "group-hover:text-blue-600 transition-colors" : ""}`}>
              {q.facility_type ?? "(시설 미상)"}
            </span>
            {!isExpanded && confirmed && (
              <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {state.mode === "skip" ? "건너뜀" : state.mode === "none" ? "반경 없음" : `반경: ${state.value}m`}
              </span>
            )}

          </div>
        </div>
      }
    >
      {isExpanded && (
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-[14px] text-blue-900 font-bold leading-relaxed bg-blue-50/50 p-3 rounded-lg border border-blue-100">
              "{
                (() => {
                  let text = q.evidence || q.summary;
                  const targetNum = String(q.proposed_m ?? q.radius_m ?? "");
                  if (state.mode === "value" && state.value && targetNum && text.includes(targetNum)) {
                    text = text.replace(targetNum, state.value);
                  }
                  return text;
                })()
              }"
            </p>
            {suspect && (
              <div className="mt-0.5 flex flex-wrap gap-2">
                <WarningBadge text="시설명 확인 권장" title="이 시설의 이름이 근거 문장에 명시되어 있지 않아 확인이 필요합니다." />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm bg-gray-50 p-3 rounded-xl border border-gray-100">
            <Radio
              name={`ex-${exKey(q)}`}
              checked={state.mode === "none"}
              onChange={() => onChange({ ...state, mode: "none" })}
              label="반경 없음 (면적 배제로 확정)"
              title="구체적인 반경 없이 면적 자체를 배제 대상으로 확정합니다."
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
              label="반경 직접 지정"
            />
            <label
              className={`flex items-center gap-2 transition-opacity ${state.mode === "value" ? "opacity-100" : "opacity-40 pointer-events-none"}`}
            >
              <input
                type="number"
                min={1}
                max={5000}
                step={1}
                value={state.value}
                onChange={(e) =>
                  onChange({ mode: "value", value: e.target.value })
                }
                className="w-20 px-2 py-1 rounded-md border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
              <span className="text-gray-500 font-medium">m <span className="text-xs font-normal text-gray-400">(1~5000)</span></span>
            </label>
          </div>
          {state.mode === "skip" && (
            <p className="w-full text-xs text-rose-700 mt-2 px-1">
              아직 <strong>미확정</strong>입니다. 이대로 제출하면 다음 단계(정제)에서 실행이 중단됩니다.
            </p>
          )}
        </div>
      )}
    </QuestionCard>
  );
}

function IntentCard({
  q,
  state,
  onChange,
  confirmed,
  onConfirm,
}: {
  q: GateIntentQuestion;
  state: IntentState;
  onChange: (s: IntentState) => void;
  confirmed: boolean;
  onConfirm: (val: boolean) => void;
}) {
  const picked = q.choices.find((c) => c.value === state.choice) ?? null;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <QuestionCard
      id={q.dataset_id}
      confirmed={confirmed}
      isEditing={isExpanded}
      onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
      onConfirm={
        isExpanded
          ? () => { onConfirm(true); setIsExpanded(false); }
          : () => onConfirm(!confirmed)
      }
      confirmLabel={isExpanded ? "적용" : (confirmed ? "승인됨" : "승인")}
      title={
        <div 
          className={`flex flex-col ${!isExpanded ? "group py-1" : "gap-2"}`}
        >
          <div className="flex items-center flex-wrap gap-2">
            <span className={`leading-snug ${!isExpanded ? "group-hover:text-blue-600 transition-colors" : ""}`}>
              데이터 용도
            </span>
            {!isExpanded && confirmed && (
              <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {picked ? picked.label : "건너뜀"}
                {picked?.needs_weight && state.weight ? ` (W: ${state.weight})` : ""}
                {picked?.needs_radius && state.radiusMode === 'value' ? ` (R: ${state.radiusValue}m)` : ""}
              </span>
            )}

          </div>
        </div>
      }
    >
      {isExpanded && (
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
            <p className="text-[14px] text-blue-900 font-bold">"{q.summary}"</p>
            <p className="text-[13px] text-gray-500 mt-1">{q.message}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-blue-600 font-medium">적용될 용도</span>
              <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                {picked ? picked.label : "미확정 (건너뜀)"}
                {picked?.needs_weight && state.weight ? ` (가중치: ${state.weight})` : ""}
                {picked?.needs_radius && state.radiusMode === 'value' ? ` (반경: ${state.radiusValue}m)` : ""}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-sm bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Radio
                name={`it-${q.dataset_id}`}
                checked={state.choice === null}
                onChange={() => onChange({ ...state, choice: null })}
                label="건너뜀 (결정 보류)"
              />
              {q.choices.map((c) => (
                <Radio
                  key={c.value}
                  name={`it-${q.dataset_id}`}
                  checked={state.choice === c.value}
                  onChange={() => onChange({ ...state, choice: c.value })}
                  label={`${c.label}`}
                />
              ))}
            </div>
            
            {picked?.needs_weight && (
              <label className="flex items-center gap-3 mt-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-1">
                <span className="font-bold text-gray-700 text-xs">
                  크기 (Weight)
                </span>
                <input
                  type="number"
                  step={0.1}
                  min={-1}
                  max={1}
                  value={state.weight}
                  onChange={(e) => onChange({ ...state, weight: e.target.value })}
                  className="w-24 px-3 py-1.5 rounded-md border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
                <span className="text-xs text-gray-500">
                  가점/감점 여부는 위에서 선택한 역할에 따라 자동 결정됩니다. (0은 입력 불가)
                </span>
              </label>
            )}

            {picked?.needs_radius && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm animate-in fade-in slide-in-from-top-1">
                <p className="font-bold text-gray-700 text-xs">배제 반경</p>
                <p className="mt-1 text-xs text-gray-500">
                  「{picked.label}」 은 <strong>새 배제 레이어를 만드는 선택</strong>이라 반경을 같이 정해야 합니다.
                  여기서 정하지 않으면 미확정으로 남고, 다음 단계(정제)에서 실행이 멈춥니다.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Radio
                    name={`itr-${q.dataset_id}`}
                    checked={state.radiusMode === "skip"}
                    onChange={() => onChange({ ...state, radiusMode: "skip" })}
                    label="미확정 유지 (건너뜀)"
                    title="반경을 정하지 않습니다. 이후 단계에서 실행이 멈춥니다."
                  />
                  <Radio
                    name={`itr-${q.dataset_id}`}
                    checked={state.radiusMode === "none"}
                    onChange={() => onChange({ ...state, radiusMode: "none" })}
                    label="반경 없음 (면적 배제로 확정)"
                    title="구체적인 반경 없이 면적 자체를 배제 대상으로 확정합니다."
                  />
                  <Radio
                    name={`itr-${q.dataset_id}`}
                    checked={state.radiusMode === "value"}
                    onChange={() => onChange({ ...state, radiusMode: "value" })}
                    label="반경 직접 지정"
                  />
                  <label
                    className={`flex items-center gap-2 transition-opacity ${state.radiusMode === "value" ? "opacity-100" : "opacity-40 pointer-events-none"}`}
                  >
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      step={1}
                      value={state.radiusValue}
                      onChange={(e) =>
                        onChange({ ...state, radiusMode: "value", radiusValue: e.target.value })
                      }
                      className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                    <span className="text-gray-500 font-medium">
                      m <span className="text-xs font-normal text-gray-400">(1~5000)</span>
                    </span>
                  </label>
                  {state.radiusMode === "skip" && (
                    <p className="w-full text-xs text-rose-700 mt-2 px-1">
                      아직 <strong>미확정</strong>입니다. 이대로 제출하면 다음 단계(정제)에서 실행이 중단됩니다.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </QuestionCard>
  );

}

function PrefixCard({
  q,
  state,
  onChange,
  confirmed,
  onConfirm,
}: {
  q: GateCodePrefixQuestion;
  state: PrefixState;
  onChange: (s: PrefixState) => void;
  confirmed: boolean;
  onConfirm: (val: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <QuestionCard
      id={q.dataset_id}
      warn={q.recheck_skipped}
      confirmed={confirmed}
      isEditing={isExpanded}
      onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
      onConfirm={
        isExpanded
          ? () => { 
              onConfirm(true); 
              setIsExpanded(false); 
              onChange({ ...state, confirm: true });
            }
          : () => onConfirm(!confirmed)
      }
      confirmLabel={isExpanded ? "적용" : (confirmed ? "승인됨" : "승인")}
      title={
        <div 
          className={`flex flex-col ${!isExpanded ? "group py-1" : "gap-2"}`}
        >
          <div className="flex items-center flex-wrap gap-2">
            <span className={`leading-snug ${!isExpanded ? "group-hover:text-blue-600 transition-colors" : ""}`}>
              지역 코드 접두어 — {q.col ?? "(대상 열 미확인)"}
            </span>
            {!isExpanded && confirmed && (
              <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                코드: {state.value || "—"}
              </span>
            )}

          </div>
        </div>
      }
    >
      {isExpanded && (
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
            <p className="text-[14px] text-blue-900 font-bold">"{q.summary}"</p>
            {q.recheck_skipped && (
              <div className="mt-0.5 flex flex-wrap gap-2">
                <WarningBadge text="코드표 대조 누락" title="AI가 코드 검증을 수행하지 못했으므로, 사람이 직접 확인해야 합니다." />
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-blue-600 font-medium">적용될 값</span>
              <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{state.value || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">원본 값</span>
              <span className="font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{q.prefix || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">대상 지역</span>
              <span className="font-medium text-gray-800">{q.region || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">AI 제안</span>
              <span className="font-medium text-blue-700">{q.suggestion ?? "—"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm bg-gray-50 p-3 rounded-xl border border-gray-100">
            <label className="flex items-center gap-3 font-medium text-gray-800">
              사용할 코드 접두어
              <input
                value={state.value}
                onChange={(e) => onChange({ ...state, value: e.target.value })}
                placeholder="예) 11170"
                className="w-24 px-2 py-1.5 rounded-md border border-gray-300 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm font-bold text-gray-900"
              />
            </label>
          </div>
        </div>
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
    <label
      className="flex items-center gap-2 cursor-pointer group"
      title={title}
    >
      <div
        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${checked ? "border-blue-500 bg-blue-500" : "border-gray-300 group-hover:border-blue-400 bg-white"}`}
      >
        {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      </div>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={`text-sm transition-colors ${checked ? "text-gray-900 font-medium" : "text-gray-600 group-hover:text-gray-800"}`}
      >
        {label}
      </span>
    </label>
  );
}
