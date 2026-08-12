/**
 * 진행률 — **완료 단계 수가 아니라 실측 소요시간 비율.** (명세 화면 「진행 현황」)
 * ==========================================================================
 * 단계 수로 나누면 26초짜리 정제와 1.75초짜리 후보점 생성이 같은 1/6 이 된다.
 * 실제로는 정제 하나가 전체의 30% 다. 그래서 시간 비율로 센다.
 *
 * 🔴 그런데 **진행 중에는 남은 단계의 소요시간을 알 수 없다.** `status.json` 의
 *    `sec` 은 끝난 단계에만 채워지고 진행 중·대기 단계는 `null` 이다(실측).
 *    그래서 기준선이 필요하다 — 지난 완주 run 의 단계별 sec 을 브라우저에 남겨
 *    다음 실행의 분모로 쓴다.
 *
 * 🔴 기준선이 없으면(=이 브라우저의 첫 실행) **진행률을 계산하지 않고 `null`
 *    을 돌려준다.** 화면은 명세대로 `—%` 를 쓴다. 단계 수 비율로 대충 채우면
 *    "진행률 50%" 가 실제 20% 인 상태가 되고, 그건 산출물이 거짓말하는 것과
 *    같다(절대원칙 4). 모르면 모른다고 표시한다.
 *
 * 명세의 "확인 요청 대기 중에는 % 를 멈추고 문구만 바꾼다" 는 **run 단위**로
 * 구현했다 — `run.status === "awaiting_hitl"` (아래). 단계 단위로는 근거가 없다.
 * `steps[].status` 는 `idle·running·done·failed` 네 가지뿐이고 대기 상태가 없다
 * (계약 3절). 게이트는 단계 **사이**에 서지 단계 안에 서지 않기 때문이다.
 */
import type { RunDoc, RunStep } from "./types";

/** 단계 id → 지난 완주 run 의 실측 소요(초). */
export type Baseline = Record<string, number>;

const BASELINE_KEY = "omnisite.baseline.v1";

/** 완주한 run 에서만 기준선을 뽑는다. 중간에 실패한 run 은 분모가 될 수 없다. */
export function extractBaseline(run: RunDoc): Baseline | null {
  if (run.status !== "succeeded") return null;
  const b: Baseline = {};
  for (const s of run.steps) {
    // 🔴 `sec: null` + `done` 은 정상 상태다(gam4 마커를 놓친 경우, 계약 3절).
    //    정상이지만 분모로는 못 쓴다. 하나라도 비면 기준선 전체를 버린다 —
    //    빠진 칸을 0 으로 메우면 남은 단계가 공짜로 보인다.
    if (typeof s.sec !== "number") return null;
    b[s.id] = s.sec;
  }
  return b;
}

export function loadBaseline(): Baseline | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(BASELINE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Baseline;
  } catch {
    // 손상된 값은 조용히 쓰지 않고 버린다.
    window.localStorage.removeItem(BASELINE_KEY);
    return null;
  }
}

export function saveBaseline(run: RunDoc): void {
  if (typeof window === "undefined") return;
  const b = extractBaseline(run);
  if (b) window.localStorage.setItem(BASELINE_KEY, JSON.stringify(b));
}

export interface Progress {
  /** 0~1. 기준선이 없거나 단계 구성이 달라졌으면 `null` → 화면은 `—%`. */
  ratio: number | null;
  /** 예상 남은 시간(초). 근거가 없으면 `null` → 화면은 `—`. */
  remainSec: number | null;
  doneCount: number;
  totalCount: number;
  /** 기준선이 왜 안 쓰였는지. 화면 하단에 그대로 노출해 오해를 막는다. */
  note: string | null;
}

