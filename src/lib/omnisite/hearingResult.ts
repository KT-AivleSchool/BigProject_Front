/**
 * 화면 6 이 읽는 「토론 결과」.
 * ============================
 * 화면 6(보고서)은 파이프라인 산출물 5종을 싣는데, 그중 **토론 결과만 산출물이
 * 아니다.** 나머지(감리·정제·가중치·위치선정)는 `runs/<id>/` 파일에서 오지만
 * 토론은 화면 5 가 SSE 로 받아 화면 상태로만 들고 있었다. 새로고침하면 사라지고,
 * 화면 6 에서는 처음부터 볼 방법이 없었다.
 *
 * 🔴 **엔진이 둘이라 저장소도 둘이다. 하나로 합치지 않았다.**
 *
 *  A(대립 토론 · `/hearing`) — 동현님 화면이 이미 `sim_*` 다섯 키에 넣고 있다.
 *    여기서는 **읽기만** 한다. 그 파일을 안 건드리려는 것이다(쓰는 쪽을 이리로
 *    옮기면 그 화면의 복원 경로까지 같이 바뀐다).
 *    ⚠ 그래서 A 는 **범위(scope)가 없다.** 어느 주제·어느 PNU 로 돌린 토론인지
 *      키에 없고 `sim_parcel`(parcel_id) 하나만 있다. 화면 6 은 이 값을 **그대로
 *      표시**하고, 지금 고른 후보와 같은지는 보는 사람이 판단한다 —
 *      「같을 것이다」로 적으면 다른 필지의 토론이 이 보고서의 근거가 된다.
 *
 *  B(다인 토론 · `/dynamic-hearing`) — 내 화면이라 여기서 **쓰기도** 한다.
 *    `sitePick.ts`·`personaCache.ts` 와 같은 규약이다: 버전 붙인 키 ·
 *    sessionStorage · 읽을 때 모양 검사 · 안 맞으면 없는 셈. 범위는 저장한다
 *    (pnu·topic·purpose) — 지어낼 수 없는 값이라 적어 두면 대조가 가능하다.
 *
 * 둘 다 sessionStorage 인 이유: 토론은 **지금 이 흐름**에 속한다. 화면 4 선택
 * (`sitePick`)·페르소나(`personas`)와 수명이 같아야 탭을 닫았다 열었을 때
 * 「위치는 초기화됐는데 토론만 남는」 일이 안 생긴다.
 */

/** 발화 1건. 두 엔진의 모양이 달라 화면 6 용으로 접은 것이다. */
export interface HearingLine {
  speaker: string;
  text: string;
  /**
   * 발화자 종류. **B 에만 있다**(2026-08-11 백엔드가 `speaker.kind` 를 주기
   * 시작했다: `persona`·`moderator`·`factchecker`·`unknown`). 프런트가 끼워 넣은
   * 안내는 `frontend` 다 — 서버 발화와 우리 문장을 보고서에서 갈라야 한다.
   *
   * 🔴 **옵셔널이고 앞으로도 그렇다.** A 엔진 기록과 이미 저장된 옛 B 기록에는
   *    없다. 필수로 만들면 `isLine` 이 옛 기록을 통째로 「모양이 안 맞음」으로
   *    버려서, 새로고침 한 번에 화면 6 의 토론 절이 사라진다.
   */
  kind?: string;
}

/** A(대립) — 동현님 `sim_*` 키를 접은 것. 쓰지 않는다. */
export interface HearingResultA {
  engine: "A";
  lines: HearingLine[];
  finished: boolean;
  /** `sim_parcel`. A 가 남기는 유일한 대조 단서다. 없으면 `null`. */
  parcelId: number | null;
  /**
   * 등급 원문(`LOW`/`MEDIUM`/`HIGH`)과 수용도. 안 온 값은 `null`.
   *
   * 🔴 **수용도는 `0~100`(퍼센트 값)이다.** 「0~1」이라고 적어 뒀던 건 틀렸다 —
   *    쓰는 쪽(`app/hearing/page.tsx:226`)이 SSE 의 `pro_acc`(0~1)에
   *    `Math.round(x * 100)` 을 이미 걸어 넣는다. 이 주석을 믿고 화면 6 이 다시
   *    100 을 곱해 **4500%** 를 찍고 있었다(2026-08-11 실측). 여기 100 을
   *    나눠 「고쳐」 두지 않는다 — 원본 저장값을 바꾸면 화면 5 쪽 표시가 갈린다.
   */
  metrics: {
    cssPro: string | null;
    cssCon: string | null;
    proAccept: number | null;
    conAccept: number | null;
  } | null;
}

