/**
 * 화면 1(업로드) API — 백엔드 2026-08-09 재작성판.
 * ================================================
 * 근거: `app/api/v1/upload.py` (라인은 각 함수 주석에). 라우트는 **7개**이고
 * **전부 `domain` 이 필수**다. 도메인이 없으면 어느 파이프라인의 입력인지
 * 정할 수 없어서 서버가 받지 않는다(`upload.py:12`).
 *
 * 🔴 옛 판(`uploads/regulations/`)은 **파이프라인이 안 읽는 곳**에 저장했다.
 *    올려도 STEP1 감리가 못 봤고 200 이 떨어져서 안 걸렸다. 지금은
 *      조례   → `datasets/<도메인>/law/`  (= `load_ordinance()` 가 읽는 폴더)
 *      데이터 → `datasets/<도메인>/data/` (= `profile_folder()` 가 읽는 폴더)
 *    프런트가 경로를 알 필요는 없지만, 응답의 `saved_to` 를 **화면에 남긴다** —
 *    "어디에 저장됐는지" 가 옛 판에서 틀렸던 바로 그 값이다(원칙 4).
 */
import { deleteJson, getJson, postForm } from "./client";

const BASE = "/api/v1/upload";

/**
 * 파일 선택창 `accept` 힌트. **검증은 서버가 한다** — 여기 목록은 사용자가
 * 못 고르게 막는 편의일 뿐이고, 어긋나면 서버 400 문구를 그대로 보여준다.
 * (프런트가 따로 거절하면 그 문구가 서버 정책과 어긋난다)
 *
 * 근거: `upload.py:81`(조례) · `:90`(데이터). 실측으로 확인한 값이다.
 *   TEXT_EXT .txt .md / EXTRACTORS .pdf .docx .hwpx
 *   DATA_EXTENSIONS .csv .xlsx .xls .shp .json / SIDECAR .dbf .shx .prj .cpg .qpj .sbn .sbx
 *
 * 🔴 `.hwp`·`.doc` 는 **일부러 빠져 있다.** 추출기가 없어 받아도 0청크다.
 *    옛 판은 둘 다 허용해놓고 조용히 아무것도 적재하지 않았다.
 */
export const LAW_ACCEPT = ".txt,.md,.pdf,.docx,.hwpx";
export const DATA_ACCEPT =
  ".csv,.xlsx,.xls,.shp,.json,.dbf,.shx,.prj,.cpg,.qpj,.sbn,.sbx";

// ── 1. 도메인 목록 ────────────────────────────────────────────────

/** `GET /domains` 한 줄. `upload.py:229-264` */
export interface DomainItem {
  domain: string;
  law_files: number;
  data_files: number;
  /** STEP1 감리 확정본이 있는가 = `facility_type` 을 생략해도 되는가. */
  has_audit_reviewed: boolean;
  /**
   * `mode=fixture`·`hitl` 로 돌릴 수 있는가(= `<도메인>_FIX` 픽스처가 온전한가).
   * `false` 면 그 두 모드는 **400** 이다. `mode=full` 은 픽스처와 무관하다.
   *
   * 🔴 판정은 **서버가 러너 자신의 사전검사로** 한다(`upload.py:302`
   *    `fixture_blocker(name) is None`). 프런트가 「`_FIX` 폴더가 있으면 가능」 같은
   *    규칙을 흉내 내면 서버와 갈라진다 — 실제 조건은 폴더가 아니라 **파일 둘**이라
   *    폴더만 보면 "가능"이라 그려놓고 실행이 400 으로 죽는다.
   * ⚠ 막힌 **이유**는 응답에 없다(저장소 절대경로가 새기 때문). 그래서 화면도
   *   「안 된다」까지만 말하고 사유를 지어내지 않는다.
   */
  has_fixture: boolean;
}

/**
 * 업로드 가능한 도메인 목록.
 *
 * 이 호출이 먼저다 — 나머지 6개가 전부 `domain` 을 요구하므로 사용자가 직접
 * 타이핑하게 두면 오타가 곧 "없는 도메인" 400 이 된다.
 */
export function fetchDomains(): Promise<DomainItem[]> {
  return getJson<DomainItem[]>(`${BASE}/domains`);
}

// ── 2. 조례 ───────────────────────────────────────────────────────

/** `GET /regulations` 한 줄. `upload.py:270-275` */
export interface RegulationItem {
  filename: string;
  size: number;
  /** 텍스트 추출이 끝나 STEP1 이 읽을 수 있는가. `false` 면 저장은 됐지만 안 쓰인다. */
  text_ready: boolean;
  chunks_in_vector_db: number;
}

