/**
 * 화면 4 에서 고른 「토론할 위치」 보관.
 * ====================================
 * 화면 5 는 **사람이 화면 4 에서 고른 그 점**으로 토론한다. 예전엔 화면 5 가
 * `candidates[0]`(rank 1)을 스스로 골랐는데, 그건 추천을 강제로 읽은 것이다 —
 * `rank == 1` 은 추천이지 결정이 아니다(2026-08-10 사람 결정).
 *
 * 🔴 **조인 키는 `pnu` 다. `rank` 가 아니다.**
 *    화면 4 는 run 산출물(`topN.csv`)을 읽고, 화면 5 는 DB 적재분
 *    (`GET /simulation/candidates`)을 읽는다. **두 출처는 같은 run 이 아닐 수
 *    있다** — 적재기는 「가장 최근 적재분」을 돌려주므로 화면 4 가 보고 있는 run
 *    보다 새 실행이 들어와 있을 수 있다. 그때 `rank` 로 이으면 **말없이 다른
 *    필지**가 토론에 들어간다(같은 1위여도 실행이 다르면 다른 땅이다).
 *    `pnu` 는 필지 자체의 식별자라 실행이 바뀌어도 같은 땅을 가리킨다.
 *
 * 🔴 못 이으면 **rank 로 되짚지 않는다.** 화면 5 가 사유를 띄우고 멈춘다 —
 *    "고른 것과 다른 점으로 돌렸다"는 조용한 오동작이 가장 나쁘다(원칙 1·4).
 *
 * sessionStorage 를 쓰는 이유: 이 선택은 **지금 이 흐름**에 속한다. run_id 처럼
 * 새로고침·재방문을 넘겨 살아남아야 하는 값이 아니고, 화면 5 의 대화 복원
 * (`sim_*`)도 같은 저장소에 있어 수명이 맞는다.
 */
const KEY = "omnisite.sitePick.v1";

export interface SitePick {
  /** 고른 시점의 run_id. 어느 실행의 표에서 고른 것인지 밝히려고 같이 남긴다. */
  run_id: string | null;
  /** 화면 4 표의 `순위` 원본. 표시용이다 — **조인에 쓰지 않는다.** */
  rank: number;
  /** 필지 고유번호. 화면 5 가 이 값으로 후보를 찾는다. */
  pnu: string;
  /** 사람이 읽을 지번. 못 이었을 때 "무엇을 골랐는지"를 말해주려고 남긴다. */
  jibun: string;
}

export function readSitePick(): SitePick | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    // 저장소 값은 주장일 뿐이다(수기 편집·옛 버전). 모양이 안 맞으면 없는 셈 친다.
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as SitePick).pnu === "string" &&
      typeof (v as SitePick).rank === "number"
    ) {
      return v as SitePick;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSitePick(pick: SitePick): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(pick));
}

export function clearSitePick(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