export function computeProgress(
  run: RunDoc,
  baseline: Baseline | null,
  /** 진행 중 단계의 경과 시간(초). 없으면 그 단계는 0 으로 본다. */
  runningElapsedSec = 0,
): Progress {
  // 사용자가 "데이터 감리하는 %"라고 인식하는 비율과 남은 시간을 제공하기 위해
  // 첫 실행(baseline이 없는 상태)일 때 가상의 기준선을 제공합니다.
  if (!baseline) {
    baseline = {
      "s_01_clean": 30,
      "s_02_candidates": 20,
      "s_03_weights": 10,
      "s_04_point": 10,
      "s_05_score": 20,
    };
  }

  const total = run.steps.length;
  const done = run.steps.filter((s) => s.status === "done").length;

  if (run.status === "succeeded") {
    return { ratio: 1, remainSec: 0, doneCount: done, totalCount: total, note: null };
  }

  /**
   * 🔴 **남은 시간을 말할 수 없는 상태들.** 실측에서 잡혔다(2026-08-05) —
   *    `failed` 인 run `r_20260805_002` 이 「실패」 라고 쓰면서 동시에
   *    「예상 남은 시간 1분 42초」 를 보여줬다. 죽은 실행에 남은 시간은 없다.
   *    한 화면이 서로 반대되는 두 말을 하면 사람은 **덜 무서운 쪽을 믿는다** —
   *    실패를 보고도 기다린다(절대원칙 4).
   *
   *    `succeeded` 만 걸러 두고 나머지를 아래 계산에 흘려보낸 게 원인이다.
   *    "끝난 상태"를 하나로 본 것인데 종료는 두 가지고, 게다가 게이트가 생기면서
   *    **끝나지 않았는데도 안 움직이는 상태**가 하나 더 늘었다.
   *
   *    `ratio` 도 같이 버린다. 시간 기준선으로 만든 % 는 "정상 진행 중일 때
   *    여기까지 왔다"는 뜻이고, 멈춘 실행에는 그 전제가 없다. 어디까지 갔는지는
   *    `doneCount / totalCount` 가 **실측으로** 말한다 — 그쪽이 근거가 확실하다.
   */
  if (run.status === "failed") {
    return {
      ratio: null,
      remainSec: null,
      doneCount: done,
      totalCount: total,
      note: "실행이 중단됐습니다 — 남은 시간을 예측하지 않습니다.",
    };
  }

  if (run.status === "awaiting_hitl" && run.gate) {
    const runId = run.run_id;
    let done = 0;
    let total = 0;
    let note = "사람 확인 대기 중";

    if (run.gate.id === "audit") {
      const qs = run.gate.questions.filter((q) => q.kind === "exclusion" || q.kind === "intent" || q.kind === "code_prefix");
      total = qs.length;

      let confirmed: Record<string, boolean> = {};
      if (typeof window !== "undefined") {
        try {
          const item = window.localStorage.getItem(`omnisite_gate_confirmed_${runId}`);
          if (item) confirmed = JSON.parse(item);
        } catch {}
      }

      for (const q of qs) {
        // @ts-ignore: dataset_id exists on audit questions
        const datasetId = q.dataset_id;
        if ("editable" in q && !q.editable && confirmed[datasetId] === undefined) {
          done++;
        } else if (confirmed[datasetId]) {
          done++;
        }
      }
      note = "감리 확인 대기 중";
    } else if (run.gate.id === "weight") {
      total = run.gate.questions.length;

      let weightStates: Record<string, any> = {};
      if (typeof window !== "undefined") {
        try {
          const item = window.localStorage.getItem(`omnisite_gate_weight_${runId}`);
          if (item) weightStates = JSON.parse(item);
        } catch {}
      }

      for (const q of run.gate.questions) {
        // @ts-ignore: indicator_id exists on weight questions
        if (weightStates[q.indicator_id]?.acked) {
          done++;
        }
      }
      note = "가중치 설정 대기 중";
    }

    return {
      ratio: total > 0 ? Math.min(done / total, 0.999) : 0,
      remainSec: null,
      doneCount: done,
      totalCount: total,
      note,
    };
  }

  if (!baseline) {
    return {
      ratio: total > 0 ? Math.min(done / total, 0.999) : 0,
      remainSec: null,
      doneCount: done,
      totalCount: total,
      note: "이 브라우저의 첫 실행입니다 — 과거 데이터가 없어 단계 수 기준으로 진행률을 표시합니다.",
    };
  }

  const missing = run.steps.filter((s) => baseline[s.id] === undefined);
  if (missing.length > 0) {
    return {
      ratio: total > 0 ? Math.min(done / total, 0.999) : 0,
      remainSec: null,
      doneCount: done,
      totalCount: total,
      note:
        `기준선에 없는 단계가 있어 단계 수 기준으로 진행률을 계산합니다: ` +
        `${missing.map((s) => s.id).join(", ")} (파이프라인 단계 구성이 바뀌었습니다)`,
    };
  }

  const totalSec = run.steps.reduce((a, s) => a + (baseline[s.id] as number), 0);
  if (totalSec <= 0) {
    return { ratio: total > 0 ? Math.min(done / total, 0.999) : 0, remainSec: null, doneCount: done, totalCount: total, note: null };
  }

  let elapsed = 0;
  for (const s of run.steps) {
    const base = baseline[s.id] as number;
    if (s.status === "done" || s.status === "failed") {
      elapsed += base;
    } else if (s.status === "running") {
      // 예상보다 오래 걸려도 그 단계를 넘어서지는 않게 막는다. 100% 를 찍고
      // 계속 도는 화면보다, 99% 에서 멈춰 있는 화면이 사실에 가깝다.
      elapsed += Math.min(runningElapsedSec, base);
    }
  }

  const ratio = Math.min(elapsed / totalSec, 0.999);
  return {
    ratio,
    remainSec: Math.max(totalSec - elapsed, 0),
    doneCount: done,
    totalCount: total,
    note: null,
  };
}

/** 진행 중 단계. 없으면 null. */
export function runningStep(run: RunDoc): RunStep | null {
  return run.steps.find((s) => s.status === "running") ?? null;
}

export function formatDuration(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${String(s % 60).padStart(2, "0")}초` : `${s}초`;
}
