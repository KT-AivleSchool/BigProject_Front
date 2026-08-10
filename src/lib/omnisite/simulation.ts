/**
 * 화면 5(공청회 시뮬레이션) API.
 * ==============================
 * 백엔드 실측 2026-08-10. `02_작업일지/2026-08-10.md` §4·§6-0 이 근거다.
 *
 * prefix 가 **두 개다** — `/api/v1/simulation` 과 `/api/v1/simulations`.
 * 같은 핸들러가 두 번 등록돼 있어 어느 쪽으로 불러도 돈다. 프런트는 **단수형만**
 * 쓴다. `next.config.ts` 의 rewrite 가 단수형만 열려 있고, 둘을 섞으면 나중에
 * 하나를 걷어낼 때 어디가 깨지는지 알 수 없다. (라우트를 하나 늘리면 백엔드에선
 * 둘이 는다 — 그건 백엔드 사정이고 우리가 따라갈 이유는 없다)
 */
import { getJson } from "./client";

const BASE = "/api/v1/simulation";

/**
 * STEP4 Top-N 후보점 1건. `booth_candidates` 한 행이 그대로 온다.
 *
 * 🔴 `land_id` 는 **null 이 정상**이다. `candidate_lands` 는 2026-07-14 스냅샷
 *    6,524행이고 우리 STEP3 후보(42,216필지)와 같은 집합이 아니다. 적재기가
 *    공간조인으로 유도하되 매칭 실패는 NULL 로 둔다 — 0 으로 채우면 **다른
 *    필지**를 가리킨다. 지도·POI 는 `land_id` 가 아니라 `lat`/`lng` 를 쓴다.
 */
export interface Candidate {
  parcel_id: number;
  rank: number;
  score: number;
  pnu: string;
  jibun: string;
  facility_type: string;
  run_id: string;
  land_id: number | null;
  lat: number;
  lng: number;
}

export interface CandidateList {
  domain: string;
  count: number;
  candidates: Candidate[];
}

/**
 * Top-N 후보 목록. **선정 위치는 `candidates[0]`(rank 1)** 이다.
 *
 * 🔴 **`score` 로 다시 정렬하지 않는다.** MCLP 는 커버 기여도 기준 그리디라
 *    순위와 점수가 일치하지 않는다 — 실측에서 4위 0.7793 > 1위 0.7703 이다.
 *    `ORDER BY score DESC` 로 뽑으면 STEP4 가 고른 것과 **다른 점**이 나온다.
 *    서버가 `rank ASC` 로 주므로 받은 순서를 그대로 쓴다.
 *
 * 🔴 `limit` 은 **화면에 몇 개를 그릴지**일 뿐 N 을 정하지 않는다. N 은 STEP4 의
 *    `--topn`(기본 20)이 정한다.
 *
 * 후보가 0건이면 서버가 **404 + 적재 명령**을 준다(빈 배열이 아니다). 그래서
 * 여기서 빈 배열로 바꾸지 않는다 — "후보 없음"과 "적재 안 함"을 구분하려고
 * 서버가 일부러 갈라놓은 것을 프런트에서 도로 뭉개면 안 된다.
 */
export function fetchCandidates(domain: string, limit?: number): Promise<CandidateList> {
  const q = new URLSearchParams({ domain });
  if (limit !== undefined) q.set("limit", String(limit));
  return getJson<CandidateList>(`${BASE}/candidates?${q.toString()}`);
}

// ── /stream (SSE) ────────────────────────────────────────────────

/** `/stream` 요청 본문. `audit_data` 는 서버가 받아만 두고 비어 있어도 된다. */
export interface StreamRequest {
  parcel_id: number;
  facility_type: string;
  audit_data: Record<string, unknown>;
}

/**
 * 서버가 SSE 로 내보내는 에러 코드.
 *
 * 🔴 `CANDIDATE_NOT_FOUND` 는 2026-08-10 에 **새로 생겼다.** 예전에는 후보점을
 *    못 찾으면 용산 좌표 (37.534, 126.994) "이태원동 123-45 (테스트용)" 으로
 *    갈아끼우고 **5분짜리 토론을 그대로 완주**했다. 화면엔 정상 결과로 보였다.
 *    그 폴백이 제거됐으므로 이 코드가 오면 **그림을 그리지 말고 사유를 띄운다.**
 */
export const ERROR_CODES = [
  "CANDIDATE_NOT_FOUND",
  "OPENAI_QUOTA_EXCEEDED",
  "AI_ENGINE_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** 사람이 읽을 제목. 서버 `message` 를 대체하지 않고 **앞에 붙인다.** */
export const ERROR_TITLES: Record<string, string> = {
  CANDIDATE_NOT_FOUND: "후보점을 찾지 못했습니다",
  OPENAI_QUOTA_EXCEEDED: "OpenAI 사용량 한도를 초과했습니다",
  AI_ENGINE_ERROR: "AI 엔진 오류",
};

/**
 * 모르는 코드도 그대로 보여준다. 화이트리스트에 없다고 "알 수 없는 오류"로
 * 뭉개면 서버가 새 코드를 추가한 날 원인이 사라진다(원칙 4).
 */
export function errorTitle(code: string): string {
  return ERROR_TITLES[code] ?? code;
}

/**
 * 🔴 타임아웃은 **첫 요청과 이후를 갈라 잡는다.** 실측(2026-08-10 §6-0):
 *
 *   | | 서버 기동 후 첫 토론 | 이후 토론 |
 *   |---|---|---|
 *   | 첫 SSE 패킷까지 | **264.2s** | 2.6s |
 *   | 총 소요 | 318.2s | 30.5s |
 *
 * PGVector store 초기화가 **프로세스당 1회** 든다(`get_vector_db()` 싱글톤).
 * 토론 본체는 30~54초다. 그래서 하나의 넉넉한 값으로 잡으면 진짜 멈춤을 못
 * 잡고, 짧게 잡으면 첫 토론이 무조건 끊긴다.
 *
 * 🔴 "이후"는 **브라우저 기준이 아니라 서버 프로세스 기준**이다. 백엔드를
 *    재시작하면 이 비용이 다시 든다 — 그래서 프런트가 "한 번 해봤으니 이제
 *    빠르다"고 단정하면 안 된다. 판단 근거는 **실제로 첫 패킷이 언제 왔는가**
 *    뿐이므로, 첫 패킷을 받기 전까지는 항상 긴 쪽을 쓴다.
 */
export const FIRST_PACKET_TIMEOUT_MS = 5 * 60 * 1000; // 첫 패킷 대기 상한 (실측 264.2s)
export const IDLE_TIMEOUT_MS = 60 * 1000; // 패킷 간 침묵 상한 (실측 2.6s)

/** SSE 한 패킷. 토큰 조각이라 1,400~1,600건 온다(완성 발화는 14건). */
export interface StreamPacket {
  sender?: string;
  text?: string;
  metrics?: {
    css_pro?: string;
    css_con?: string;
    pro_acc?: number;
    con_acc?: number;
  };
  is_finished?: boolean;
  error_code?: string;
  message?: string;
}

export const STREAM_URL = `${BASE}/stream`;
