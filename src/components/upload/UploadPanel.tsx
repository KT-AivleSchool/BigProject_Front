"use client";

/**
 * 화면 1 업로드 패널 — 백엔드 2026-08-09 재작성판에 배선한다.
 * ===========================================================
 * 이 자리에 있던 것은 **장식이었다.** 점선 테두리 상자에 `onClick` 도
 * `<input type="file">` 도 없었고, 파일 하나도 서버로 가지 않았다. 화면은
 * "업로드할 수 있다" 고 말하고 있었으므로 원칙 4 위반이다.
 *
 * 배선 규칙
 *  · **도메인은 필수.** 7개 엔드포인트 전부가 요구한다. 목록을 먼저 받아
 *    고르게 하고, 없는 이름을 새로 만들려면 `create_domain` 을 **명시적으로**
 *    켜게 한다 — 오타 하나로 새 도메인이 조용히 생기면 안 된다.
 *  · **서버가 준 값을 그대로 보여준다.** `renumbered`·`warnings`·
 *    `facility_type_source`·`redis_stale_removed`·`saved_to` 는 서버가
 *    일부러 내보낸 것이다. 프런트에서 접으면 그걸 내보낸 이유가 사라진다.
 *  · **실패 문구를 지어내지 않는다.** `ApiError.detail` 을 그대로 쓴다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, NetworkError } from "@/lib/omnisite/client";
import {
  DATA_ACCEPT,
  LAW_ACCEPT,
  deleteDataFile,
  deleteRegulation,
  fetchDataFiles,
  fetchDomains,
  fetchRegulations,
  uploadDataFiles,
  uploadRegulations,
  type DataFile,
  type DataListResult,
  type DomainItem,
  type RegulationItem,
  type RegulationUploadResult,
  type Renumbered,
} from "@/lib/omnisite/upload";

type Tab = "data" | "law";

/** 서버 응답 중 **사용자가 반드시 봐야 하는 부분**만 추린 알림. 내용은 서버 것 그대로다. */
interface Notice {
  kind: "ok" | "warn" | "error";
  title: string;
  lines: string[];
  renumbered?: Renumbered[];
}

function describe(e: unknown): string {
  if (e instanceof ApiError) return `${e.status} — ${e.detail}`;
  if (e instanceof NetworkError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

/**
 * 실패 응답 안에 들어 있는 **파일별 처리 내역**을 꺼낸다.
 *
 * 🔴 실패했다고 아무 일도 안 일어난 게 아니다. `POST /upload/regulation` 은 파일을
 *    **먼저 저장하고** 벡터 적재를 시도한다 — 조문이 하나도 없으면 422 인데 그때도
 *    `law/` 에는 파일과 추출 `.txt` 가 남아 있다(계약: 응답 `detail.files[]`).
 *    「업로드 실패」 한 줄만 띄우면 사람은 아무것도 안 남았다고 읽고 다시 올린다.
 *    사유(예: 「조문(제N조)을 하나도 못 찾았습니다」)도 이 배열 안에만 있다.
 *
 * 모양이 다르면 **지어내지 않고** 빈 배열을 준다 — 그때는 `detail` 한 줄만 보인다.
 */
function partialLines(e: unknown): string[] {
  if (!(e instanceof ApiError)) return [];
  const d = (e.body as { detail?: unknown } | null)?.detail;
  if (typeof d !== "object" || d === null) return [];
  const { saved_to, files } = d as { saved_to?: unknown; files?: unknown };
  const out: string[] = [];
  if (typeof saved_to === "string") out.push(`저장 위치: ${saved_to} (파일은 남아 있습니다)`);
  if (!Array.isArray(files)) return out;
  for (const raw of files) {
    const f = raw as {
      filename?: unknown;
      text_chars?: unknown;
      articles?: unknown;
      chunks?: unknown;
      warnings?: unknown;
    };
    if (typeof f.filename !== "string") continue;
    out.push(
      `${f.filename} · 텍스트 ${Number(f.text_chars ?? 0)}자 · ` +
        `조문 ${Number(f.articles ?? 0)}개 · 청크 ${Number(f.chunks ?? 0)}개`,
    );
    if (Array.isArray(f.warnings)) {
      for (const w of f.warnings) out.push(`  ⚠ ${String(w)}`);
    }
  }
  return out;
}

/**
 * 「업로드 중」 뒤에 붙는 점을 `.` → `..` → `...` 로 돌린다.
 *
 * 🔴 **장식이 아니다.** 업로드는 한 번의 `fetch` 라 진행률을 낼 자리가 없고
 *    (`XMLHttpRequest` 가 아니면 `upload.onprogress` 가 없다), 큰 파일에서는
 *    수십 초 동안 화면이 완전히 정지한 것처럼 보인다 — 사람은 그걸 「멈췄다」로
 *    읽고 새로고침한다. 점이 도는 것은 **아직 살아 있다**는 유일한 신호다.
 *
 * ⚠ 점 개수가 진행률을 뜻하지 않는다. 남은 시간을 아는 척하지 않는다(원칙 4).
 */
function useDots(active: boolean): string {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (!active) return;
    // 🔴 여기서 `setN(1)` 로 초기화하지 않는다 — effect 안의 동기 setState 는
    //    `react-hooks/set-state-in-effect` 에 걸린다(이 파일 :96 과 같은 이유).
    //    시작 점 개수가 직전 값이어도 보이는 것은 똑같이 「돌고 있다」다.
    const t = setInterval(() => setN((v) => (v % 3) + 1), 400);
    return () => clearInterval(t);
  }, [active]);
  return ".".repeat(n);
}

