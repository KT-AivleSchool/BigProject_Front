/**
 * 화면 5(공청회 시뮬레이션) API.
 * ==============================
 * 백엔드 실측 2026-08-10. `02_작업일지/2026-08-10.md` §4·§6-0 이 근거다.
 *
 * prefix 가 **두 개다** — `/api/v1/simulation` 과 `/api/v1/simulations`.
 * 같은 라우터 객체가 두 번 등록돼 있어(`main.py:161-170`) 어느 쪽으로 불러도
 * 같은 핸들러가 돈다.
 *
 * 🔴 **복수형이 정본이다**(2026-08-11 백엔드 회신). 예전엔 단수형만 썼는데,
 *    응답 **안의 자기 링크**(`result_url`·`pdf_url`·SSE `saved`)가 전부 복수형으로
 *    굳어 있다(`simulations.py:824·827·879` · `stakeholders.py:527`). 단수로 부르면
 *    **서버가 준 URL 을 그대로 못 쓴다** — 프런트가 prefix 를 치환해야 하고,
 *    그 순간 「경로는 서버가 정한다」가 깨진다. 실제로 `hearings.ts` 가 한동안
 *    `.replace()` 로 갈아끼우고 있었다.
 *    단수형은 호환용으로 유지된다고 했으나 **우리는 안 쓴다** — 둘을 섞으면
 *    나중에 하나를 걷어낼 때 어디가 깨지는지 알 수 없다.
 */
import { getJson } from "./client";

const BASE = "/api/v1/simulations";

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
 * Top-N 후보 목록. **화면 4 가 위치를 고르는 입구**다.
 *
 * 🔴 예전 주석은 "선정 위치는 `candidates[0]`(rank 1) 이다" 였다. **폐기한다** —
 *    `rank == 1` 은 추천이지 결정이 아니다(2026-08-10 사람 결정). 화면 5 는
 *    사람이 화면 4 에서 고른 필지를 `pnu` 로 찾아 쓴다(`sitePick.ts`).
 *
 * 🔴 **`score` 로 다시 정렬하지 않는다.** MCLP 는 커버 기여도 기준 그리디라
 *    순위와 점수가 일치하지 않는다 — 실측에서 4위 0.7793 > 1위 0.7703 이다.
 *    `ORDER BY score DESC` 로 뽑으면 STEP4 가 고른 것과 **다른 점**이 나온다.
 *    서버가 `rank ASC` 로 주므로 받은 순서를 그대로 쓴다.
 *
 * 🔴 `limit` 은 **화면에 몇 개를 그릴지**일 뿐 N 을 정하지 않는다. N 은 STEP4 의
 *    `--topn`(기본 20)이 정한다.
 *
 * 🔴 `runId` 는 **`run.loaded.run_id` 를 그대로 넘긴다.** 안 넘기면 서버가 그 도메인의
 *    **가장 최근 적재분**을 준다 — 같은 도메인을 두 번 돌리면 화면 4 에서 고른 점이
 *    이전 실행 것이라 목록에 없거나, 있어도 rank 가 겹쳐 다른 필지를 가리킨다.
 *    「mode 가 full 이면 run_id 와 같다」를 여기서 다시 계산하지 않는다 — 어디에
 *    적재됐는지는 적재한 쪽만 안다(`RunLoaded` 주석).
 *
 * 후보가 0건이면 서버가 **404 + 적재 명령**을 준다(빈 배열이 아니다). 그래서
 * 여기서 빈 배열로 바꾸지 않는다 — "후보 없음"과 "적재 안 함"을 구분하려고
 * 서버가 일부러 갈라놓은 것을 프런트에서 도로 뭉개면 안 된다.
 */
export function fetchCandidates(
  domain: string,
  runId?: string | null,
  limit?: number,
): Promise<CandidateList> {
  const q = new URLSearchParams({ domain });
  if (runId) q.set("run_id", runId);
  if (limit !== undefined) q.set("limit", String(limit));
  return getJson<CandidateList>(`${BASE}/candidates?${q.toString()}`);
}

