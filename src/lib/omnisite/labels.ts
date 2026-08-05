/**
 * 지표·데이터셋 이름 짓기 — **만들어내지 않는다.**
 * ================================================
 * 명세 화면 3 의 예시에는 "유동인구 · 버스정류소 접근 · 건물 밀도" 같은 지표명이
 * 적혀 있다. 그런데 **산출물 어디에도 그런 필드가 없다**(실측). 있는 것은
 *
 *   weight_set.indicators[].id            → "07+02" 같은 dataset_id 조합
 *   weight_set.indicators[].components    → {geo: "07", val: "02"}
 *   reviewed.results[].roles[].facility_type → "버스정류소" (배제 역할일 때만)
 *   clean_report.results[].filename       → 원본 파일명
 *   reviewed.results[].summary            → 한 줄 요약 (문장)
 *
 * 여기서 "유동인구" 를 지어내면 화면과 산출물이 어긋나고, 나중에 누가 그걸
 * 근거로 판단한다. 그래서 **id 를 1차 이름으로 두고**, 사람이 읽을 이름은
 * 위 순서대로 데이터에서 끌어온다. 못 찾으면 못 찾았다고 둔다.
 *
 * 우선순위:  facility_type → 파일명에서 뽑은 어간 → dataset_id
 */
import type { CleanReportDoc, ReviewedDoc } from "./types";

export interface DatasetLabel {
  id: string;
  /** 사람이 읽을 이름. 근거가 없으면 id 와 같다. */
  name: string;
  /** 이 이름이 어디서 왔는지. 화면에 같이 보여준다(출처 기록 규약). */
  source: "facility_type" | "filename" | "dataset_id";
  filename: string | null;
  summary: string | null;
}

/**
 * 파일명에서 사람이 읽을 어간을 뽑는다. 못 뽑으면 null.
 *
 * 🔴 처음엔 "한글 조각 중 가장 긴 것" 이었다. 그러면 **기관명이 이긴다** —
 *    실측 `소상공인시장진흥공단_상가(상권)정보_서울_202603.csv` 가 화면에
 *    "소상공인시장진흥공단"(10자) 으로 떴다. 데이터 이름은 "상가(상권)정보"(8자) 다.
 *    `서울특별시 용산구_가로휴지통_...` 도 같은 이유로 지역명이 이겼다.
 *
 *    공공데이터 파일명은 대체로 `기관_데이터명_지역_날짜` 순이다. 그래서 규칙을
 *    **"첫 조각을 뺀 나머지 한글 조각 중 가장 긴 것"** 으로 바꿨다. 첫 조각은
 *    기관 또는 지역이고, 데이터 이름이 첫 조각인 경우는 실측에 없다.
 *
 *    ⚠ 이건 **관례에 기댄 추정**이지 근거가 아니다. 그래서 화면에는 이름과 함께
 *    `source: "filename"` 을 같이 보여준다 — 이 이름이 어디서 왔는지 알아야
 *    틀렸을 때 알아챈다. `facility_type` 이 있으면 그쪽이 항상 이긴다.
 *
 * 실측 대조 (파일명 → 이 함수의 결과):
 *   "서울특별시 용산구_가로휴지통_20240630.csv"          → "가로휴지통"
 *   "소상공인시장진흥공단_상가(상권)정보_서울_202603.csv"  → "상가(상권)정보"
 *   "서울특별시_용산구_담배꽁초상습무단투기지역현황_...csv" → "담배꽁초상습무단투기지역현황"
 *   "LOCAL_PEOPLE_DONG_202605.csv"                      → "LOCAL_PEOPLE_DONG"
 */
function stemFromFilename(filename: string): string | null {
  const stem = filename.replace(/\.[^.]+$/, "");
  const parts = stem
    .split("_")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    // 순수 숫자(날짜·연월)와 파일 번호 접두를 버린다.
    .filter((p) => !/^\d+$/.test(p));
  if (parts.length === 0) return null;

  const korean = parts.filter((p) => /[가-힣]/.test(p));
  if (korean.length > 0) {
    // 첫 조각(기관·지역)을 후보에서 뺀다. 한글 조각이 그것뿐이면 어쩔 수 없이 쓴다.
    const candidates = korean.filter((p) => p !== parts[0]);
    const pool = candidates.length > 0 ? candidates : korean;
    return [...pool].sort((a, b) => b.length - a.length)[0] ?? null;
  }
  return parts.join("_");
}

export function buildDatasetLabels(
  reviewed: ReviewedDoc | null,
  cleanReport: CleanReportDoc | null,
): Map<string, DatasetLabel> {
  const map = new Map<string, DatasetLabel>();
  const files = new Map<string, string>();
  cleanReport?.results.forEach((r) => files.set(r.dataset_id, r.filename));

  const ids = new Set<string>([
    ...(reviewed?.results.map((r) => r.dataset_id) ?? []),
    ...(cleanReport?.results.map((r) => r.dataset_id) ?? []),
  ]);

  for (const id of ids) {
    const rev = reviewed?.results.find((r) => r.dataset_id === id) ?? null;
    const filename = files.get(id) ?? null;

    const facilityType = rev?.roles.find((x) => x.facility_type)?.facility_type;
    if (facilityType) {
      map.set(id, {
        id,
        name: facilityType,
        source: "facility_type",
        filename,
        summary: rev?.summary ?? null,
      });
      continue;
    }

    const stem = filename ? stemFromFilename(filename) : null;
    map.set(id, {
      id,
      name: stem ?? id,
      source: stem ? "filename" : "dataset_id",
      filename,
      summary: rev?.summary ?? null,
    });
  }
  return map;
}

/**
 * 지표 이름. `07+02` 처럼 두 데이터셋이 결합된 지표는 둘을 다 보여준다.
 * (07 = 버스정류소 위치, 02 = 승하차 통계 → "버스정류소 × 승하차인원")
 */
export function indicatorLabel(
  indicatorId: string,
  /** `val` 이 null 인 단일 데이터셋 지표가 있다(실측). 그래서 null 을 받는다. */
  components: Record<string, string | null>,
  labels: Map<string, DatasetLabel>,
): string {
  const ids = Object.values(components).filter((v) => typeof v === "string");
  const names = (ids.length > 0 ? ids : indicatorId.split("+"))
    .map((id) => labels.get(id)?.name ?? id)
    .filter((v, i, a) => a.indexOf(v) === i);
  return names.length > 0 ? names.join(" × ") : indicatorId;
}
