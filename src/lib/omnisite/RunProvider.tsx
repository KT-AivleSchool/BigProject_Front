"use client";

/**
 * 현재 run 하나를 앱 전체가 공유한다.
 * ==================================
 * 화면 2 · 2b · 3 · 4 · 6 이 전부 같은 run 의 산출물을 읽으므로, run_id 를
 * 화면마다 따로 들고 다니면 화면끼리 다른 실행을 보여주는 사고가 난다.
 *
 * 폴링을 여기 둔 이유 — 진행현황 화면을 벗어나도 실행은 계속된다. 화면이
 * 폴링을 소유하면 다른 화면으로 이동하는 순간 갱신이 멈추고, 돌아왔을 때
 * 과거를 보여준다.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError } from "./client";
import {
  createRun,
  fetchRun,
  MODE_FIXTURE,
  submitAuditGate,
  submitWeightGate,
  cancelRun,
} from "./pipeline";
import type { FullParams } from "./pipeline";
import { saveBaseline } from "./progress";
import { clearRunId, readRunId, writeRunId } from "./runStore";
import { gateScreen } from "./gate";
import { usePathname, useRouter } from "next/navigation";
import type { AuditAnswer, RunDoc, WeightAnswer } from "./types";

/** 폴링 주기. 계약 5절 권장(1~2초). */
const POLL_MS = 1500;

interface RunContextValue {
  run: RunDoc | null;
  /** run 을 아직 한 번도 못 불러온 상태(복원 시도 중) */
  restoring: boolean;
  /** 실행 요청 중 */
  starting: boolean;
  /** 마지막으로 발생한 오류. 화면이 문구를 그대로 보여준다. */
  error: string | null;
  /** 진행 중 단계가 시작된 뒤 흐른 시간(초). 진행률 계산에 쓴다. */
  runningElapsedSec: number;
  /**
   * 실행 시작. `full` 은 실행 조건(`user_input` 필수 · `topn`)을 같이 보낸다 —
   * 계약 8-2. 다른 모드에 넘기면 `createRun` 이 버린다(보내면 400 이다).
   */
  start: (domain: string, mode?: string, full?: FullParams) => Promise<string | null>;
  /**
   * 게이트 답변. 성공하면 서버가 돌려준 status 를 그대로 현재 run 으로 삼는다 —
   * 그 순간 `running` 이므로 폴링이 저절로 재개된다.
   *
   * 🔴 **오류를 삼키지 않고 던진다.** `start` 는 `null` 을 돌려주고 `error` 로만
   *    알리는데, 게이트는 그러면 안 된다. 400 이 나도 게이트는 **그대로 열려 있고**
   *    사람은 자기가 친 값을 고쳐서 다시 보내야 한다. 폼이 사유(`detail`)를 자기
   *    자리에 붙여야 하므로 예외를 호출부까지 올린다.
   */
  answerAudit: (answer: AuditAnswer) => Promise<void>;
  answerWeight: (answer: WeightAnswer) => Promise<void>;
  /**
   * 지금 한 번 다시 물어본다.
   *
   * 게이트(`awaiting_hitl`) 때문에 필요하다 — 폴링이 멈춰 있는데 답변은 이 화면
   * **밖에서**(curl · 다른 세션) 들어올 수 있다. 그러면 서버 상태는 `running` 으로
   * 돌아갔는데 화면만 게이트에 멈춰 있게 된다. 자동으로 재개하지 않는 이유는
   * 그게 곧 무한 폴링이기 때문이고, 사람이 누를 수 있는 문은 열어 둔다.
   */
  refresh: () => Promise<void>;
  reset: () => void;
  loadHistoricalRun: (id: string) => Promise<string | null>;
}

const RunContext = createContext<RunContextValue | null>(null);

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRun 은 <RunProvider> 안에서만 쓸 수 있습니다.");
  return ctx;
}