/** B(다인) — 이 파일이 쓰고 이 파일이 읽는다. */
export interface HearingResultB {
  engine: "B";
  lines: HearingLine[];
  /** 무엇으로 돌린 토론인지. A 에는 없는 값이다. */
  scope: {
    domain: string | null;
    runId: string | null;
    pnu: string | null;
    jibun: string | null;
    parcelId: number | null;
    topic: string;
    purpose: string;
  };
  /** 참여 페르소나 이름 — 「누가 말했나」를 보고서에 적으려면 명단이 필요하다. */
  participants: string[];
  /**
   * 마지막 `evaluator`/`reporter` 갱신 원문. **모양을 우리가 정하지 않는다** —
   * LangGraph 노드가 무엇을 실을지는 백엔드가 정하고, 여기서 키를 추려 담으면
   * 백엔드가 필드를 늘렸을 때 화면 6 만 조용히 옛 값을 보인다.
   */
  status: Record<string, unknown> | null;
  /**
   * 🔴 **서버 저장 결과.** 2026-08-11 백엔드가 `hearing_results_b` 를 신설하면서
   *    SSE 끝에 `saved`(`hearing_id`·`result_url`) 또는 `save_failed`(`error`)를
   *    하나 보낸다. 여기 담는 건 **서버에 남았다는 근거**다 —
   *    이 sessionStorage 기록 자체는 탭을 닫으면 사라지므로 근거가 될 수 없다.
   *
   *    셋을 구분한다: `serverId` 있음 = 저장됨 · `saveError` 있음 = **저장 실패**
   *    (토론은 돌았지만 서버엔 없다) · 둘 다 `null` = 서버가 아무 말도 안 했다
   *    (옛 백엔드거나 스트림이 끊겼다). 실패를 `null` 로 뭉개면 화면 6 이
   *    「조회하면 있다」고 거짓말한다(원칙 1·4).
   */
  serverId: number | null;
  /** 서버가 준 조회 경로 원문. 우리가 조립하지 않는다 — 규칙을 두 곳에 두게 된다. */
  resultUrl: string | null;
  /** 서버 저장 실패 사유 원문. 성공했으면 `null`. */
  saveError: string | null;
  /** 저장 시각(ISO). 보고서에 "언제 돈 토론인지"를 적으려면 필요하다. */
  savedAt: string;
}

const B_KEY = "omnisite.hearingB.v1";

function isLine(v: unknown): v is HearingLine {
  if (typeof v !== "object" || v === null) return false;
  const l = v as HearingLine;
  return typeof l.speaker === "string" && typeof l.text === "string";
}

// ── A (읽기 전용) ──────────────────────────────────────────────

/**
 * A 엔진 대화를 읽는다. 대화가 한 줄도 없으면 `null` —
 * 「안 돌렸다」와 「돌렸는데 비었다」를 화면 6 에서 구분할 필요가 없다(둘 다 실을 게 없다).
 */
export function readHearingA(): HearingResultA | null {
  if (typeof window === "undefined") return null;
  const ss = window.sessionStorage;
  const rawMessages = ss.getItem("sim_messages");
  if (!rawMessages) return null;

  let lines: HearingLine[];
  try {
    const v = JSON.parse(rawMessages) as unknown;
    if (!Array.isArray(v)) return null;
    // 저장소 값은 주장일 뿐이다. `text` 없는 건이 하나라도 있으면 통째로 버린다.
    const mapped = v.map((m) => {
      if (typeof m !== "object" || m === null) return null;
      const msg = m as { name?: unknown; role?: unknown; text?: unknown };
      if (typeof msg.text !== "string") return null;
      const speaker =
        typeof msg.name === "string" && msg.name
          ? msg.name
          : typeof msg.role === "string" && msg.role
            ? msg.role
            : "발언자 미상";
      return { speaker, text: msg.text };
    });
    if (mapped.some((m) => m === null)) return null;
    lines = mapped as HearingLine[];
  } catch {
    return null;
  }
  if (lines.length === 0) return null;

  let metrics: HearingResultA["metrics"] = null;
  try {
    const v = JSON.parse(ss.getItem("sim_metrics") ?? "null") as unknown;
    if (typeof v === "object" && v !== null) {
      const m = v as Record<string, unknown>;
      metrics = {
        cssPro: typeof m.cssPro === "string" ? m.cssPro : null,
        cssCon: typeof m.cssCon === "string" ? m.cssCon : null,
        proAccept: typeof m.proAccept === "number" ? m.proAccept : null,
        conAccept: typeof m.conAccept === "number" ? m.conAccept : null,
      };
    }
  } catch {
    metrics = null;
  }

  const rawParcel = ss.getItem("sim_parcel");
  const parcelNum = rawParcel === null ? NaN : Number(rawParcel);

  return {
    engine: "A",
    lines,
    finished: ss.getItem("sim_finished") === "true",
    parcelId: Number.isFinite(parcelNum) ? parcelNum : null,
    metrics,
  };
}

