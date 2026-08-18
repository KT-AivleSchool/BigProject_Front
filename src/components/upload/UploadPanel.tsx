"use client";

/**
 * OmniSite 화면 1 업로드 패널 컴포넌트
 * ===========================================================
 * 구조:
 *  1. Imports (상단)
 *  2. Types & File-scoped Helper Functions (중단)
 *  3. UploadPanel 메인 컴포넌트 (상태, 훅, 핸들러, return JSX)
 *  4. 서브 서식/테이블 컴포넌트 (하단)
 */

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
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
  type RegulationItem,
  type RegulationUploadResult,
  type Renumbered,
} from "@/lib/omnisite/upload";

// ─────────────────────────────────────────────────────────────
// 1. Types & Helper Functions
// ─────────────────────────────────────────────────────────────

type Tab = "data" | "law";

interface Notice {
  kind: "ok" | "warn" | "error";
  title: string;
  lines: string[];
  renumbered?: Renumbered[];
}

export interface UploadPanelHandle {
  commit: () => Promise<string | null>;
}

function describe(e: unknown): string {
  if (e instanceof ApiError) return `${e.status} — ${e.detail}`;
  if (e instanceof NetworkError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

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

function useDots(active: boolean): string {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setN((v) => (v % 3) + 1), 400);
    return () => clearInterval(t);
  }, [active]);
  return ".".repeat(n);
}

async function resolveDomain(base: string): Promise<string> {
  const taken = new Set((await fetchDomains()).map((d) => d.domain));
  if (!taken.has(base)) return base;
  for (let n = 2; n <= 999; n++) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`${base} 부터 ${base}_999 까지 전부 쓰이고 있습니다. 다른 이름을 쓰세요.`);
}

