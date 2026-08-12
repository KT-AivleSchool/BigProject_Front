"use client";

/**
 * 서버에 남은 공청회 — 조회.
 * =========================
 * 2026-08-11 백엔드가 **저장·조회 경로를 둘 다** 열었다. 그전까지 토론은 이 탭의
 * `sessionStorage` 에만 있었고, 그래서 `hearingResult.ts` 와 화면 6 은
 * 「백엔드에 경로가 없다」를 전제로 쓰여 있었다. 그 전제가 깨졌으므로 여기서
 * 서버를 **본선**으로 삼고, 로컬 기록은 폴백으로 내린다.
 *
 * 열린 경로 (실측 2026-08-11)
 *   GET /hearings?run_id=&domain=&engine=   이 run 에서 열린 공청회 **목록**
 *   GET /hearings/b/{hearing_id}            B 1건 — `result_json` 통짜(발화 78건 포함)
 *   GET /results/{parcel_id}                A — 그 필지의 **최신 1건**(`debate_logs` 포함)
 *
 * 🔴 **`run_id` 는 `run.loaded.run_id` 다.** `run.run_id` 가 아니다.
 *    공청회는 `parcel_id → booth_candidates.id → booth_candidates.run_id` **조인으로만**
 *    run 에 매달린다(`conflict_simulations`·`hearing_results_b` 에 `run_id` 컬럼이 없다).
 *    그 테이블에 들어간 것은 **적재한 run** 뿐이라, 적재 칸이 없는 `fixture`·`hitl`
 *    실행의 `run_id` 로 물으면 404 다. 「없다」가 아니라 **물을 수 없는 것**이다.
 *
 * 🔴 **A 와 B 는 행의 키 집합이 다르다.** 백엔드가 일부러 그렇게 뒀다
 *    (`simulations.py:726-730`) — 두 엔진은 합치지 않기로 한 것이라 산출물 지표가
 *    겹치지 않고, 공통 칸에 접으면 없는 대응관계를 지어내게 된다. 그래서 여기서도
 *    합치지 않고 `engine` 으로 갈리는 **판별 유니온**으로 둔다.
 *    ⚠ 그 결과 `is_latest_for_parcel` 은 **A 에만 있다.** B 는 조회가
 *      `hearing_results_b.id` 단건이라 옛 건도 자기 URL 을 갖는다 — 문제가 없어서
 *      필드가 없는 것이지 빠뜨린 게 아니다. 배열을 균일하게 돌면 `undefined` 를
 *      `false` 로 읽게 되므로 **반드시 `engine` 으로 먼저 가른다.**
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, NetworkError, apiErrorCode, getJson } from "./client";
import { useRun } from "./RunProvider";
import { useHydrated } from "./useHydrated";

/** 🔴 복수형이 정본이다 — 이유는 `simulation.ts` 머리말. */
const BASE = "/api/v1/simulations";

/** 목록의 A 행. `result_url` 은 **최신이 아닌 건에서 `null`** 이다(아래 주석). */
export interface HearingItemA {
  engine: "A";
  simulation_id: number;
  parcel_id: number;
  rank: number | null;
  jibun: string | null;
  domain: string | null;
  run_id: string | null;
  facility_type: string | null;
  candidate_land_id: number | null;
  css_score: number | null;
  scenario_code: string | null;
  debate_log_count: number;
  created_at: string | null;
  /**
   * 🔴 `/results/{parcel_id}` 는 그 필지의 **가장 최근 1건**만 돌려준다. 같은 필지를
   *    여러 번 토론했다면 옛 건에는 가리킬 URL 이 없어 서버가 `null` 을 준다 —
   *    비어 있다고 우리가 채우면 **다른 토론**을 그 토론의 결과로 표시한다.
   */
  is_latest_for_parcel: boolean;
  result_url: string | null;
  pdf_url: string | null;
}

/** 목록의 B 행. B 는 단건 조회라 `result_url` 이 **항상** 채워진다. */
export interface HearingItemB {
  engine: "B";
  hearing_id: number;
  parcel_id: number;
  rank: number | null;
  jibun: string | null;
  domain: string | null;
  run_id: string | null;
  facility_type: string | null;
  topic: string | null;
  purpose: string | null;
  persona_count: number;
  message_count: number;
  created_at: string | null;
  result_url: string;
}