/**
 * 업로드 1건의 처리 결과. `upload.py:406-420`.
 *
 * 🔴 `ingested: false` 여도 **파일은 이미 저장돼 있다.** 서버가 그 사실을
 *    숨기지 않고 `warnings` 에 어디까지 됐는지 남긴다 — 화면도 숨기면 안 된다.
 */
export interface RegulationReport {
  filename: string;
  size: number;
  sha256: string;
  /** 같은 이름을 덮어썼는가. 덮어썼으면 옛 청크는 `deleted_old_chunks` 만큼 지워진다. */
  replaced: boolean;
  text_chars: number;
  articles: number;
  regulatory_articles: number;
  has_siting_provision: boolean;
  siting_signals: string[];
  chunks: number;
  deleted_old_chunks: number;
  ingested: boolean;
  warnings: string[];
}

/** `POST /regulation` 응답. `upload.py:491-506` */
export interface RegulationUploadResult {
  ok: boolean;
  domain: string;
  saved_to: string;
  facility_type: string;
  /** `request`(요청이 준 값) 또는 `audit_reviewed`(STEP1 확정본에서 읽음). */
  facility_type_source: string;
  law_files_total: number;
  files: RegulationReport[];
}

export function fetchRegulations(domain: string): Promise<RegulationItem[]> {
  const q = new URLSearchParams({ domain });
  return getJson<RegulationItem[]>(`${BASE}/regulations?${q.toString()}`);
}

/**
 * 조례 다중 업로드.
 *
 * 🔴 `facility_type` 을 **프런트가 지어내지 않는다.** 생략하면 서버가 STEP1
 *    확정본(`<도메인>_audit_result_reviewed.json`)에서 읽고, 그것도 없으면
 *    **400** 이다(`upload.py:208-215`). 이 값은 토론 단계 조례 검색 필터와
 *    정확히 일치해야 해서, 틀리면 안 터지고 **다른 시설 조례가 인용된다**.
 *    그래서 응답의 `facility_type_source` 를 화면에 남긴다.
 *
 * `ingest=false` 는 저장만 하고 벡터 DB 를 건너뛴다. 기본은 `true` 이고
 * 그때 적재 0건이면 서버가 **422** 로 거절한다(`upload.py:480-489`) —
 * "올렸는데 검색에 안 잡힘" 을 성공으로 보이지 않게 하려는 것이다.
 */
export function uploadRegulations(opts: {
  domain: string;
  files: File[];
  facilityType?: string;
  createDomain?: boolean;
  ingest?: boolean;
}): Promise<RegulationUploadResult> {
  const form = new FormData();
  form.set("domain", opts.domain);
  for (const f of opts.files) form.append("files", f);
  if (opts.facilityType) form.set("facility_type", opts.facilityType);
  if (opts.createDomain !== undefined) form.set("create_domain", String(opts.createDomain));
  if (opts.ingest !== undefined) form.set("ingest", String(opts.ingest));
  return postForm<RegulationUploadResult>(`${BASE}/regulation`, form);
}

/** `DELETE /regulations/{filename}` 응답. `upload.py:550-556` */
export interface RegulationDeleteResult {
  status: string;
  domain: string;
  filename: string;
  extract_cache_removed: boolean;
  vector_chunks_removed: number;
}

/**
 * 조례 삭제 — 파일 + 추출 캐시 + 벡터 청크를 함께 지운다.
 *
 * 🔴 파일명은 `encodeURIComponent` 로 감싼다. 한글·공백·`#` 이 들어간 조례
 *    파일명이 실재한다. 서버도 `urllib.parse.unquote` 로 되돌린다(`upload.py:519`).
 */
export function deleteRegulation(
  domain: string,
  filename: string,
): Promise<RegulationDeleteResult> {
  const q = new URLSearchParams({ domain });
  return deleteJson<RegulationDeleteResult>(
    `${BASE}/regulations/${encodeURIComponent(filename)}?${q.toString()}`,
  );
}

// ── 3. 데이터 ─────────────────────────────────────────────────────

