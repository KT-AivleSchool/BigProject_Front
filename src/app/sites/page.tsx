"use client";

/**
 * 화면 4 · 위치 선정
 * ==================
 * **지도가 있는 유일한 화면이다.** 명세가 그렇게 정했다 — 다른 화면에 지도를
 * 붙이면 "어디"를 보는 화면이 여러 개가 되고, 사람은 어느 지도가 결정인지
 * 헷갈린다.
 *
 * 읽는 것
 *   score_grid.json  격자 중심점 + 점수 + 배제여부      → 지도 배경
 *   topN.csv         상위 후보 20곳 (**경도·위도가 여기에만 있다**) → 마커·표
 *   report.json      커버율 곡선 · 도달 개수            → 오른쪽 패널
 *
 * 🔴 `report.json > topn[]` 에는 **좌표가 없다**(실측). 그래서 마커는 반드시
 *    CSV 쪽이어야 한다. 두 곳의 순위·점수는 같지만 좌표는 한쪽에만 있으므로
 *    "report 에서 읽었다"고 적으면 그건 거짓 출처 기록이다.
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArtifactView2 } from "@/components/ui/ArtifactView";
import { GridMap } from "@/components/map/GridMap";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import { useRun } from "@/lib/omnisite/RunProvider";
import { writeSitePick } from "@/lib/omnisite/sitePick";
import { loadReport, loadScoreGrid, loadTopN } from "@/lib/omnisite/pipeline";
import { areaM2, fixed, int, percent } from "@/lib/omnisite/format";
import { SCREENS } from "@/lib/omnisite/screens";
import type { ReportDoc, ScoreGridDoc, TopNCsvRow } from "@/lib/omnisite/types";

const SCREEN = SCREENS.find((s) => s.no === "4")!;

export default function Screen4Page() {
  const router = useRouter();
  const { run } = useRun();
  const grid = useArtifact<ScoreGridDoc>("score_grid", loadScoreGrid);
  const topn = useArtifact<TopNCsvRow[]>("topN", loadTopN);
  const report = useArtifact<ReportDoc>("report", loadReport);

  const [selected, setSelected] = useState<number | null>(null);
  /**
   * 사이드바 탭. 예전엔 커버율·목록·상세를 **세로로 쌓았고**, 셋을 합치면 액자
   * 높이(최대 600px)의 세 배가 넘어 사이드바만 끝없이 스크롤됐다.
   *
   * 🔴 탭으로 바꾸면 예전 결정 하나를 뒤집게 된다 — "상세를 띄워도 목록을
   *    치우지 않는다". 그때 문제는 목록이 **사라진 것**이었고 되돌아갈 길이
   *    「목록으로」 버튼 하나뿐이었다. 탭은 다르다: 목록은 항상 **보이는 자리에
   *    이름표로 남아** 있고 한 번 눌러 돌아온다. 사라지는 것과 접히는 것은 다르다.
   */
  const [tab, setTab] = useState<"list" | "detail">("list");
  const [panel, setPanel] = useState(true);
  const [showExcluded, setShowExcluded] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [basemap, setBasemap] = useState(true);
  const [tileFailed, setTileFailed] = useState(false);

  /**
   * 선택은 **지도·목록 두 곳에서** 들어온다. 두 곳이 각자 탭을 만지면 한쪽만
   * 고쳤을 때 조용히 갈린다 — 창구를 하나로 둔다.
   * 빈 지도를 눌러 선택을 지우면(`null`) 상세 탭은 보여 줄 게 없으므로 목록으로 돌린다.
   */
  function select(rank: number | null) {
    setSelected(rank);
    setTab(rank === null ? "list" : "detail");
  }

  /**
   * 화면 5 로 넘긴다. **고른 위치를 같이 들고 간다.**
   *
   * 🔴 `rank == 1` 을 화면 5 가 알아서 쓰던 것을 여기서 끊는다 — 추천은 추천이고,
   *    어디로 공청회를 열지는 사람이 정한다(2026-08-10 사람 결정).
   *    이으는 키는 `PNU` 다. `순위` 는 실행마다 뜻이 달라 다른 필지를 가리킬 수 있다.
   *
   * 🔴 가는 곳은 `/hearing` 이 **아니라** `/hearing/select` 다(2026-08-11).
   *    화면 5 는 토론 방식이 둘이고(A 대립 `/hearing` · B 다인 `/dynamic-hearing`)
   *    엔진도 둘로 갈려 있다. 예전엔 여기서 A 를 **박아** 둬서 B 는 URL 을 직접
   *    쳐야 닿았다. 방식은 이 화면이 정하는 게 아니다 — 여기서 정하는 건 **어디를**
   *    이고, **어떻게**는 다음 화면에서 사람이 고른다.
   */
  function goHearing(row: TopNCsvRow) {
    writeSitePick({
      run_id: run?.run_id ?? null,
      rank: row.순위,
      pnu: row.PNU,
      jibun: row.JIBUN,
    });
    router.push("/hearing/select");
  }

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="선택된 후보지들이 얼마나 많은 수요를 감당할 수 있는지(커버율)를 확인합니다. 최종 순위는 단순 점수가 아닌 실질적인 수요 해결 기여도를 기준으로 결정됩니다."
      />

      <div className="flex-1 flex flex-col min-h-0 pr-2 mt-4 pb-4">
        <ArtifactView2 a={grid} b={topn} what="점수 격자와 후보지">
          {(g, rows) => {
            if (g.crs !== "EPSG:4326") {
              // 좌표계 추측은 이 프로젝트에서 실제로 사고가 났던 지점이다.
              // 다르면 그리지 않는다. 억지로 그리면 지도가 조용히 틀린다.
              return (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-5 py-6 text-[13px] text-red-800">
                  <p className="font-medium">지도를 그리지 않았습니다.</p>
                  <p className="mt-1">
                    <code>score_grid.crs</code> 가 <code>{g.crs}</code> 입니다. 이 화면은
                    EPSG:4326(경위도)만 그립니다. 다른 좌표계를 경위도로 읽으면 마커가 조용히
                    엉뚱한 곳에 찍힙니다.
                  </p>
                </div>
              );
            }
            const sel = rows.find((r) => r.순위 === selected) ?? null;

            return (
              <>
                <Toolbar
                  grid={g}
                  showGrid={showGrid}
                  setShowGrid={setShowGrid}
                  showExcluded={showExcluded}
                  setShowExcluded={setShowExcluded}
                  basemap={basemap}
                  setBasemap={setBasemap}
                  panel={panel}
                  setPanel={setPanel}
                />

                <Coverage report={report.data} nTop={rows.length} />

                <section className="flex-1 min-h-0 flex flex-col mt-3 overflow-hidden rounded-xl border border-hairline bg-white">
                  {basemap && tileFailed && (
                    <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900 shrink-0">
                      배경 지도 타일을 받지 못했습니다(외부 망 차단이거나 타일 서버 응답 없음).
                      <b> 격자와 후보지는 그대로 정확합니다</b> — 배경만 없습니다. 「배경 지도」를
                      꺼도 됩니다.
                    </p>
                  )}

                  <div
                    className={`flex-1 min-h-0 grid ${panel ? "md:grid-cols-[minmax(0,1fr)_360px]" : ""}`}
                  >
                    <div className="relative h-full min-h-0">
                      <GridMap
                        grid={g}
                        topn={rows}
                        selected={selected}
                        onSelect={select}
                        showExcluded={showExcluded}
                        showGrid={showGrid}
                        basemap={basemap}
                        onTileError={() => setTileFailed(true)}
                      />
                    </div>

                    {panel && (
                      <aside
                        className="flex h-full flex-col min-h-0 border-hairline md:border-l"
                      >
                        <div className="flex shrink-0 gap-1 border-b border-hairline px-2 pt-2">
                          <Tab on={tab === "list"} onClick={() => setTab("list")}>
                            후보 {rows.length}곳
                          </Tab>
                          <Tab on={tab === "detail"} onClick={() => setTab("detail")}>
                            {sel ? `${sel.순위}순위 상세` : "상세"}
                          </Tab>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
                          {tab === "list" ? (
                            <TopList rows={rows} selected={selected} onSelect={select} />
                          ) : sel ? (
                            <Detail
                              row={sel}
                              prev={rows.find((r) => r.순위 === sel.순위 - 1) ?? null}
                              rows={rows}
                              minSep={minSepM(report.data)}
                              onClose={() => select(null)}
                            />
                          ) : (
                            /* 빈 탭을 그냥 비워 두지 않는다 — 「고장인가」와 「아직 안 골랐나」를
                               화면만 보고 구분할 수 있어야 한다. */
                            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-50"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              <p className="text-[12px] leading-relaxed">
                                아직 선택된 후보지가 없습니다.<br/>지도의 번호 마커를 누르거나<br/>후보 리스트에서 항목을 선택하시면<br/>여기에 세부 정보가 나타납니다.
                              </p>
                            </div>
                          )}
                        </div>
                      </aside>
                    )}
                  </div>

                  <Legend grid={g} />
                </section>

                {/* 🔴 다음 단계로 가려면 **후보지를 하나 골라야 한다.** 화면 5 는
                    고른 그 점으로 공청회를 연다 — 안 고르고 넘어가면 화면 5 가
                    스스로 1순위를 집게 되고, 그건 추천을 결정으로 바꿔 읽는 것이다. */}
                <div className="shrink-0 mt-4 mb-2">
                  <div
                    className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 p-5 shadow-sm ${
                      sel ? "border-blue-200 bg-blue-50/60" : "border-gray-200 bg-gray-50/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          sel ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-gray-800">
                          {sel
                            ? `${sel.순위}순위 · ${sel.JIBUN} 로 공청회를 엽니다`
                            : "공청회를 열 위치를 선택하세요"}
                        </span>
                        <span className="text-[13px] text-gray-500">
                          {sel
                            ? "이 필지로 페르소나 토론을 시작합니다. 다른 곳을 원하면 지도나 목록에서 다시 고르세요."
                            : "지도의 번호 마커나 오른쪽 후보 목록에서 한 곳을 누르면 다음 단계로 넘어갈 수 있습니다."}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!sel}
                      onClick={() => sel && goHearing(sel)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold shadow-sm transition-all ${
                        sel
                          ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                          : "cursor-not-allowed bg-gray-300 text-gray-500"
                      }`}
                    >
                      {sel ? "이 위치로 갈등 예측 실행" : "후보지를 먼저 선택하세요"}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              </>
            );
          }}
        </ArtifactView2>
      </div>
    </PageBody>
  );
}

function Toolbar({
  grid,
  showGrid,
  setShowGrid,
  showExcluded,
  setShowExcluded,
  basemap,
  setBasemap,
  panel,
  setPanel,
}: {
  grid: ScoreGridDoc;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  showExcluded: boolean;
  setShowExcluded: (v: boolean) => void;
  basemap: boolean;
  setBasemap: (v: boolean) => void;
  panel: boolean;
  setPanel: (v: boolean) => void;
}) {
  const excluded = grid.cells.reduce((n, c) => n + (c[3] === 1 ? 1 : 0), 0);
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-hairline bg-white px-4 py-3 text-[12px] shrink-0">
      <Toggle on={showGrid} set={setShowGrid} label={`분석 격자망 (${int(grid.count)}칸)`} />
      <Toggle on={showExcluded} set={setShowExcluded} label={`설치 불가 지역 (${int(excluded)}칸)`} />
      <Toggle on={basemap} set={setBasemap} label="배경 지도" />
      <span className="ml-auto flex items-center gap-3 text-ink-secondary">
        <span>휠 확대 · 끌어서 이동 · 마커 클릭</span>
        <button type="button" onClick={() => setPanel(!panel)} className="btn-secondary text-[12px]">
          {panel ? "패널 접기 ▶" : "◀ 패널 펴기"}
        </button>
      </span>
    </div>
  );
}

function Toggle({
  on,
  set,
  label,
}: {
  on: boolean;
  set: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** 사이드바 탭 머리. 두 개뿐이라 라이브러리를 들이지 않는다. */
function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      /* 선택 탭에 아래쪽 파란 줄. `-mb-px` 로 탭 테두리가 사이드바 경계선을
         덮어 "이 탭이 아래 내용과 이어져 있다"가 보이게 한다. */
      className={`-mb-px rounded-t border-b-2 px-3 py-1.5 text-[12px] ${
        on
          ? "border-primary font-semibold text-primary"
          : "border-transparent text-ink-secondary hover:bg-black/[0.04]"
      }`}
    >
      {children}
    </button>
  );
}

function Coverage({ report, nTop }: { report: ReportDoc | null; nTop: number }) {
  if (!report) return null;
  const cov = report.coverage;
  if (!cov) return null;
  
  const atTop = cov.cumulative[nTop - 1] ?? null;
  const reach = Object.entries(cov.reach).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <section className="mt-3 rounded-xl border border-hairline bg-white p-4 shrink-0 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-8 items-center">
        {/* Left: Big Number & Chart */}
        <div className="flex items-center gap-6 w-full lg:w-1/2">
          <div className="shrink-0 text-center">
            <div className="text-[12px] text-ink-secondary mb-1">상위 {nTop}곳 설치 시 커버율</div>
            <div className="tnum text-[32px] font-black text-blue-600 leading-none">{percent(atTop, 1)}</div>
          </div>
          <div className="flex-1 h-[60px]">
            <CoverageChart cumulative={cov.cumulative} knee={cov.knee} nTop={nTop} />
          </div>
        </div>

        {/* Right: Stats */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
            {reach.map(([target, n]) => (
              <div key={target} className="flex justify-between gap-3 border-b border-gray-50 pb-1">
                <dt className="text-ink-secondary">전체 수요의 {percent(Number(target), 0)}를 해결하려면</dt>
                <dd className="tnum font-bold text-gray-800">{int(n)}곳 필요</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-b border-gray-50 pb-1">
              <dt className="text-ink-secondary" title="더 이상 후보지를 늘려도 커버율이 크게 오르지 않는 효율성 한계점입니다.">효율성 감소 시작점 (가성비 한계)</dt>
              <dd className="tnum font-bold text-gray-800">{int(cov.knee)}곳</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-gray-50 pb-1">
              <dt className="text-ink-secondary" title={`물리적으로 도달 불가능한 수요점: ${int(cov.unreached_n)}개`}>최대 해결 가능 수요 (커버율 한계)</dt>
              <dd className="tnum font-bold text-gray-800">{percent(cov.ceiling, 2)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/** 커버 곡선. 라이브러리 없이 SVG polyline 하나면 된다. */
function CoverageChart({
  cumulative,
  knee,
  nTop,
}: {
  cumulative: number[];
  knee: number;
  nTop: number;
}) {
  if (cumulative.length < 2) return null;
  const W = 320;
  const H = 90;
  const n = cumulative.length;
  const max = Math.max(...cumulative, 1e-9);
  const pts = cumulative
    .map((v, i) => `${(i / (n - 1)) * W},${H - (v / max) * H}`)
    .join(" ");
  const xAt = (i: number) => ((i - 1) / (n - 1)) * W;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="커버율 곡선">
      <polyline points={pts} fill="none" stroke="#0075de" strokeWidth={2} />
      {knee >= 1 && knee <= n && (
        <line x1={xAt(knee)} y1={0} x2={xAt(knee)} y2={H} stroke="#c0392b" strokeWidth={1} strokeDasharray="3 3" />
      )}
      {nTop >= 1 && nTop <= n && (
        <line x1={xAt(nTop)} y1={0} x2={xAt(nTop)} y2={H} stroke="#191919" strokeWidth={1} strokeDasharray="2 2" />
      )}
    </svg>
  );
}

function TopList({
  rows,
  selected,
  onSelect,
}: {
  rows: TopNCsvRow[];
  selected: number | null;
  onSelect: (rank: number) => void;
}) {
  const sorted = [...rows].sort((a, b) => a.순위 - b.순위);
  /* 탭 안이라 카드 테두리를 두르지 않는다 — 탭 머리가 이미 경계다. 겹치면
     상자 안의 상자가 되어 어디까지가 한 덩어리인지 흐려진다. */
  return (
    <div>
      <p className="text-[11px] leading-relaxed text-ink-secondary">
        최종 순위는 <b>실질적인 수요 해결 기여도</b>에 따라 결정됩니다. (단순 점수가 높아도 주변에 다른 우수 후보지가 있어 상권이 겹치면 순위가 밀릴 수 있습니다.)
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {sorted.map((r) => {
          const on = r.순위 === selected;
          return (
            <li key={r.순위}>
              <button
                type="button"
                onClick={() => onSelect(r.순위)}
                aria-current={on ? "true" : undefined}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${
                  on ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-black/[0.04]"
                }`}
              >
                <span className="tnum w-6 shrink-0 text-[12px] font-semibold text-primary">
                  {r.순위}
                </span>
                <span className="flex-1 truncate text-[12px]">{r.JIBUN}</span>
                <span className="tnum text-[11px] text-ink-secondary">{fixed(r.점수, 3)}</span>
                <span className="tnum w-12 shrink-0 text-right text-[11px] text-ink-secondary">
                  {percent(r.누적커버율, 1)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 「최소 이격」 기준값. **산출물의 키 이름이 한글이라 그대로 읽는다** —
 * 실측 `report.facility_params` 는 `설치_소요_폭_m` · `서비스_반경_m` ·
 * `최소_이격_m` 세 개다(`r_20260805_001`).
 *
 * 🔴 키가 없으면 `null` 을 돌려주고 화면은 "—" 를 그린다. 200 을 기본값으로
 *    박으면 그건 도메인 상수 하드코딩이고, 다른 시설(재활용정거장)에서 조용히
 *    틀린 숫자를 보여주게 된다.
 */
function minSepM(report: ReportDoc | null): number | null {
  const v = report?.facility_params?.["최소_이격_m"];
  return typeof v === "number" ? v : null;
}

/**
 * 선택한 후보에서 **가장 가까운 다른 후보**까지의 거리(m).
 *
 * 🔴 산출물에는 이 값이 없다. 행 단위 「최소 이격」 열이 topN_min.csv 에 없어서
 *    좌표로 화면에서 계산한다 — 격자 사각형을 중심점 + `spacing_m` 으로 만드는
 *    것과 같은 성격이다(있는 값에서 결정론적으로 유도). 지어낸 값이 아니므로
 *    화면에도 "화면에서 계산" 이라고 적는다(절대원칙 4).
 *
 * 하버사인을 쓴다. 용산구 범위(수 km)에서 타원체 오차는 0.5% 미만이라
 * 이격 판정(수백 m 대 200m)에 영향이 없다. 정밀 거리가 필요해지면 그건
 * 화면이 아니라 백엔드가 5186 평면에서 내야 할 값이다.
 */
function nearestOther(
  row: TopNCsvRow,
  rows: TopNCsvRow[],
): { rank: number; m: number } | null {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  let best: { rank: number; m: number } | null = null;
  for (const o of rows) {
    if (o.순위 === row.순위) continue;
    const la1 = rad(row.위도);
    const la2 = rad(o.위도);
    const h =
      Math.sin((la2 - la1) / 2) ** 2 +
      Math.cos(la1) * Math.cos(la2) * Math.sin(rad(o.경도 - row.경도) / 2) ** 2;
    const m = 2 * R * Math.asin(Math.sqrt(h));
    if (!best || m < best.m) best = { rank: o.순위, m };
  }
  return best;
}

/**
 * 🔴 `커버기여` 는 **비율이 아니다.** 처음에 `percent()` 로 찍었더니 4순위가
 *    "6142.57%" 로 나왔다 — 숫자만 봐도 말이 안 되는데, 만약 값이 0.6 대였다면
 *    "60%" 로 그럴듯하게 보여서 아무도 못 잡았을 것이다.
 *
 *    실측으로 정체를 확인했다: `topn[i].커버기여` ≡ `report.coverage.marginal[i]`
 *    (70.0307 · 66.2182 · 62.0606 · 61.4257 …). **수요값 절대량**이다.
 *    총 수요값은 어느 산출물에도 없어서(누적커버율에서 역산은 되지만 그건 추정이다)
 *    분모 없이 절대값 그대로 보여주고, 사람이 실제로 알고 싶은 "이 한 곳이 커버율을
 *    얼마나 올렸나" 는 **비율인 `누적커버율` 의 차분**으로 따로 계산해 붙인다.
 */
function Detail({
  row,
  prev,
  rows,
  minSep,
  onClose,
}: {
  row: TopNCsvRow;
  /** 직전 순위. 1순위면 null — 그때 증가분은 0 에서 올라온 값이다. */
  prev: TopNCsvRow | null;
  /** 이격 계산에 필요하다 — 거리는 한 행만 봐서는 나오지 않는다. */
  rows: TopNCsvRow[];
  /** 시설 기준 이격(m). 산출물에 없으면 null. */
  minSep: number | null;
  onClose: () => void;
}) {
  const deltaCover = row.누적커버율 - (prev?.누적커버율 ?? 0);
  const near = nearestOther(row, rows);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[12px] text-ink-secondary">{row.순위}순위 후보지</div>
          <h2 className="text-[15px] font-semibold">{row.JIBUN}</h2>
        </div>
        {/* 「목록으로」가 아니라 「선택 해제」다. 목록은 탭으로 늘 있으므로 이 버튼이
            하는 일은 **고른 것을 지우는 것**(지도 강조도 같이 풀린다)이다. */}
        <button type="button" onClick={onClose} className="btn-secondary shrink-0 text-[12px]">
          선택 해제
        </button>
      </div>

      <dl className="mt-3 flex flex-col gap-1 text-[12px]">
        <Row k="단순 평가 점수" v={fixed(row.점수, 4)} />
        <Row k="수요 해결 기여도" v={`${fixed(row.커버기여, 4)}`} />
        <Row
          k="실질 커버율 상승폭"
          v={`+${fixed(deltaCover * 100, 2)}%p${prev ? "" : " (0 에서)"}`}
        />
        <Row k="현재까지 누적 커버율" v={percent(row.누적커버율, 2)} />
        <Row k="토지 지목" v={row.지목} />
        <Row k="부지 면적" v={areaM2(row.면적)} />
        <Row k="내접폭 (실제 설치 가능 폭)" v={`${fixed(row.내접폭, 2)} m`} />
        <Row
          k="타 시설과의 최소 이격 기준"
          v={minSep === null ? "—" : `${fixed(minSep, 0)} m`}
        />
        <Row
          k="인접한 타 추천 후보지"
          v={near === null ? "주변에 후보지 없음" : `${fixed(near.m, 0)} m 거리에 ${near.rank}순위 있음`}
        />
        <Row k="국유지 필지" v={`${int(row.국유_건수)}건 · 지분 ${percent(row.국유_지분율, 1)}`} />
        <Row k="지번 일치" v={row.국유_지번일치 ? "예" : "아니오"} />
        <Row k="대표점 유래" v={row.from_rep ? "필지 대표점" : "격자점"} />
        <Row k="PNU" v={row.PNU} mono />
        <Row k="좌표" v={`${row.위도.toFixed(6)}, ${row.경도.toFixed(6)}`} mono />
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-secondary">
        내접폭은 이 필지 안에 시설이 실제로 들어가는지를 보는 값입니다. 면적이 넓어도
        길쭉하면 못 놓습니다.
        <br />
        「커버 기여」는 비율이 아니라 <b>수요값 절대량</b>입니다(산출물 그대로). 총
        수요값이 산출물에 없어 백분율로 바꾸지 않았습니다 — 대신 커버율이 실제로 얼마나
        올랐는지는 「커버율 증가」로 보십시오.
        <br />
        「가장 가까운 후보」는 산출물에 없는 값이라 <b>Top-N 좌표로 이 화면에서
        계산</b>한 것입니다(하버사인). 기준은 <code>report.facility_params</code> 의
        값이고, 실제 이격이 기준보다 큰지 확인하는 용도입니다.
      </p>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-ink-secondary">{k}</dt>
      <dd className={`text-right font-medium ${mono ? "tnum text-[11px]" : "tnum"}`}>{v}</dd>
    </div>
  );
}

function Legend({ grid }: { grid: ScoreGridDoc }) {
  return (
    /* 액자의 **아래 테두리**다. 위쪽 도구줄과 짝을 이룬다 — 지도를 설명하는 글이
       지도에서 떨어져 문서 흐름에 흩어지면 무엇에 대한 범례인지 흐려진다. */
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline bg-gray-50 px-4 py-2.5 text-[12px] text-gray-600">
      <span className="flex items-center gap-2">
        <span className="h-3 w-24 rounded shadow-inner" style={{ background: "linear-gradient(90deg,#e9edf2,#0075de)" }} />
        <span className="font-medium">종합 평가 점수</span> (낮음 {fixed(grid.score_min, 3)} → 높음 {fixed(grid.score_max, 3)})
      </span>
      <span className="flex items-center gap-1.5 font-medium">
        <span className="h-3 w-3 rounded shadow-sm" style={{ background: "rgba(190,60,60,0.30)" }} />
        설치 불가 지역 (배제)
      </span>
      <span className="flex items-center gap-1.5 font-medium">
        <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-primary bg-white text-[9px] font-bold text-primary shadow-sm">
          1
        </span>
        최종 추천 후보지
      </span>
      <span className="ml-auto text-gray-400 text-[11px]">
        지도 상의 사각형은 분석의 기준이 되는 {grid.spacing_m}m 단위 격자 구역을 나타냅니다.
      </span>
    </div>
  );
}