export type HearingItem = HearingItemA | HearingItemB;

export interface HearingList {
  run_id: string;
  domain: string | null;
  engine: string | null;
  count: number;
  hearings: HearingItem[];
}

/**
 * B 1건 상세. `result_json` 은 서버가 **통짜로** 내보내는 값이라 여기서도
 * `unknown` 으로 받는다 — B 산출물 모양은 아직 움직이고 있고(B 담당자 소유),
 * 키를 골라 담으면 하나 바뀔 때마다 화면만 조용히 빈다(원칙 4).
 */
export interface HearingDetailB {
  hearing_id: number;
  engine: "B";
  parcel_id: number;
  rank: number | null;
  jibun: string | null;
  domain: string | null;
  run_id: string | null;
  facility_type: string | null;
  topic: string | null;
  purpose: string | null;
  personas: unknown;
  message_count: number;
  result_json: unknown;
  created_at: string | null;
}

/** A 1건 상세(`/results/{parcel_id}`). 필지의 **최신 1건**이다. */
export interface HearingDetailA {
  parcel_id: number;
  conflict_sensitivity_score: number | null;
  conflict_factors: Record<string, number> | null;
  scenario: Record<string, unknown> | null;
  debate_logs: { sender?: string; text?: string }[];
}

export function fetchHearings(
  runId: string,
  opts?: { domain?: string | null; engine?: "A" | "B" },
): Promise<HearingList> {
  const q = new URLSearchParams({ run_id: runId });
  if (opts?.domain) q.set("domain", opts.domain);
  if (opts?.engine) q.set("engine", opts.engine);
  return getJson<HearingList>(`${BASE}/hearings?${q.toString()}`);
}

/**
 * 결과 1건. **`result_url` 원문을 그대로 부른다** — 경로를 프런트가 조립하면
 * 규칙이 두 곳에 생긴다.
 *
 * 🔴 예전엔 여기서 prefix 를 단수형으로 **치환**했다(rewrite 가 단수형만 열려
 *    있었다). 2026-08-11 백엔드 회신으로 복수형이 정본임이 확정돼 rewrite 를
 *    복수형으로 열고 치환을 없앴다 — 서버가 준 URL 을 손대지 않는 게 원래 뜻이다.
 */
export function fetchHearingByUrl<T>(resultUrl: string): Promise<T> {
  return getJson<T>(resultUrl);
}

/**
 * 실패 사유 한 줄. **서버 문구를 그대로 쓴다.**
 *
 * 🔴 `code` 를 **분기 조건이 아니라 표시**로만 쓴다(2026-08-11 백엔드 합의).
 *    `/hearings` 404 는 다섯 갈래다 — `UNKNOWN_RUN`(폴더가 없다) ·
 *    `STATUS_UNREADABLE`(폴더는 있는데 `status.json` 을 못 읽는다) ·
 *    `LOADED_BUT_MISSING`(적재 기록은 있는데 지금 DB 에 없다) ·
 *    `NEVER_LOADED`(기록도 행도 없다) · `DOMAIN_MISMATCH`(run 엔 있는데 그 도메인만 없다).
 *    다섯을 화면에서 다시 문장으로 옮기지 않는 이유는 두 가지다 —
 *    ⓐ 코드 집합이 늘어난다(회신 한 번에 넷 → 다섯이 됐다). 모르는 코드에
 *       분기가 없으면 화면이 **빈 말**을 하게 된다.
 *    ⓑ 서버가 `message` 를 **어느 갈래에서도 채우기로** 했고, 거기엔 우리가 못 쓰는
 *       것까지 들어 있다(`JSONDecodeError` 원문, 기록된 행 수, 실제 행 수).
 *    그래서 문구는 서버 것을 쓰고, 코드는 「어느 갈래였는지」를 괄호로 덧붙인다.
 *    ⚠ 모르는 코드가 와도 이 함수는 그대로 동작한다 — 그게 요점이다.
 */
function describeFailure(e: unknown): string {
  if (e instanceof ApiError) {
    return `HTTP ${e.status} — ${e.detail}`;
  }
  if (e instanceof NetworkError) return e.message;
  return String(e);
}

