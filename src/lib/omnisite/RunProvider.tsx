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
} from "./pipeline";
import type { FullParams } from "./pipeline";
import { saveBaseline } from "./progress";
import {
  clearReviewRunId,
  clearRunId,
  readReviewRunId,
  readRunId,
  writeReviewRunId,
  writeRunId,
} from "./runStore";
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
   * 지금 보고 있는 run 이 **마이페이지에서 연 지난 기록**인가.
   *
   * 🔴 서버 응답으로는 알 수 없다 — 다시보기로 연 run 과 방금 돌린 run 의 `RunDoc`
   *    은 구분이 안 된다. 이건 브라우저에서 일어난 일이라 `runStore` 에 적어 둔다.
   * 🔴 `run` 과 **대조해서** 판정한다(id 일치). 깃발만 보면 다시보기 중에 새로
   *    실행했을 때 새 run 을 지난 기록인 척 보여준다.
   */
  reviewing: boolean;
  /**
   * 실행 시작. `full` 은 실행 조건(`user_input` 필수 · `topn`)을 같이 보낸다 —
   * 계약 8-2. 다른 모드에 넘기면 `createRun` 이 버린다(보내면 400 이다).
   *
   * `autoApprove` = 「고속 자동 분석」. 게이트를 **없애는 게 아니라** 서버가 그 자리에서
   * AI 제안값으로 답한다 — 그래서 화면은 게이트를 안 보고, 산출물에는 사람이 확정한
   * run 과 **구분되는 출처**가 남는다. `fixture` 에 주면 서버가 400(게이트가 없다).
   */
  start: (
    domain: string,
    mode?: string,
    full?: FullParams,
    autoApprove?: boolean,
  ) => Promise<string | null>;
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
  /**
   * 지난 run 을 현재 run 으로 되돌려 놓는다. **실패하면 던진다**(위 게이트와 같은 이유).
   */
  loadHistoricalRun: (id: string) => Promise<string>;
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

/**
 * 실행 요청 실패 문구.
 *
 * 🔴 **401 에만 「무엇을 하면 되는지」를 덧붙인다.** `POST /pipeline/runs` 는
 *    2026-08-12 부터 `Authorization` 을 본다 — 헤더가 **없으면** 예전처럼 202
 *    익명 run 이고, 헤더가 **있는데 죽었으면**(만료·위조·로그아웃) 401 이다.
 *    만료를 조용히 익명으로 흘리지 않은 건 백엔드 쪽 의도다: 그러면 화면은
 *    로그인 상태인데 마이페이지에서만 그 run 이 안 보인다.
 *
 * 🔴 서버 문구를 **바꾸지 않고 앞에 그대로 둔다.** 401 의 사유는 셋(만료·위조·
 *    로그아웃)인데 우리는 어느 쪽인지 모른다 — 우리가 문장을 지어내면 「만료됐다」고
 *    단정하게 된다. 덧붙이는 건 사유가 아니라 **다음 동작**이고, 그 동작은 셋 다
 *    같다(연장하거나 다시 로그인).
 *
 * 🔴 여기서 재발급을 시도하지 않는다 — `client.ts` 의 401 처리와 같은 이유다.
 *    RTR 이라 재발급이 실패하면 그 사용자의 **모든 세션이 지워진다.**
 */
function startFailureText(e: unknown): string {
  if (e instanceof ApiError && e.status === 401) {
    return `${e.detail} — 헤더의 ⟳ 로 로그인을 연장한 뒤 다시 실행해 주세요. 연장이 안 되면 다시 로그인하면 됩니다.`;
  }
  return e instanceof Error ? e.message : String(e);
}