function kb(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────
// 2. UploadPanel Main Component
// ─────────────────────────────────────────────────────────────

export function UploadPanel({
  domain,
  facilityType,
  ref,
}: {
  domain: string;
  facilityType: string;
  ref?: Ref<UploadPanelHandle>;
}) {
  // ── State Variables & Hooks ──
  const [tab, setTab] = useState<Tab>("data");
  const [ingest, setIngest] = useState(true);
  const [facilityInput, setFacilityInput] = useState("");
  const [saved, setSaved] = useState<{ base: string; actual: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dots = useDots(busy);
  const [notice, setNotice] = useState<Notice | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [listNonce, setListNonce] = useState(0);

  const trimmed = domain.trim();
  const savedDomain = saved && saved.base === trimmed ? saved.actual : null;
  const effectiveFacility = facilityInput.trim() || facilityType.trim();
  const facilityMissing = tab === "law" && !effectiveFacility;

  const listKey = savedDomain ? `${savedDomain}::${tab}::${listNonce}` : null;

  const [listAnswer, setListAnswer] = useState<{
    key: string | null;
    dataList: DataListResult | null;
    lawList: RegulationItem[] | null;
    error: string | null;
  }>({ key: null, dataList: null, lawList: null, error: null });

  // ── Callback & Handler Methods ──
  const loadList = useCallback((): Promise<void> => {
    if (!listKey || !savedDomain) return Promise.resolve();
    const asked =
      tab === "data"
        ? fetchDataFiles(savedDomain).then((r) =>
            setListAnswer({ key: listKey, dataList: r, lawList: null, error: null }),
          )
        : fetchRegulations(savedDomain).then((r) =>
            setListAnswer({ key: listKey, dataList: null, lawList: r, error: null }),
          );
    return asked.catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 400) {
        setListAnswer({ key: listKey, dataList: null, lawList: null, error: null });
        return;
      }
      setListAnswer({ key: listKey, dataList: null, lawList: null, error: describe(e) });
    });
  }, [listKey, savedDomain, tab]);

  useEffect(() => {
    if (!listKey) return;
    void loadList();
  }, [listKey, loadList]);

  const listFresh = listAnswer.key === listKey;
  const dataList = listFresh ? listAnswer.dataList : null;
  const lawList = listFresh ? listAnswer.lawList : null;
  const listError = listFresh ? listAnswer.error : null;
  const listLoading = listKey !== null && !listFresh;

  function resetPicked() {
    setPicked([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onUpload(stay: boolean): Promise<string | null> {
    if (!trimmed) return null;
    if (picked.length === 0) return savedDomain ?? trimmed;
    if (facilityMissing) {
      setNotice({
        kind: "error",
        title: "시설 유형을 먼저 입력하세요",
        lines: ["조례 업로드는 `facility_type` 이 필요합니다. 비워 두면 서버가 400 으로 거절합니다."],
      });
      return null;
    }
    setBusy(true);
    setNotice(null);
    let target = savedDomain;
    try {
      if (target === null) {
        target = await resolveDomain(trimmed);
        setSaved({ base: trimmed, actual: target });
      }
      if (tab === "data") {
        const r = await uploadDataFiles({
          domain: target,
          files: picked,
          createDomain: true,
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
          domain: target,
          files: picked,
          facilityType: effectiveFacility || undefined,
          createDomain: true,
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
      if (stay) setListNonce((n) => n + 1);
      return target;
    } catch (e) {
      const extra = partialLines(e);
      setNotice({
        kind: "error",
        title: extra.length > 0 ? "업로드 실패 — 일부는 적용됐습니다" : "업로드 실패",
        lines: [describe(e), ...extra],
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  const commit = useCallback(() => onUpload(false), [trimmed, picked, facilityMissing, savedDomain, tab, effectiveFacility, ingest]);

  useImperativeHandle(ref, () => ({ commit }), [commit]);

  async function onDelete(filename: string) {
    if (!savedDomain) return;
    setBusy(true);
    setNotice(null);
    try {
      if (tab === "data") {
        const r = await deleteDataFile(savedDomain, filename);
        setNotice({
          kind: r.renumbered.length > 0 ? "warn" : "ok",
          title: `데이터 '${filename}' 삭제 완료`,
          lines: [
            `dataset 총 ${r.dataset_count}개 남음`,
            ...(r.redis_stale_removed && r.redis_stale_removed.length > 0
              ? [`Redis 색인만 남아 있던 ${r.redis_stale_removed.length}건 함께 정리`]
              : []),
          ],
          renumbered: r.renumbered,
        });
      } else {
        const r = await deleteRegulation(savedDomain, filename);
        setNotice({
          kind: "ok",
          title: `조례 '${filename}' 삭제 완료`,
          lines: [
            `추출 캐시 ${r.extract_cache_removed ? "삭제됨" : "없음"}`,
            `벡터 청크 ${r.vector_chunks_removed}개 삭제`,
          ],
        });
      }
      setListNonce((n) => n + 1);
    } catch (e) {
      setNotice({ kind: "error", title: "삭제 실패", lines: [describe(e)] });
    } finally {
      setBusy(false);
    }
  }

  const accept = tab === "data" ? DATA_ACCEPT : LAW_ACCEPT;

  // ── 3. JSX Return Statement ──
  return (
    <div className="p-8">
      {/* 탭 선택 */}
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

      {!trimmed && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm">
          <p className="text-gray-600">
            위 <strong>분석 주제</strong>를 먼저 입력하세요. 업로드 API 는 전부 도메인이 필수입니다.
          </p>
        </div>
      )}

      {/* 파일 선택 드롭존 */}
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

      {/* 선택된 파일 및 실행 제어 */}
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
          {picked.length > 1 && (
            <p className="mt-2 border-t border-blue-200 pt-2 text-right text-xs text-gray-500">
              합계 {kb(picked.reduce((s, f) => s + f.size, 0))}
            </p>
          )}
          {tab === "law" && (
            <>
              <label className="mt-3 block text-sm text-gray-700">
                <span className="font-medium">
                  시설 유형<span className="ml-1 text-red-600">*</span>
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
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={ingest}
                  onChange={(e) => setIngest(e.target.checked)}
                />
                벡터 DB(<code className="font-mono text-xs">statutes_collection</code>)에 적재
              </label>
            </>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void onUpload(true)}
              disabled={busy || facilityMissing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  업로드 중
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
        </div>
      )}

      {/* 결과 알림 상자 */}
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
        </div>
      )}

      {/* 업로드 목록 테이블 */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-800">
            {tab === "data" ? "업로드된 데이터" : "업로드된 조례"}
          </h4>
          <button
            type="button"
            onClick={() => setListNonce((n) => n + 1)}
            disabled={!savedDomain || busy}
            className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40"
          >
            새로고침
          </button>
        </div>

        {!savedDomain ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 text-center text-sm text-gray-400">
            올리면 여기에 목록이 뜹니다.
          </p>
        ) : listLoading ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            불러오는 중...
          </p>
        ) : listError ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-600 break-all">
            {listError}
          </p>
        ) : tab === "data" ? (
          <DataTable list={dataList} busy={busy} onDelete={onDelete} />
        ) : (
          <LawTable items={lawList} busy={busy} onDelete={onDelete} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Sub Presenter Components
// ─────────────────────────────────────────────────────────────

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
      title={blocked ? "이 폴더에 원래 있던 배포 원본입니다." : undefined}
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
  if (!list || list.files.length === 0) return <Empty />;
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {list.files.map((f: DataFile) => (
        <li key={f.filename} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="w-8 shrink-0 font-mono text-xs text-blue-700">{f.dataset_id ?? "—"}</span>
          <span className="flex-1 truncate font-mono text-xs text-gray-800">{f.filename}</span>
          <span className="shrink-0 text-xs text-gray-500">{kb(f.size)}</span>
          <DeleteCell filename={f.filename} deletable={f.deletable} busy={busy} onDelete={onDelete} />
        </li>
      ))}
    </ul>
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
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {items.map((f) => (
        <li key={f.filename} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="flex-1 truncate font-mono text-xs text-gray-800">{f.filename}</span>
          <span className="shrink-0 text-xs text-gray-500">{kb(f.size)}</span>
          <DeleteCell filename={f.filename} deletable={f.deletable} busy={busy} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return (
    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 text-center text-sm text-gray-400">
      아직 없습니다.
    </p>
  );
}