// ── 화면 5 완료 판정 ───────────────────────────────────────────

/** 판정이 **어디서 왔는지**. 화면에 근거를 적으려면 결과만으로는 부족하다. */
export type HearingDoneSource =
  /** 서버 목록에 이 run 의 공청회가 있다. */
  | "server"
  /** 서버가 이 run 을 모른다(적재 안 됨) 또는 못 물었다 → 로컬 기록으로 판정했다. */
  | "local"
  /** 아직 안 물어봤다. */
  | "pending";

export interface HearingDone {
  done: boolean;
  source: HearingDoneSource;
  /** 서버가 센 건수. 로컬 판정이면 `null`. */
  count: number | null;
  /** 서버에 못 물은 사유 원문. 물어서 답을 받았으면 `null`. */
  reason: string | null;
}

/**
 * 이 run 의 공청회가 열렸는가 — **서버가 본선, 로컬이 폴백**이다.
 *
 * 순서와 이유
 *  1. `run.loaded.run_id` 가 없으면 **묻지 않는다.** 적재 칸이 없는 실행
 *     (`fixture`·`hitl`)은 후보점이 DB 에 없어 조인 자체가 성립하지 않는다.
 *     이때 로컬 기록으로 판정하는 건 폴백이 아니라 **유일하게 가능한 판정**이다.
 *  2. 물어서 `count > 0` 이면 끝났다. 서버에 남았으므로 **탭을 닫아도 유지된다** —
 *     이게 로컬 판정과의 진짜 차이다.
 *  3. 404(적재 안 된 run)·네트워크 실패면 로컬로 내려간다. **조용히 내려가지
 *     않는다** — `source`·`reason` 을 같이 돌려주고 화면이 그걸 적는다(원칙 4).
 *
 * 🔴 서버가 `count 0` 을 주면 **로컬로 되짚지 않는다.** 그건 「못 물었다」가 아니라
 *    「물었더니 없다」다. 여기서 로컬을 보면 다른 run 에서 돈 토론이 이 run 의
 *    완료 표시가 된다.
 *
 * `refreshKey` 는 **다시 묻는 계기**다. `loaded.run_id` 는 토론을 해도 안 바뀌므로
 * 그것만 보면 화면 5 에서 토론을 끝내고 나가도 상단 표시가 안 따라온다. 호출부가
 * `pathname` 을 넘겨 화면이 바뀔 때마다 다시 묻게 한다.
 */