/**
 * 폴링할 것인가.
 *
 * 🔴 `awaiting_hitl` 은 **여기서 빠진다.** 끝난 상태가 아닌데도 그렇다 —
 *    사람이 답을 주기 전까지 서버가 영원히 안 바꾸므로(계약 7절), 계속 부르면
 *    아무 일도 안 일어나는 요청을 1.5초마다 무한히 보낸다.
 *
 *    원래 이 함수는 `queued | running` 만 참이라 **고치지 않아도 게이트에서
 *    멈추기는 했다.** 그러나 그건 "모르는 값이라 우연히 걸러진" 것이고,
 *    `RunStatus` 에 값을 추가하는 순간 누군가 `!isFinished` 로 바꿔 쓰면
 *    조용히 무한 폴링이 된다. 그래서 의도를 이름과 주석으로 못박아 둔다.
 */
function isLive(run: RunDoc | null): boolean {
  return run?.status === "queued" || run?.status === "running";
}

export function RunProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [run, setRun] = useState<RunDoc | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningElapsedSec, setRunningElapsedSec] = useState(0);

  /** 진행 중 단계가 바뀐 시각. 단계별 경과 시간을 재려고 둔다. */
  const stepStartedAt = useRef<{ id: string; at: number } | null>(null);
  const lastNavigatedState = useRef<string | null>(null);

  const applyRun = useCallback((doc: RunDoc) => {
    setRun(doc);
    if (doc.status === "succeeded") saveBaseline(doc);

    const running = doc.steps.find((s) => s.status === "running");
    if (!running) {
      stepStartedAt.current = null;
      setRunningElapsedSec(0);
    } else if (stepStartedAt.current?.id !== running.id) {
      stepStartedAt.current = { id: running.id, at: Date.now() };
      setRunningElapsedSec(0);
    }
  }, []);

  /**
   * 새로고침 복원 — localStorage 의 run_id 는 주장일 뿐이라 서버에 되묻는다.
   *
   * 🔴 `if (!id) { setRestoring(false); return; }` 로 시작했다가
   *    `react-hooks/set-state-in-effect` 에 걸렸다. 저장된 id 가 없다는 걸
   *    **렌더 중에 알 수는 없다** — `readRunId()` 는 localStorage 를 읽고,
   *    서버 프리렌더에는 localStorage 가 없어 초깃값을 그쪽에서 정하면
   *    하이드레이션이 어긋난다. 그래서 상태로 두되, **id 가 없는 경우도
   *    같은 비동기 경로**를 지나게 해서 종료 지점을 하나로 만든다.
   *    (id 가 없으면 마이크로태스크 한 번이라 화면에는 안 보인다)
   */
  useEffect(() => {
    let cancelled = false;
    const id = readRunId();

    const restore = async () => {
      if (!id) return;
      try {
        const doc = await fetchRun(id);
        if (!cancelled && readRunId() === id) applyRun(doc);
      } catch (e: unknown) {
        if (cancelled) return;
        // 404 는 "서버에서 사라진 run" 이다. 조용히 넘기지 않고 알린 뒤 지운다.
        if (e instanceof ApiError && e.status === 404) {
          clearRunId();
          setError(`이전 실행 ${id} 이 서버에 없습니다. 다시 실행해 주세요.`);
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    };

    void restore().finally(() => {
      if (!cancelled) setRestoring(false);
    });

    return () => {
      cancelled = true;
    };
  }, [applyRun]);

  // 폴링 — 끝난 run 은 더 부르지 않는다.
  useEffect(() => {
    if (!isLive(run) || !run) return;
    const id = run.run_id;
    const t = setInterval(() => {
      fetchRun(id)
        .then(applyRun)
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : String(e)),
        );
    }, POLL_MS);
    return () => clearInterval(t);
  }, [run, applyRun]);

  // 진행 중 단계의 경과 시간(1초 눈금). 폴링과 분리해 화면이 매초 움직이게 한다.
  useEffect(() => {
    if (!isLive(run)) return;
    const t = setInterval(() => {
      const s = stepStartedAt.current;
      setRunningElapsedSec(s ? (Date.now() - s.at) / 1000 : 0);
    }, 1000);
    return () => clearInterval(t);
  }, [run]);

  const start = useCallback(
    async (domain: string, mode: string = MODE_FIXTURE, full?: FullParams) => {
      setStarting(true);
      setError(null);
      try {
        const id = await createRun(domain, mode, full);
        writeRunId(id);
        const doc = await fetchRun(id);
        applyRun(doc);
        return id;
      } catch (e: unknown) {
        if (e instanceof ApiError && e.status === 409) {
          const match = e.detail.match(/run_id=([^)]+)/);
          if (match && match[1]) {
            const id = match[1];
            writeRunId(id);
            try {
              const doc = await fetchRun(id);
              applyRun(doc);
              return id;
            } catch (inner) {
              // Ignore inner error and fall through to original error
            }
          }
        }
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setStarting(false);
      }
    },
    [applyRun],
  );

  /**
   * 🔴 답변 본문의 `run_id` 를 **여기서 채우지 않는다.** 폼이 자기가 보고 있는
   *    run 의 id 를 넣고, 그게 서버 경로와 다르면 400 이 난다 — 그 400 이 바로
   *    "화면이 다른 run 을 보고 있다" 는 신호다. 여기서 `run.run_id` 로 덮어쓰면
   *    그 신호가 사라지고 남의 run 에 답이 들어간다(계약 7-3b).
   */
  const answerAudit = useCallback(
    async (answer: AuditAnswer) => {
      applyRun(await submitAuditGate(answer.run_id, answer));
      setError(null);
    },
    [applyRun],
  );

  const answerWeight = useCallback(
    async (answer: WeightAnswer) => {
      applyRun(await submitWeightGate(answer.run_id, answer));
      setError(null);
    },
    [applyRun],
  );

  const refresh = useCallback(async () => {
    const id = run?.run_id ?? readRunId();
    if (!id) return;
    try {
      const doc = await fetchRun(id);
      if (readRunId() === id) {
        applyRun(doc);
        setError(null);
      }
    } catch (e: unknown) {
      if (readRunId() === id) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [run?.run_id, applyRun]);

  const reset = useCallback(() => {
    const id = readRunId();
    if (id) {
      // 백엔드의 실행도 명시적으로 취소하여 409 Conflict(좀비 런 부활) 방지
      cancelRun(id).catch(console.error);
    }

    clearRunId();
    setRun(null);
    setError(null);
    
    // 진행 중이던 데이터를 모두 초기화하기 위해 관련 캐시도 모두 삭제
    if (typeof window !== "undefined") {
      const keys = Object.keys(window.localStorage);
      for (const k of keys) {
        if (k.startsWith("omnisite_gate_") || k.startsWith("unlocked_weight_") || k.startsWith("highest_nav_")) {
          window.localStorage.removeItem(k);
        }
      }
      const sKeys = Object.keys(window.sessionStorage);
      for (const k of sKeys) {
        if (k.startsWith("audit_step_")) {
          window.sessionStorage.removeItem(k);
        }
      }
    }
  }, []);

  const loadHistoricalRun = useCallback(async (id: string) => {
    setStarting(true);
    setError(null);
    try {
      writeRunId(id);
      const doc = await fetchRun(id);
      applyRun(doc);
      return id;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setStarting(false);
    }
  }, [applyRun]);

  return (
    <RunContext.Provider
      value={{
        run,
        restoring,
        starting,
        error,
        runningElapsedSec,
        start,
        answerAudit,
        answerWeight,
        refresh,
        reset,
        loadHistoricalRun,
      }}
    >
      {children}
    </RunContext.Provider>
  );
}