export function RunProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [run, setRun] = useState<RunDoc | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningElapsedSec, setRunningElapsedSec] = useState(0);
  /** 「다시보기」로 연 run 의 id. 현재 run 과 같을 때만 다시보기다(위 주석). */
  const [reviewRunId, setReviewRunId] = useState<string | null>(null);

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
      if (!id) {
        // 현재 run 이 없으면 다시보기 깃발도 가리킬 데가 없다 — 같이 지운다.
        clearReviewRunId();
        return;
      }
      try {
        const doc = await fetchRun(id);
        if (!cancelled && readRunId() === id) {
          applyRun(doc);
          // 깃발이 **이 run 을** 가리킬 때만 다시보기다. 어긋나면 남은 찌꺼기다.
          setReviewRunId(readReviewRunId() === id ? id : null);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        // 404 는 "서버에서 사라진 run" 이다. 조용히 넘기지 않고 알린 뒤 지운다.
        if (e instanceof ApiError && e.status === 404) {
          clearRunId();
          clearReviewRunId();
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
    async (
      domain: string,
      mode: string = MODE_FIXTURE,
      full?: FullParams,
      autoApprove: boolean = false,
    ) => {
      setStarting(true);
      setError(null);
      try {
        const id = await createRun(domain, mode, full, autoApprove);
        writeRunId(id);
        // 🔴 새 실행은 다시보기가 아니다. **성공한 뒤에** 깃발을 지운다 —
        //    먼저 지우면 실행이 실패했을 때 화면엔 여전히 지난 run 이 떠 있는데
        //    다시보기 표시만 사라진다.
        clearReviewRunId();
        setReviewRunId(null);
        const doc = await fetchRun(id);
        applyRun(doc);
        return id;
      } catch (e: unknown) {
        // 🔴 409 는 실패가 아니라 **점유**다 — 같은 도메인을 다른 run 이 이미
        //    잡고 있다. 그 run 은 살아 있으므로 새로 만들 게 아니라 **되붙는다.**
        //    id 는 서버가 `detail` 에 적어준 것만 쓴다(프런트가 짐작하지 않는다).
        if (e instanceof ApiError && e.status === 409) {
          const match = e.detail.match(/run_id=([^)]+)/);
          if (match && match[1]) {
            const id = match[1];
            writeRunId(id);
            try {
              const doc = await fetchRun(id);
              // 되붙은 run 은 **지금 돌고 있는** 실행이다 — 다시보기가 아니다.
              clearReviewRunId();
              setReviewRunId(null);
              applyRun(doc);
              return id;
              // 되붙기까지 실패하면 원래 409 문구를 그대로 띄운다 — 여기서
              // 새 사유를 지어내면 진짜 원인(점유)이 화면에서 사라진다.
            } catch {
              /* 아래 공통 처리로 흘린다 */
            }
          }
        }
        setError(startFailureText(e));
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

  /**
   * **브라우저 상태만 지운다.** 서버에는 한 글자도 안 보낸다.
   *
   * 🔴 「취소 라우트가 없어서 안 부른다」고 적어뒀던 건 2026-08-12 기준이고
   *    **지금은 있다**(`DELETE /runs/{id}`, `origin/back_deploy` `118d414`).
   *    그런데도 여기서 안 부르는 이유가 바뀌었다 — **호출자가 둘이고 뜻이 다르다**:
   *      · 헤더 「데이터 초기화」 = 실행을 버린다 → 취소 + 업로드 삭제까지 한다
   *        (그 배선은 `Header.handleReset` 에 있다)
   *      · 다시보기 「나가기」   = 지난 실행을 **덮어보던 것을 그만둔다** →
   *        서버에서 지울 것이 없다. 여기에 취소·삭제를 넣으면 구경하다 나가는
   *        동작이 남의 실행을 지운다.
   *    공통 함수에 파괴적 동작을 넣으면 **안 지워야 할 호출자까지 지운다.**
   *
   * ⚠ 옛 `cancelRun` 은 실패를 `console.error` 로 삼켜 「취소했다고 믿게 만들고
   *   아무것도 안 하는」 모양이었다(절대원칙 4). 되살린 판은 던진다 —
   *   삼키는 자리를 다시 만들지 말 것.
   */
  const reset = useCallback(() => {
    clearRunId();
    clearReviewRunId();
    setRun(null);
    setReviewRunId(null);
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

  /**
   * 지난 run 을 현재 run 으로 삼는다(마이페이지 「다시보기」).
   *
   * 🔴 **오류를 삼키지 않고 던진다** — 게이트와 같은 이유다. 목록에는 줄이 여럿이라
   *    사유가 **누른 그 줄 옆**에 붙어야 한다. context `error` 하나로만 알리면
   *    「어느 run 이 왜 안 열렸는지」가 사라지고, 호출부는 실패를 모른 채 화면을
   *    넘겨 **직전 run** 을 그 run 인 척 보여준다.
   * 🔴 `writeRunId` 는 **불러온 뒤**에 한다. 먼저 쓰면 서버에 없는 run(폴더가 정리됨 ·
   *    404)을 눌렀을 때 저장된 id 만 그쪽으로 바뀌어, 보고 있던 run 을 잃는다.
   * 🔴 **화면 4·5 의 sessionStorage 를 비운다**(계약 §7-5). 그 값들은 `run_id` 를
   *    안 달고 있어서, 안 지우면 **지난 run 을 열었는데 직전 run 의 선택 입지·
   *    페르소나·토론 로그가 그대로 붙어 보인다** — 화면이 두 실행을 섞어 한 실행인
   *    척한다(절대원칙 4). 지우는 쪽이 맞다: 이 값들은 서버에서 다시 받을 수 있다.
   */
  const loadHistoricalRun = useCallback(async (id: string) => {
    setStarting(true);
    setError(null);
    try {
      const doc = await fetchRun(id);
      writeRunId(id);
      // 🔴 여기가 다시보기 깃발이 서는 **유일한** 자리다. `writeRunId` 와 붙여
      //    둔다 — 떨어뜨리면 「run 은 바뀌었는데 깃발은 안 선」 창이 생긴다.
      writeReviewRunId(id);
      setReviewRunId(id);
      applyRun(doc);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("omnisite.sitePick.v1");
        window.sessionStorage.removeItem("omnisite.personas.v2");
        window.sessionStorage.removeItem("omnisite.hearingB.v1");
        window.sessionStorage.removeItem("sim_messages");
        window.sessionStorage.removeItem("sim_metrics");
        window.sessionStorage.removeItem("sim_started");
        window.sessionStorage.removeItem("sim_finished");
        window.sessionStorage.removeItem("sim_parcel");
      }
      return id;
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
        reviewing: run !== null && reviewRunId !== null && reviewRunId === run.run_id,
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