// ── /stream (SSE) ────────────────────────────────────────────────

/**
 * `/stream` 요청 본문.
 *
 * 🔴 `audit_data` 를 지웠다(2026-08-11, 백엔드 계약 변경). 프런트는 늘 `{}` 를
 *    보내고 있었고 서버는 그걸 쓰지 않았다 — 감리 근거는 요청이 아니라 서버가
 *    `parcel_id` 로 `booth_candidates → (domain, run_id)` 를 잡아 `audit_rules`
 *    에서 읽는다. 요청에 자리를 남겨두면 「여기에 넣으면 반영된다」로 읽히고,
 *    실제로 넣어도 **말없이 버려진다**(원칙 4).
 *    서버는 이제 제거된 키가 오면 **400 + 사유**다(422 가 아니다 — 왜 못 쓰는지를
 *    문구로 준다). 그래서 이 필드는 옵셔널로 남기지 않고 **없앤다.**
 */
export interface StreamRequest {
  parcel_id: number;
  facility_type: string;
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
  /**
   * 🔴 여기 하나만 **서버 코드가 아니라 화면이 붙이는 코드**다(`hearing/page.tsx`
   *    의 `onopen`). 제목을 굳이 넣는 이유는 이 코드가 가리키는 곳이 다른 것들과
   *    정반대이기 때문이다 — 나머지는 「백엔드를 보라」인데 이건 **「백엔드를 보지
   *    말라」**다. 제목이 없으면 코드가 그대로 큰 글씨가 되고, 사람은 아래 사유를
   *    읽기 전에 이미 토론 엔진 로그를 뒤진다(2026-08-14 에 실제로 그랬다).
   */
  BACKEND_UNREACHABLE: "백엔드에 연결하지 못했습니다 (프록시 구간)",
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

/**
 * **30초를 넘을 수 있는 호출** 전용 백엔드 오리진.
 *
 * 🔴 **이 저장소의 규칙(「브라우저는 항상 같은 출처로만 부른다」)에 대한 예외다.**
 *    규칙이 흔들린 게 아니다 — 나머지 라우트는 전부 rewrite 그대로다. 여기를
 *    보고 「이제 절대 URL 을 써도 된다」로 읽지 말 것.
 *
 * 🔴 **판정 기준은 「SSE 냐」가 아니라 「30초를 넘느냐」다**(2026-08-15 정정).
 *    이 함수는 이름부터 `sseUrl` 이었고 주석도 「예외는 둘이고 둘 다 SSE」라고
 *    적고 있었는데, 그 분류 때문에 SSE 가 아닌 `POST /stakeholders/generate` 를
 *    「한 번에 받는 JSON 이라 버퍼링이 무해하다」며 남겨 뒀다가 그대로 터졌다 —
 *    사용자 화면에 **HTTP 504 · 본문 없음**. LLM 이 페르소나를 뽑는 동안 걸리는
 *    시간이 30초 벽을 넘는다는 것은 같은 파일이 이미 실측으로 알고 있었다
 *    (`next.config.ts:49` — 같은 요청이 29.2s 200 · 30.0s 실패). 응답이
 *    스트림이냐 단발이냐는 상관이 없었다. **소요 시간만 본다.**
 *    ⚠ 504 는 앞선 실측의 500 과 코드가 다르다. 30초 벽에서 나온다는 점은
 *      같지만 어느 계층이 낸 코드인지는 재보지 않았다 — 확인한 것만 적는다.
 *
 * 왜 예외인가 — **Amplify Hosting 의 SSR compute 구간이 응답을 통째로 버퍼링하다
 * 30.0초에 바디 없는 500 을 만든다.** 같은 요청을 두 경로로 잰 실측(2026-08-14):
 *   · Amplify 경유 `omnisite.o-r.kr`      → **30.065s · 500 · 0 bytes · CT 없음**
 *   · 백엔드 직접  `api.omnisite.o-r.kr`  → TTFB **0.049s** · 44.4s · 200 ·
 *                                            141,895 bytes · chunked
 * 읽는 자리는 **TTFB 한 칸**이다. 백엔드는 49ms 에 첫 바이트를 내는데 Amplify
 * 경유는 30초 동안 한 바이트도 못 받는다 — 느린 게 아니라 들고 있는 것이다.
 *
 * 🔴 **타임아웃을 올려서는 못 고친다.** `SIZE=0` 은 느림이 아니라 버퍼링이라,
 *    상한만 올리면 「30초에 에러」가 「50초 무반응 뒤 한꺼번에」로 바뀔 뿐이고
 *    화면 5 의 존재 이유(토큰이 실시간으로 흐르는 것)는 그대로 죽는다.
 *    그래서 처치는 **그 구간을 들어내는 것** 하나뿐이다.
 *
 * 다른 후보는 실측으로 다 뺐다 — nginx 는 `proxy_buffering off` + TTFB 49ms 로
 * 무죄, CloudFront 는 타임아웃이 **504 + HTML 본문**이라 무죄, Next rewrite 는
 * `proxyTimeout` 360초에 idle 기준이고 결정적으로 `onProxyError` 가 본문 **21
 * bytes**(`Internal Server Error`)를 쓰는데 실측이 **0 bytes** 라 무죄다.
 *
 * ⚠ **`credentials: "include"` 를 쓰지 말 것.** 실제 응답의 `access-control-allow-origin`
 *   이 `*` 라 브라우저가 credentials 모드에서 거부한다. 지금 두 호출 다 쿠키·
 *   `Authorization` 을 안 싣으므로 고칠 것이 없다 — 이 스트림에 인증을 붙이는
 *   날 백엔드에 오리진 명시를 요청할 것(preflight 는 이미 200 이다).
 *
 * ⚠ 백엔드가 다른 호스트로 가면 **여기 한 줄만** 고치면 된다. 값을 흩뿌리지 않는
 *   이유가 그것이다. `NEXT_PUBLIC_` 을 안 쓰는 이유 — 값이 하나뿐이고 빌드마다
 *   바뀌지 않으며, 이 호스트는 공개 DNS·인증서 투명성 로그에 이미 공개돼 있어
 *   번들에 박혀도 잃는 게 없다(숨겨져 있던 적이 없다).
 */
export const BACKEND_ORIGIN = "https://api.omnisite.o-r.kr";

/**
 * 오래 걸리는 경로를 부를 주소로 바꾼다.
 *
 * 🔴 **로컬 개발은 rewrite 를 그대로 탄다.** Amplify compute 가 로컬에는 없어서
 *    이 문제 자체가 없고, 절대 URL 로 돌리면 `OMNISITE_API_ORIGIN` 이 가리키는
 *    **로컬 백엔드 대신 운영을 친다** — 개발 중에 운영 데이터로 토론이 돌아간다.
 *    (`next.config.ts` 의 ⓒ 함정은 여기 해당 없다. 붙이는 값이 `localhost` 가
 *     아니라 공개 도메인이라 IPv6 우선 해석 문제가 안 생긴다.)
 *
 * ⚠ `next build && next start` 를 로컬에서 돌리면 운영 백엔드를 친다. 프로덕션
 *   빌드를 로컬에서 검증할 때만 생기는 일이고, 그때 운영을 읽는 것 자체는 해가
 *   없어 분기를 더 얹지 않는다.
 */
export function directUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN || process.env.OMNISITE_API_ORIGIN;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    if (origin) {
      return path.replace("https://api.omnisite.o-r.kr", origin);
    }
    return path;
  }
  if (process.env.NODE_ENV === "development") return path;
  if (origin) {
    return `${origin}${path}`;
  }
  return path;
}

export const STREAM_URL = directUrl(`${BASE}/stream`);