export function useHearingDone(
  localFallback: (runId: string | null) => boolean,
  refreshKey?: string,
): HearingDone {
  const { run } = useRun();
  const loadedRunId = run?.loaded?.run_id ?? null;
  const runId = run?.run_id ?? null;

  /**
   * 🔴 **폴백은 `sessionStorage` 를 읽는다** — 서버 프리렌더엔 없다. 그래서 렌더 중에
   *    부르려면 「하이드레이션이 끝났는가」를 먼저 물어야 한다(`useHydrated`).
   *    여기서 `sitePick.ts` 처럼 **값을** 구독하지 않는 이유: 폴백이 보는 `sim_*` 키는
   *    화면 5 가 `sessionStorage.setItem` 으로 직접 쓴다 — 이 모듈이 구독을 걸어봐야
   *    그 변경을 못 듣는다. 못 듣는 구독을 다는 건 안 다느니만 못하다.
   */
  const hydrated = useHydrated();

  /**
   * 🔴 서버에 물은 답만 상태로 둔다. 「불러오는 중」·「폴백」은 **렌더 중에 계산**한다 —
   *    `setState(대기중)` 은 effect 에서 동기로 불릴 수밖에 없어
   *    `react-hooks/set-state-in-effect` 에 걸리고, 규칙 문제만도 아니다:
   *    run 이 바뀐 직후 한 프레임 동안 **직전 run 의 답**이 남는다
   *    (`useArtifact.ts` :79 가 같은 이유로 먼저 이 모양이 됐다).
   *
   *    `runId` 는 「무엇을 물었나」다. 저장된 답의 `runId` 가 지금 것과 다르면 그건
   *    **남의 답**이므로 안 내보낸다.
   *    🔴 `refreshKey` 는 **이 비교에 넣지 않는다.** 그건 `pathname` 이라, 넣으면
   *    화면을 옮길 때마다 상단 표시가 **매번 빈칸으로 깜빡인다.** 다시 묻는 계기일
   *    뿐이고 답이 낡았다는 뜻이 아니다 — 그래서 effect 의 deps 에만 있다.
   */
  const [answer, setAnswer] = useState<{
    runId: string | null;
    count: number | null;
    reason: string | null;
  }>({ runId: null, count: null, reason: null });

  useEffect(() => {
    if (!loadedRunId) return;
    let alive = true;
    fetchHearings(loadedRunId)
      .then((list) => {
        if (alive) setAnswer({ runId: loadedRunId, count: list.count, reason: null });
      })
      .catch((e: unknown) => {
        if (alive) setAnswer({ runId: loadedRunId, count: null, reason: describeFailure(e) });
      });
    return () => {
      alive = false;
    };
    // refreshKey 는 값을 안 쓰고 **다시 묻는 계기**로만 쓴다.
  }, [loadedRunId, refreshKey]);

  if (!hydrated) return { done: false, source: "pending", count: null, reason: null };

  if (!loadedRunId) {
    return {
      done: localFallback(runId),
      source: "local",
      count: null,
      reason: "이 실행은 DB 적재 단계가 없어(fixture·hitl) 서버에 물을 수 없습니다.",
    };
  }
  if (answer.runId !== loadedRunId) {
    return { done: false, source: "pending", count: null, reason: null };
  }
  if (answer.reason !== null) {
    return { done: localFallback(loadedRunId), source: "local", count: null, reason: answer.reason };
  }
  // 여기서 `count 0` 은 「물었더니 없다」다 — 로컬로 되짚지 않는다(위 머리말).
  return { done: (answer.count ?? 0) > 0, source: "server", count: answer.count, reason: null };
}

// ── 이 run 의 공청회 목록 ──────────────────────────────────────

export interface RunHearings {
  loading: boolean;
  /** 아직 안 불렀거나 실패했으면 `null`. 빈 배열(= 열린 적 없음)과 다르다. */
  items: HearingItem[] | null;
  /** 서버에 못 물은 사유 원문. */
  failure: string | null;
  /** 물어본 run_id. 못 물었으면 `null`. */
  askedRunId: string | null;
}

/** 화면 6 이 쓴다. 판정이 아니라 **목록**이 필요할 때. */
export function useRunHearings(): RunHearings {
  const { run } = useRun();
  const loadedRunId = run?.loaded?.run_id ?? null;

  /** 위 `useHearingDone` 과 같은 모양이다 — 답만 담고 「불러오는 중」은 렌더에서 계산한다. */
  const [answer, setAnswer] = useState<{
    runId: string | null;
    items: HearingItem[] | null;
    failure: string | null;
  }>({ runId: null, items: null, failure: null });

  useEffect(() => {
    if (!loadedRunId) return;
    let alive = true;
    fetchHearings(loadedRunId)
      .then((list) => {
        if (alive) setAnswer({ runId: loadedRunId, items: list.hearings, failure: null });
      })
      .catch((e: unknown) => {
        if (alive) setAnswer({ runId: loadedRunId, items: null, failure: describeFailure(e) });
      });
    return () => {
      alive = false;
    };
  }, [loadedRunId]);

  if (!loadedRunId) {
    return {
      loading: false,
      items: null,
      failure: "이 실행은 DB 적재 단계가 없어(fixture·hitl) 서버에 물을 수 없습니다.",
      askedRunId: null,
    };
  }
  const fresh = answer.runId === loadedRunId;
  return {
    loading: !fresh,
    items: fresh ? answer.items : null,
    failure: fresh ? answer.failure : null,
    askedRunId: loadedRunId,
  };
}

/**
 * 같은 엔진에서 **가장 최근** 1건. `created_at` 이 없는 행은 후보에서 뺀다
 * (없는 시각을 0 으로 치면 옛 건이 최신이 된다).
 */
export function latestOf<T extends HearingItem>(items: HearingItem[], engine: T["engine"]): T | null {
  const mine = items.filter((h): h is T => h.engine === engine && h.created_at !== null);
  if (mine.length === 0) return null;
  return mine.reduce((best, h) => (h.created_at! > best.created_at! ? h : best));
}