function kb(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadPanel({
  domain,
  facilityType,
}: {
  /** 화면 1 의 "분석 도메인" 입력값. 비어 있으면 아무 호출도 하지 않는다. */
  domain: string;
  /**
   * 화면 1 의 "시설 유형" 입력값 → 조례 업로드의 `facility_type`.
   *
   * 🔴 비워두면 서버가 STEP1 감리 확정본에서 읽고, 그것도 없으면 **400** 이다.
   *    프런트가 기본값을 채우면 안 된다 — 이 값이 틀리면 안 터지고
   *    **다른 시설의 조례가 토론에 인용된다**(2026-08-09 실측: 흡연부스 토론
   *    상위 15건 중 4건이 전기차충전소 조례였다).
   */
  facilityType: string;
}) {
  const [tab, setTab] = useState<Tab>("data");
  const [domains, setDomains] = useState<DomainItem[] | null>(null);
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [createDomain, setCreateDomain] = useState(false);
  const [ingest, setIngest] = useState(true);
  /**
   * 조례 업로드용 시설 유형 — **이 패널이 직접 묻는다.**
   *
   * 🔴 부모(`facilityType` prop)의 「시설 유형」 칸은 화면1 **Step 2** 에 있는데 이
   *    패널은 **Step 1** 에 있다. 그래서 조례를 올리는 시점에는 그 값이 **항상 빈
   *    문자열**이고, 새 도메인은 STEP1 감리도 없어 서버가 되짚을 데가 없다 →
   *    `POST /upload/regulations` 가 **무조건 400** 이었다(2026-08-13, '그늘막' 실측).
   *    필요한 값을 **필요한 자리에서** 받는다.
   *
   * 🔴 기본값을 넣지 않는다. 도메인 이름이 곧 시설명이라고 가정하면('그늘막' →
   *    "그늘막") 대개 맞아서 **틀렸을 때 안 걸린다** — 이 값은 토론 단계의 조례
   *    검색 필터와 정확히 일치해야 하고, 어긋나면 다른 시설의 조례가 인용된다.
   */
  const [facilityInput, setFacilityInput] = useState("");

  const [busy, setBusy] = useState(false);
  const dots = useDots(busy);
  const [notice, setNotice] = useState<Notice | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File[]>([]);

  const trimmed = domain.trim();
  /**
   * 🔴 **업로드 루트의 행만** 고른다(백엔드 2026-08-14 루트 분리).
   *    목록은 두 루트를 합쳐서 오는데(`?root=all`), 프리셋 행은 업로드·삭제가
   *    **경로상 닿지 않는** 폴더다. 이름만 보고 「있는 도메인」으로 치면
   *    `create_domain` 칸이 안 뜨고 → `create_domain=false` 로 올라가 →
   *    서버가 `datasets/user_input/<도메인>` 을 못 찾아 **400** 이다.
   *    안 터지는 게 아니라 **왜 400 인지 화면에 아무 단서가 없는** 게 문제다.
   * ⚠ `root` 가 **없으면**(루트 분리 전 서버) 예전처럼 친다 — 없는 필드를
   *   `"preset"` 으로 채우면 옛 서버에서 모든 도메인이 「없는 도메인」이 된다.
   */
  const entry = domains?.find((d) => d.domain === trimmed && d.root !== "preset") ?? null;
  /**
   * 같은 이름의 **프리셋 행**. 서버는 이름이 겹치면 업로드 행만 주므로
   * 이 값이 있다는 건 **업로드 폴더가 아직 없다**는 뜻이다 → `create_domain` 흐름.
   */
  const presetEntry = domains?.find((d) => d.domain === trimmed && d.root === "preset") ?? null;
  const known = entry !== null;

  /** 이 패널이 받은 값이 먼저다. 부모 칸(Step 2)은 이미 채워져 있을 때만 거든다. */
  const effectiveFacility = facilityInput.trim() || facilityType.trim();
  /**
   * 서버가 되짚을 데(STEP1 감리 확정본)도 없고 값도 안 왔으면 **400 이 확정**이다.
   * 왕복하기 전에 막고 **이유를 적는다** — 그냥 비활성화만 하면 왜 못 누르는지 안 보인다.
   *
   * ⚠ `has_audit_reviewed` 를 못 얻었으면(`entry === null`: 목록 로딩 실패·새 도메인)
   *   막는 쪽으로 친다. 서버가 되짚을 수 있는지 모르는 채로 보내면 400 을 받는다.
   */
  const facilityMissing = tab === "law" && !effectiveFacility && !entry?.has_audit_reviewed;

  // ── 도메인 목록 ─────────────────────────────────────────────
  /**
   * 🔴 **`async/await` 가 아니라 `.then()/.catch()` 다.**
   *    `react-hooks/set-state-in-effect` 는 **await 뒤도 동기로 친다** — effect 에서
   *    부르는 async 함수 안이면 첫 await 뒤에 있어도 걸린다(실측). 규칙이 받아주는
   *    모양은 **콜백 안의 setState** 뿐이다. 반환값은 그대로 Promise 라 업로드·삭제
   *    뒤의 `await loadDomains()` 는 안 바뀐다.
   */
  const loadDomains = useCallback(
    () =>
      fetchDomains()
        .then((list) => {
          setDomains(list);
          setDomainsError(null);
        })
        .catch((e: unknown) => {
          setDomains(null);
          setDomainsError(describe(e));
        }),
    [],
  );

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  // ── 현재 도메인의 파일 목록 ──────────────────────────────────
  /**
   * 🔴 「불러오는 중」을 **상태로 두지 않는다.** `setListLoading(true)` 는 effect 에서
   *    동기로 불릴 수밖에 없어 같은 규칙에 걸리고, 규칙 문제만도 아니다 — setState 는
   *    렌더가 끝난 뒤 도착하므로 탭·도메인이 바뀐 직후 한 프레임 동안 **직전 목록이
   *    남는다**(`useArtifact.ts` :79 · `useSelectedSite.ts` 가 같은 이유로 먼저 이
   *    모양이 됐다).
   *
   *    `listKey` 는 「무엇을 물었나」다. 저장된 답의 key 가 지금 key 와 다르면 그건
   *    **남의 답**이므로 안 내보내고 「불러오는 중」으로 친다. `listNonce` 는 사람이
   *    「새로고침」을 누른 횟수다 — 같은 것을 다시 묻는 유일한 길이다.
   */
  const [listNonce, setListNonce] = useState(0);
  const listKey = trimmed ? `${trimmed}::${tab}::${listNonce}` : null;

  const [listAnswer, setListAnswer] = useState<{
    key: string | null;
    dataList: DataListResult | null;
    lawList: RegulationItem[] | null;
    error: string | null;
  }>({ key: null, dataList: null, lawList: null, error: null });

  /** 🔴 위 `loadDomains` 와 같은 이유로 `.then()/.catch()` 다. */
  const loadList = useCallback((): Promise<void> => {
    if (!listKey) return Promise.resolve();
    const asked =
      tab === "data"
        ? fetchDataFiles(trimmed).then((r) =>
            setListAnswer({ key: listKey, dataList: r, lawList: null, error: null }),
          )
        : fetchRegulations(trimmed).then((r) =>
            setListAnswer({ key: listKey, dataList: null, lawList: r, error: null }),
          );
    return asked.catch((e: unknown) => {
      // 400 = 아직 없는 도메인. 이건 오류가 아니라 "만들어야 한다" 는 안내다.
      setListAnswer({ key: listKey, dataList: null, lawList: null, error: describe(e) });
    });
  }, [listKey, trimmed, tab]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // 렌더 중에 계산한다. `listKey` 가 없으면(도메인 비었음) 아무것도 안 물었으므로 대기도 아니다.
  const listFresh = listAnswer.key === listKey;
  const dataList = listFresh ? listAnswer.dataList : null;
  const lawList = listFresh ? listAnswer.lawList : null;
  const listError = listFresh ? listAnswer.error : null;
  const listLoading = listKey !== null && !listFresh;

  function resetPicked() {
    setPicked([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── 업로드 ──────────────────────────────────────────────────
  async function onUpload() {
    if (!trimmed || picked.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      if (tab === "data") {
        const r = await uploadDataFiles({
          domain: trimmed,
          files: picked,
          createDomain,
        });
        const lines = [
          `저장 위치: ${r.saved_to}`,
          `dataset 총 ${r.dataset_count}개`,
          ...r.files.map(
            (f) =>
              `${f.filename} · ${kb(f.size)}` +
              (f.replaced ? " · 덮어씀" : "") +
              (f.is_dataset ? "" : " · 부속 파일(dataset 아님)"),
          ),
        ];
        if (r.warning) lines.push(r.warning);
        setNotice({
          kind: r.renumbered.length > 0 ? "warn" : "ok",
          title: `데이터 ${r.files.length}개 업로드 완료`,
          lines,
          renumbered: r.renumbered,
        });
      } else {
        const r: RegulationUploadResult = await uploadRegulations({
          domain: trimmed,
          files: picked,
          facilityType: effectiveFacility || undefined,
          createDomain,
          ingest,
        });
        const lines = [
          `저장 위치: ${r.saved_to}`,
          `시설 종류 태깅: ${r.facility_type} (출처 ${r.facility_type_source})`,
          `조례 파일 총 ${r.law_files_total}개`,
        ];
        for (const f of r.files) {
          lines.push(
            `${f.filename} · ${kb(f.size)} · 조문 ${f.articles}개(규제 ${f.regulatory_articles}) · ` +
              `청크 ${f.chunks}개` +
              (f.deleted_old_chunks > 0 ? ` (옛 청크 ${f.deleted_old_chunks}개 삭제)` : "") +
              (f.ingested ? "" : " · 🔴 벡터 DB 미적재") +
              (f.has_siting_provision ? ` · 입지규정 감지: ${f.siting_signals.join(", ")}` : ""),
          );
          for (const w of f.warnings) lines.push(`  ⚠ ${f.filename}: ${w}`);
        }
        const anyWarn = r.files.some((f) => f.warnings.length > 0 || !f.ingested);
        setNotice({
          kind: anyWarn ? "warn" : "ok",
          title: `조례 ${r.files.length}개 업로드 완료`,
          lines,
        });
      }
      resetPicked();
      await Promise.all([loadList(), loadDomains()]);
    } catch (e) {
      const extra = partialLines(e);
      setNotice({
        kind: "error",
        title: extra.length > 0 ? "업로드 실패 — 일부는 적용됐습니다" : "업로드 실패",
        lines: [describe(e), ...extra],
      });
      // 🔴 실패해도 목록을 다시 읽는다. 저장은 됐는데 화면만 「0개」로 남으면
      //    사람은 같은 파일을 또 올린다.
      await Promise.all([loadList(), loadDomains()]);
    } finally {
      setBusy(false);
    }
  }

  // ── 삭제 ────────────────────────────────────────────────────
  async function onDelete(filename: string) {
    if (!trimmed) return;
    setBusy(true);
    setNotice(null);
    try {
      if (tab === "data") {
        const r = await deleteDataFile(trimmed, filename);
        const lines = [`dataset 총 ${r.dataset_count}개`];
        if (r.warning) lines.push(r.warning);
        setNotice({
          kind: r.renumbered.length > 0 ? "warn" : "ok",
          title: `삭제: ${r.filename}`,
          lines,
          renumbered: r.renumbered,
        });
      } else {
        const r = await deleteRegulation(trimmed, filename);
        setNotice({
          kind: "ok",
          title: `삭제: ${r.filename}`,
          lines: [
            `추출 캐시 ${r.extract_cache_removed ? "삭제됨" : "없음"}`,
            `벡터 청크 ${r.vector_chunks_removed}개 삭제`,
          ],
        });
      }
      await Promise.all([loadList(), loadDomains()]);
    } catch (e) {
      setNotice({ kind: "error", title: "삭제 실패", lines: [describe(e)] });
    } finally {
      setBusy(false);
    }
  }

  const accept = tab === "data" ? DATA_ACCEPT : LAW_ACCEPT;

  return (
    <div className="p-8">
      {/* ── 탭 ── */}
      <div className="flex gap-2 p-1 rounded-xl bg-gray-100/80 max-w-sm mb-6">
        {(
          [
            ["data", "📊 분석 데이터"],
            ["law", "📄 조례·법규"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
              resetPicked();
              setNotice(null);
            }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 도메인 상태 ── */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm">
        {!trimmed ? (
          <p className="text-gray-600">
            위 <strong>분석 도메인</strong>을 먼저 입력하세요. 업로드 API 7개는 전부 도메인이
            필수입니다 — 도메인이 없으면 어느 파이프라인의 입력인지 정할 수 없습니다.
          </p>
        ) : domainsError ? (
          <p className="text-red-700 font-mono text-xs break-all">
            도메인 목록을 못 받았습니다: {domainsError}
          </p>
        ) : known ? (
          <div className="flex flex-col gap-2">
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">{trimmed}</span> — 조례{" "}
              {entry?.law_files ?? 0}개 · 데이터 {entry?.data_files ?? 0}개
            </p>
            {/*
              🔴 **고르기 전에** 말한다. 이름을 맞춰서 들어오면 그 폴더의 배포 원본이
                 아래 목록에 뜨는데, 그게 「내가 올린 것」으로 읽혀 실제로 지워졌다
                 (2026-08-13 — `datasets/흡연/data`). 개수는 서버가 원장과 대조해 센
                 값(`preexisting_files`)을 그대로 적는다.

              🔴 **루트 분리 뒤로 이 값의 뜻이 갈렸다**(백엔드 2026-08-14).
                 업로드 행에서는 이제 「배포 원본」이 아니다 — 배포 원본은 다른 폴더
                 (`datasets/<도메인>`)로 나갔고, 여기 남는 건 **내 원장에 없는 파일**
                 (다른 세션이 올렸거나 원장 30일이 지난 것)이다. 옛 문구를 그대로 두면
                 없는 사실을 말하게 된다. `root` 를 **모르면**(옛 서버) 옛 문구가 맞다.
            */}
            {(entry?.preexisting_files ?? 0) > 0 &&
              (entry?.root === "upload" ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  이 업로드 폴더에는 <strong>내 기록에 없는 파일 {entry?.preexisting_files}개</strong>
                  가 있습니다 — 다른 세션이 올렸거나 업로드 기록이 만료된 것입니다.
                  아래 목록에 같이 보이고, 지우려 하면 <strong>서버가 한 번 되묻습니다.</strong>
                </p>
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  이 도메인에는 <strong>배포 원본 {entry?.preexisting_files}개</strong>가 이미
                  있습니다 — 프리셋 모드가 읽는 파일입니다. 아래 목록에 같이 보이지만
                  <strong> 지울 수 없습니다.</strong> 내 데이터로만 분석하려면 다른 도메인
                  이름을 쓰세요.
                </p>
              ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/*
              🔴 프리셋 이름을 친 경우와 아예 없는 이름을 친 경우는 **다른 상황**이다.
                 앞은 「배포 원본이 같은 이름으로 있다」이고, 올리면 **별개 폴더**가
                 새로 생긴다(같은 폴더에 덧붙이는 게 아니다). 이 말을 안 하면
                 사용자는 배포 데이터에 내 파일을 얹었다고 믿는다.
            */}
            {presetEntry ? (
              <p className="text-amber-800">
                <span className="font-semibold">{trimmed}</span> 은 <strong>배포 원본</strong>으로만
                있는 이름입니다(조례 {presetEntry.law_files}개 · 데이터 {presetEntry.data_files}개).
                배포 원본 폴더에는 올릴 수 없습니다 — 아래를 켜면 <strong>같은 이름의 별개
                업로드 폴더</strong>가 새로 만들어지고, 올린 파일은 배포 원본과 섞이지 않습니다.
              </p>
            ) : (
              <p className="text-amber-800">
                <span className="font-semibold">{trimmed}</span> 은 서버에 없는 도메인입니다.
                {domains && domains.length > 0 && (
                  <>
                    {" "}
                    현재 업로드 도메인:{" "}
                    {domains
                      .filter((d) => d.root !== "preset")
                      .map((d) => d.domain)
                      .join(", ") || "없음"}
                  </>
                )}
              </p>
            )}
            <label className="flex items-center gap-2 text-gray-700">
              <input
                type="checkbox"
                checked={createDomain}
                onChange={(e) => setCreateDomain(e.target.checked)}
              />
              {presetEntry
                ? "같은 이름의 업로드 폴더를 새로 만들고 올린다"
                : "새 도메인 폴더를 만들고 올린다"}{" "}
              (<code className="font-mono text-xs">create_domain</code>)
            </label>
          </div>
        )}
      </div>

      {/* ── 파일 선택 ── */}
      <label
        className={`block w-full rounded-xl border-2 border-dashed py-12 px-6 text-center transition-colors ${
          trimmed
            ? "border-gray-300 bg-gray-50/50 hover:bg-gray-50 hover:border-blue-400 cursor-pointer"
            : "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={accept}
          disabled={!trimmed || busy}
          className="sr-only"
          onChange={(e) => setPicked(Array.from(e.target.files ?? []))}
        />
        <div className="w-14 h-14 mx-auto bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center mb-3">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-800">클릭하여 파일 선택 (여러 개 가능)</h3>
        <p className="text-sm text-gray-500 mt-2 max-w-lg mx-auto leading-relaxed">
          {tab === "data" ? (
            <>
              업로드 가능 형식: <code className="font-mono text-xs">{DATA_ACCEPT}</code>
              <br />
              <span className="text-gray-400">
                공간 정보 파일(.shp)을 올리실 때는 반드시 관련된 부속 파일들(.dbf, .shx, .prj)도 같이 선택해서 올려주세요.
              </span>
            </>
          ) : (
            <>
              업로드 가능 형식: <code className="font-mono text-xs">{LAW_ACCEPT}</code>
              <br />
              <span className="text-gray-400">
                일반 한글 문서(.hwp)나 워드(.doc)는 시스템에서 분석하기 어렵습니다. 번거로우시더라도 최신 한글 문서(.hwpx)나 PDF 형식으로 변환하여 올려주세요.
              </span>
            </>
          )}
        </p>
      </label>

      {/* ── 선택된 파일 + 업로드 버튼 ── */}
      {picked.length > 0 && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <ul className="text-sm text-gray-700 space-y-1">
            {picked.map((f) => (
              <li key={f.name} className="flex justify-between gap-4">
                <span className="truncate font-mono text-xs">{f.name}</span>
                <span className="shrink-0 text-gray-500">{kb(f.size)}</span>
              </li>
            ))}
          </ul>
          {/* 합계를 미리 보여준다 — 왜 오래 걸리는지는 누른 뒤가 아니라 누르기 전에 알아야 한다. */}
          {picked.length > 1 && (
            <p className="mt-2 border-t border-blue-200 pt-2 text-right text-xs text-gray-500">
              합계 {kb(picked.reduce((s, f) => s + f.size, 0))}
            </p>
          )}
          {tab === "law" && (
            <>
              {/* 🔴 조례는 **시설 종류로 태깅**되어 저장되고, 토론 단계의 조례 검색이 그
                  태그로 거른다. 서버는 이 값을 추측하지 않는다(추측하면 다른 시설의
                  조례가 인용되는데 예외가 안 난다) — 그래서 여기서 받는다. */}
              <label className="mt-3 block text-sm text-gray-700">
                <span className="font-medium">
                  시설 유형
                  {facilityMissing ? (
                    <span className="ml-1 text-red-600">*</span>
                  ) : (
                    <span className="ml-1 text-gray-400">(선택)</span>
                  )}
                </span>
                <input
                  type="text"
                  value={facilityInput}
                  onChange={(e) => setFacilityInput(e.target.value)}
                  placeholder={facilityType.trim() || "예) 흡연부스 · 재활용정거장 · 그늘막"}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                    facilityMissing ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                />
                <span className="mt-1 block text-xs text-gray-500">
                  {entry?.has_audit_reviewed
                    ? "비우면 STEP1 감리 확정본의 값을 씁니다."
                    : "이 도메인은 STEP1 감리가 아직 없어 서버가 되짚을 데가 없습니다 — 직접 적어주세요."}
                  {" 토론 단계의 조례 검색 필터와 "}
                  <strong>정확히 같은 낱말</strong>이어야 합니다.
                </span>
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={ingest}
                  onChange={(e) => setIngest(e.target.checked)}
                />
                벡터 DB(<code className="font-mono text-xs">statutes_collection</code>)에 적재
                <span className="text-gray-400">— 끄면 파일만 저장되고 토론이 못 찾습니다</span>
              </label>
            </>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onUpload}
              disabled={busy || facilityMissing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  업로드 중
                  {/* 점이 늘었다 줄었다 해도 버튼 폭은 그대로여야 한다 — 폭이 흔들리면
                      옆 버튼이 같이 움직여서 「뭔가 잘못됐다」로 읽힌다. */}
                  <span className="inline-block w-4 text-left tabular-nums">{dots}</span>
                </>
              ) : (
                `${picked.length}개 업로드`
              )}
            </button>
            <button
              type="button"
              onClick={resetPicked}
              disabled={busy}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              선택 해제
            </button>
          </div>
          {/* 막힌 이유를 적는다 — 비활성 버튼만 두면 「고장」으로 읽힌다. */}
          {facilityMissing && (
            <p className="mt-2 text-xs text-red-700">
              시설 유형을 적어야 올릴 수 있습니다. 지금 보내면 서버가 400 으로 거절합니다 —
              태그 없이 저장하면 다른 시설의 조례가 토론에 인용됩니다.
            </p>
          )}
        </div>
      )}

      {/* ── 서버 응답 ── */}
      {notice && (
        <div
          className={`mt-4 rounded-xl border p-4 text-sm ${
            notice.kind === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : notice.kind === "warn"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-green-200 bg-green-50 text-green-900"
          }`}
        >
          <p className="font-bold">{notice.title}</p>
          <ul className="mt-2 space-y-0.5 font-mono text-xs break-all">
            {notice.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          {notice.renumbered && notice.renumbered.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-400 bg-white/70 p-3">
              <p className="font-bold text-amber-900">
                🔴 dataset_id 가 밀렸습니다 ({notice.renumbered.length}건)
              </p>
              <p className="mt-1 text-[13px] text-amber-800">
                dataset_id 는 파일명 가나다순입니다. 이미 감리·정제를 돌렸다면 그 결과가
                <strong> 엉뚱한 파일에 붙습니다</strong> — 재프로파일 → 재감리가 필요합니다.
              </p>
              <ul className="mt-2 font-mono text-xs text-amber-900 space-y-0.5">
                {notice.renumbered.map((r) => (
                  <li key={r.dataset_id}>
                    {r.dataset_id}: {r.before ?? "(없음)"} → {r.after}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── 현재 목록 ── */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-800">
            {tab === "data" ? "업로드된 데이터" : "업로드된 조례"}

          </h4>
          <button
            type="button"
            // 🔴 `loadList()` 를 직접 부르지 않는다 — key 가 그대로라 「불러오는 중」이
            //    안 뜬다. 조례 목록은 매번 약 130초라 그 표시가 없으면 눌러도
            //    아무 일도 안 일어난 것처럼 보인다.
            onClick={() => setListNonce((n) => n + 1)}
            disabled={!trimmed || busy}
            className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40"
          >
            새로고침
          </button>
        </div>

        {listLoading ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            불러오는 중...
            {tab === "law" && (
              <span className="mt-1 block text-xs text-gray-400">
                🔴 멈춘 게 아니라 <strong>매번 약 130초</strong> 걸립니다(2026-08-10
                실측, 2회 연속 130.04s). 조례 목록은 벡터 DB 청크 수를 같이 세는데
                백엔드 DSN 호스트가 <code className="font-mono">localhost</code> 라
                IPv6(<code className="font-mono">::1</code>)를 먼저 시도하고 그 타임아웃을
                다 기다린 뒤 IPv4 로 붙습니다. 백엔드 쪽 설정 문제로 전달했습니다.
              </span>
            )}
          </p>
        ) : listError ? (
          <div className="flex flex-col gap-2">
            {/*
              🔴 프리셋 이름이면 이 400 은 고장이 아니라 **구조**다 — 파일 목록
                 엔드포인트도 업로드 루트만 본다(`upload.py:692`·`:1160` → `_dirs()`).
                 사유를 안 적으면 「목록이 깨졌다」로 읽힌다. 상태 코드는 화면에
                 안 쓴다 — 서버 문구는 아래 원문에 그대로 남는다.
            */}
            {presetEntry && (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <strong>{trimmed}</strong> 은 배포 원본 폴더에만 있는 이름입니다. 파일 목록은
                내가 올린 폴더만 보여 줍니다 — 배포 원본은 여기서 열람·삭제되지 않습니다.
              </p>
            )}
            <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-600 break-all">
              {listError}
            </p>
          </div>
        ) : tab === "data" ? (
          <DataTable list={dataList} busy={busy} onDelete={onDelete} />
        ) : (
          <LawTable items={lawList} busy={busy} onDelete={onDelete} />
        )}
      </div>
    </div>
  );
}

/**
 * 삭제 버튼 한 칸.
 *
 * 🔴 **판정을 프런트가 다시 하지 않는다.** 서버가 준 `deletable` 만 본다 —
 *    「업로드 원장에 있나」는 디스크(`datasets/<도메인>/.upload_ledger.json`)가
 *    정본이고, 그 규칙을 화면이 흉내 내면 서버와 갈라진다. 값이 없는 옛 응답
 *    (`undefined`)은 예전처럼 지울 수 있게 둔다 — 서버가 `force` 없이 409 로
 *    막으므로 화면이 앞서 막을 필요가 없다.
 *
 * 🔴 **숨기지 않고 비활성화한다.** 버튼이 사라지면 「왜 못 지우나」가 화면에서
 *    사라진다 — 이 파일이 실제로 지워져서 프리셋 모드가 죽었던 사고다(2026-08-13).
 */
function DeleteCell({
  filename,
  deletable,
  busy,
  onDelete,
}: {
  filename: string;
  deletable: boolean | undefined;
  busy: boolean;
  onDelete: (f: string) => void;
}) {
  const blocked = deletable === false;
  return (
    <button
      type="button"
      onClick={() => onDelete(filename)}
      disabled={busy || blocked}
      title={
        blocked
          ? "이 폴더에 원래 있던 배포 원본입니다. 프리셋 모드가 읽으므로 여기서 지울 수 없습니다."
          : undefined
      }
      className={
        blocked
          ? "shrink-0 rounded px-2 py-1 text-xs text-gray-300 cursor-not-allowed"
          : "shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
      }
    >
      삭제
    </button>
  );
}

function DataTable({
  list,
  busy,
  onDelete,
}: {
  list: DataListResult | null;
  busy: boolean;
  onDelete: (f: string) => void;
}) {
  if (!list) return <Empty />;
  if (list.files.length === 0) return <Empty />;
  return (
    <>
      {list.redis_stale_removed.length > 0 && (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          Redis 색인에만 남아 있던 {list.redis_stale_removed.length}건을 정리했습니다:{" "}
          <span className="font-mono">{list.redis_stale_removed.join(", ")}</span>
        </p>
      )}
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {list.files.map((f: DataFile) => (
          <li key={f.filename} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-8 shrink-0 font-mono text-xs text-blue-700">
              {f.dataset_id ?? "—"}
            </span>
            <span className="flex-1 truncate font-mono text-xs text-gray-800">{f.filename}</span>
            <span className="shrink-0 text-xs text-gray-500">{kb(f.size)}</span>
            <span
              className={`w-28 shrink-0 text-right text-xs ${
                f.deletable === false ? "text-amber-700" : "text-gray-400"
              }`}
            >
              {f.deletable === false ? "배포 원본(프리셋용)" : "업로드"}
            </span>
            <DeleteCell filename={f.filename} deletable={f.deletable} busy={busy} onDelete={onDelete} />
          </li>
        ))}
      </ul>

    </>
  );
}

function LawTable({
  items,
  busy,
  onDelete,
}: {
  items: RegulationItem[] | null;
  busy: boolean;
  onDelete: (f: string) => void;
}) {
  if (!items || items.length === 0) return <Empty />;
  return (
    <>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {items.map((f) => (
          <li key={f.filename} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex-1 truncate font-mono text-xs text-gray-800">{f.filename}</span>
            <span className="shrink-0 text-xs text-gray-500">{kb(f.size)}</span>
            <span
              className={`w-24 shrink-0 text-right text-xs ${
                f.text_ready ? "text-gray-400" : "text-amber-700 font-semibold"
              }`}
            >
              {f.text_ready ? "텍스트 준비됨" : "텍스트 없음"}
            </span>
            <span className="w-20 shrink-0 text-right text-xs text-gray-500">
              청크 {f.chunks_in_vector_db}
            </span>
            <span
              className={`w-28 shrink-0 text-right text-xs ${
                f.deletable === false ? "text-amber-700" : "text-gray-400"
              }`}
            >
              {f.deletable === false ? "배포 원본(프리셋용)" : "업로드"}
            </span>
            <DeleteCell filename={f.filename} deletable={f.deletable} busy={busy} onDelete={onDelete} />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-400">
        &ldquo;텍스트 없음&rdquo;은 파일은 저장됐지만 STEP1 감리가 못 읽는다는 뜻입니다(스캔본 PDF 등).
        청크 0 이면 토론 단계 조례 검색에도 안 잡힙니다.
      </p>
    </>
  );
}

function Empty() {
  return (
    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 text-center text-sm text-gray-400">
      아직 없습니다.
    </p>
  );
}