/**
 * `dataset_id` 재번호 1건. `upload.py:643-647`.
 *
 * 🔴 **이게 이 화면에서 제일 중요한 값이다.** `dataset_id` 는 파일명 가나다순이라
 *    앞 번호로 파일 하나가 끼어들면 뒤 번호가 **전부 밀린다**. 이미 돌린
 *    감리 결과·정제 캐시의 번호와 어긋나고, 그러면 감리 결과가 **엉뚱한 파일에
 *    붙는다** — 안 터지고 값만 틀린다. 화면에서 접으면 안 된다.
 */
export interface Renumbered {
  dataset_id: string;
  /** 이 번호가 가리키던 파일. 새로 생긴 번호면 `null`(서버가 `.get` 으로 낸다). */
  before: string | null;
  after: string;
}

/** 데이터 파일 1건의 메타. `upload.py:628-638`(업로드) · `:715-733`(목록) */
export interface DataFile {
  filename: string;
  domain: string;
  ext: string;
  size: number;
  /** 업로드를 안 거치고 폴더에 직접 놓인 파일은 `null` 이다 — "모른다" 를 0 으로 채우지 않는다. */
  sha256: string | null;
  /** 부속 파일(.dbf 등)은 dataset 이 아니다. */
  is_dataset: boolean;
  uploaded_at?: string | null;
  /** 목록 응답에만 있다. `upload` | `preexisting`. */
  source?: string;
  /** 목록 응답에만 있다. 부속 파일이면 `null`. */
  dataset_id?: string | null;
  replaced?: boolean;
  path?: string;
}

/** `POST /data` 응답. `upload.py:661-675` */
export interface DataUploadResult {
  ok: boolean;
  domain: string;
  saved_to: string;
  files: DataFile[];
  dataset_count: number;
  /** `{"01": "파일명", ...}` — 현재 폴더 상태의 dataset_id 배치. */
  dataset_map: Record<string, string>;
  renumbered: Renumbered[];
  /** 재번호가 있을 때만 문자열. 없으면 `null`. */
  warning: string | null;
}

/** `GET /data` 응답. `upload.py:736-744` */
export interface DataListResult {
  domain: string;
  data_dir: string;
  dataset_count: number;
  dataset_map: Record<string, string>;
  redis_key: string;
  /**
   * Redis 색인에는 있었는데 디스크에 없어서 지운 항목.
   *
   * 서버는 매 조회마다 **디스크(정본) ↔ Redis(색인)** 를 대조하고 그 결과를
   * 숨기지 않는다(`upload.py:683-687`). 비어 있지 않으면 화면에도 남긴다 —
   * 색인만 보고 답하면 지워진 파일이 계속 있는 것처럼 보인다.
   */
  redis_stale_removed: string[];
  files: DataFile[];
}

export function fetchDataFiles(domain: string): Promise<DataListResult> {
  const q = new URLSearchParams({ domain });
  return getJson<DataListResult>(`${BASE}/data?${q.toString()}`);
}

/**
 * 감리용 데이터 다중 업로드.
 *
 * 🔴 `_`·`.` 로 시작하는 파일은 서버가 **400 으로 거절**한다 — 프로파일러가
 *    부속·숨김으로 보고 건너뛰기 때문이다(`upload.py:614-622`). 받아놓고
 *    안 쓰면 거짓말이라서 아예 안 받는다.
 *
 * `.shp` 는 `.dbf`·`.shx`·`.prj` 없이는 못 읽는다. 부속도 같은 호출에 함께
 * 넣을 수 있고, 부속은 `is_dataset: false` 로 온다.
 */
export function uploadDataFiles(opts: {
  domain: string;
  files: File[];
  createDomain?: boolean;
}): Promise<DataUploadResult> {
  const form = new FormData();
  form.set("domain", opts.domain);
  for (const f of opts.files) form.append("files", f);
  if (opts.createDomain !== undefined) form.set("create_domain", String(opts.createDomain));
  return postForm<DataUploadResult>(`${BASE}/data`, form);
}

/** `DELETE /data/{filename}` 응답. `upload.py:775-787` */
export interface DataDeleteResult {
  status: string;
  domain: string;
  filename: string;
  dataset_count: number;
  dataset_map: Record<string, string>;
  renumbered: Renumbered[];
  warning: string | null;
}

/** 데이터 삭제. 지운 뒤 **남은 파일의 번호가 어떻게 밀리는지**를 같이 받는다. */
export function deleteDataFile(
  domain: string,
  filename: string,
): Promise<DataDeleteResult> {
  const q = new URLSearchParams({ domain });
  return deleteJson<DataDeleteResult>(
    `${BASE}/data/${encodeURIComponent(filename)}?${q.toString()}`,
  );
}