// ── B (읽기·쓰기) ──────────────────────────────────────────────

export function readHearingB(): HearingResultB | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(B_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return null;
    const r = v as HearingResultB;
    if (!Array.isArray(r.lines) || r.lines.length === 0) return null;
    if (!r.lines.every(isLine)) return null;
    if (typeof r.scope !== "object" || r.scope === null) return null;
    if (typeof r.savedAt !== "string") return null;
    if (!Array.isArray(r.participants)) return null;
    /**
     * 🔴 저장 3필드는 **필수로 검사하지 않는다.** 이 키들이 생기기 전(2026-08-11
     *    이전)에 쓰인 기록은 이 값이 없는데, 없다고 `null` 을 돌려주면 **이미 돈
     *    토론이 화면 6 에서 통째로 사라진다.** 없는 것은 「서버가 아무 말도 안 했다」
     *    로 읽는다 — 그건 사실이다(그때는 서버가 저장을 안 했다).
     */
    return {
      ...r,
      engine: "B",
      serverId: typeof r.serverId === "number" ? r.serverId : null,
      resultUrl: typeof r.resultUrl === "string" ? r.resultUrl : null,
      saveError: typeof r.saveError === "string" ? r.saveError : null,
    };
  } catch {
    return null;
  }
}

export function writeHearingB(result: Omit<HearingResultB, "engine" | "savedAt">): void {
  if (typeof window === "undefined") return;
  const payload: HearingResultB = {
    ...result,
    engine: "B",
    savedAt: new Date().toISOString(),
  };
  try {
    window.sessionStorage.setItem(B_KEY, JSON.stringify(payload));
  } catch {
    /**
     * 용량 초과(QuotaExceededError). **던지지 않는다** — 저장은 화면 6 을 위한
     * 부가 기능이고, 여기서 던지면 방금 끝난 토론이 화면 5 에서도 사라진다.
     * 화면 6 은 "토론 기록이 없습니다"를 띄울 뿐이다(없는 걸 지어내지 않는다).
     */
  }
}

export function clearHearingB(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(B_KEY);
}

// ── 화면 5 완료 판정 ───────────────────────────────────────────

/**
 * 이 run 의 토론이 끝났는가 — **로컬 폴백 판정이다.**
 *
 * 🔴 제대로 된 기준은 「토론 결과가 그 run 으로 **DB 에 저장됐다**」이고, 2026-08-11
 *    백엔드가 그 경로를 열었다(`hearings.ts`). 그래서 **본선은 서버**이고 이 함수는
 *    서버에 **못 물었을 때만** 쓰인다 — 적재 칸이 없는 실행(`fixture`·`hitl`)은
 *    조인 키(`loaded.run_id`)가 없어 물을 수가 없고, 404·네트워크 실패도 마찬가지다.
 *    ⚠ 서버가 「0건」이라고 **답한** 경우에는 여기로 내려오지 않는다. 그건 「못
 *    물었다」가 아니라 「물었더니 없다」이고, 여기서 로컬을 보면 **다른 run 에서 돈
 *    토론**이 이 run 의 완료 표시가 된다.
 *
 *    이 판정은 이 탭의 sessionStorage 에만 근거하므로 탭을 닫으면 사라진다 —
 *    폴백으로서는 그게 정확하다. 서버에 없는 것을 「완료」로 굳히지 않는다(원칙 4).
 *
 * 🔴 **범위 대조는 B 만 된다.** A(`sim_*`)는 어느 run 으로 돌린 토론인지 저장하지
 *    않는다(이 파일 맨 위 참고). 그래서 A 는 「기록이 있다」까지만 말할 수 있다.
 *    이걸 이유로 A 를 영영 미완으로 두지는 않는다 — 그러면 엔진 하나만 완료가 안 되는
 *    비대칭이 생기고, 그건 「A 로 돌리면 화면이 고장 난다」로 읽힌다.
 *
 * 판정:
 *   B 기록 · `scope.runId` 가 현재 run 과 **같다**  → 끝났다
 *   B 기록 · `scope.runId` 가 `null`(대조 불가)     → 끝난 것으로 친다
 *   B 기록 · `scope.runId` 가 **다르다**            → 아니다 (다른 실행의 토론이다)
 *   A 기록                                          → 끝난 것으로 친다 (대조 불가)
 */
export function isHearingDoneFor(runId: string | null): boolean {
  const b = readHearingB();
  if (b) {
    if (!b.scope.runId || !runId) return true;
    return b.scope.runId === runId;
  }
  
  if (readHearingA() !== null) {
    if (typeof window !== "undefined") {
      const simRunId = window.sessionStorage.getItem("sim_run_id");
      if (simRunId && runId && simRunId !== runId) return false;
    }
    return true;
  }
  return false;
}