// ── 화면 6 이 싣는 1건씩 ──────────────────────────────────────

export interface ServerHearingA {
  item: HearingItemA;
  detail: HearingDetailA;
}
export interface ServerHearingB {
  item: HearingItemB;
  detail: HearingDetailB;
}

export interface RunHearingDetails {
  loading: boolean;
  /** 목록을 못 물은 사유. 물었으면 `null`. */
  failure: string | null;
  /** 목록은 받았는데 **본문**을 못 읽은 사유. 엔진별로 따로 적는다. */
  detailFailure: { A: string | null; B: string | null };
  /** 서버가 센 이 run 의 공청회 총 건수. 못 물었으면 `null`. */
  total: number | null;
  a: ServerHearingA | null;
  b: ServerHearingB | null;
}

/**
 * 이 run 의 **가장 최근 A 1건 · B 1건**을 본문까지 가져온다. 화면 6 이 쓴다.
 *
 * 🔴 A 는 「가장 최근」이 아니라 **「가장 최근이면서 `result_url` 이 있는 것」**을 고른다.
 *    `/results/{parcel_id}` 는 필지의 최신 1건만 돌려주므로 최신이 아닌 A 행에는
 *    가리킬 URL 이 없다(서버가 `null` 을 준다). 정렬만 보고 첫 건을 집으면 URL 이
 *    없어 「토론이 없다」로 보인다. B 는 건별 id 라 이 문제가 없다.
 *
 * 🔴 목록 실패와 본문 실패를 **따로** 적는다. 합치면 「공청회가 없다」와 「있는데 본문을
 *    못 읽었다」가 화면에서 같은 말이 된다(원칙 4).
 */
export function useRunHearingDetails(): RunHearingDetails {
  const list = useRunHearings();

  /**
   * 🔴 `key` 는 **어느 목록에 대한 본문인가**다. 목록이 바뀌면 저장된 본문은 남의 답이라
   *    내보내지 않는다 — 예전엔 목록이 `null` 이 될 때 effect 안에서 동기로 비웠는데,
   *    그게 `react-hooks/set-state-in-effect` 에 걸리는 자리였다(위 두 훅과 같은 모양).
   *    배열 **동일성**으로 판정하는 게 맞다: `useRunHearings` 가 같은 답을 들고 있는 한
   *    같은 배열을 돌려주고, 다시 물으면 새 배열이 온다.
   */
  const [answer, setAnswer] = useState<{
    key: HearingItem[] | null;
    detailFailure: { A: string | null; B: string | null };
    a: ServerHearingA | null;
    b: ServerHearingB | null;
  }>({ key: null, detailFailure: { A: null, B: null }, a: null, b: null });

  const items = list.items;

  useEffect(() => {
    if (items === null) return;
    let alive = true;

    const asA = items.filter((h): h is HearingItemA => h.engine === "A" && h.result_url !== null);
    const itemA = asA.length === 0 ? null : latestOf<HearingItemA>(asA, "A");
    const itemB = latestOf<HearingItemB>(items, "B");

    void (async () => {
      let a: ServerHearingA | null = null;
      let b: ServerHearingB | null = null;
      const fail: { A: string | null; B: string | null } = { A: null, B: null };

      if (itemA?.result_url) {
        try {
          a = { item: itemA, detail: await fetchHearingByUrl<HearingDetailA>(itemA.result_url) };
        } catch (e) {
          fail.A = describeFailure(e);
        }
      }
      if (itemB) {
        try {
          b = { item: itemB, detail: await fetchHearingByUrl<HearingDetailB>(itemB.result_url) };
        } catch (e) {
          fail.B = describeFailure(e);
        }
      }
      if (!alive) return;
      setAnswer({ key: items, detailFailure: fail, a, b });
    })();

    return () => {
      alive = false;
    };
  }, [items]);

  const fresh = answer.key === items;
  return {
    loading: list.loading,
    failure: list.failure,
    total: items === null ? null : items.length,
    detailFailure: fresh ? answer.detailFailure : { A: null, B: null },
    a: fresh ? answer.a : null,
    b: fresh ? answer.b : null,
  };
}
