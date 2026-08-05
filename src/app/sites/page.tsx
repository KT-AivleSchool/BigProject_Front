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
import { useState } from "react";
import { ArtifactView2 } from "@/components/ui/ArtifactView";
import { GridMap } from "@/components/map/GridMap";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import { loadReport, loadScoreGrid, loadTopN } from "@/lib/omnisite/pipeline";
import { areaM2, fixed, int, percent } from "@/lib/omnisite/format";
import { SCREENS } from "@/lib/omnisite/screens";
import type { ReportDoc, ScoreGridDoc, TopNCsvRow } from "@/lib/omnisite/types";

const SCREEN = SCREENS.find((s) => s.no === "4")!;

export default function Screen4Page() {
  const grid = useArtifact<ScoreGridDoc>("score_grid", loadScoreGrid);
  const topn = useArtifact<TopNCsvRow[]>("topN", loadTopN);
  const report = useArtifact<ReportDoc>("report", loadReport);

  const [selected, setSelected] = useState<number | null>(null);
  const [panel, setPanel] = useState(true);
  const [showExcluded, setShowExcluded] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [basemap, setBasemap] = useState(true);
  const [tileFailed, setTileFailed] = useState(false);

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="수요 커버리지를 최대로 만드는 조합 — 순위는 점수가 아니라 커버 기여로 정해진다."
      />

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

              {basemap && tileFailed && (
                <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  배경 지도 타일을 받지 못했습니다(외부 망 차단이거나 타일 서버 응답 없음).
                  <b> 격자와 후보지는 그대로 정확합니다</b> — 배경만 없습니다. 「배경 지도」를
                  꺼도 됩니다.
                </p>
              )}

              <div
                className={`mt-4 grid gap-4 ${panel ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}
              >
                <div className="h-[560px]">
                  <GridMap
                    grid={g}
                    topn={rows}
                    selected={selected}
                    onSelect={setSelected}
                    showExcluded={showExcluded}
                    showGrid={showGrid}
                    basemap={basemap}
                    onTileError={() => setTileFailed(true)}
                  />
                </div>

                {panel && (
                  <aside className="flex max-h-[560px] flex-col gap-4 overflow-y-auto pr-1">
                    <Coverage report={report.data} nTop={rows.length} />
                    {sel ? (
                      <Detail
                        row={sel}
                        prev={rows.find((r) => r.순위 === sel.순위 - 1) ?? null}
                        rows={rows}
                        minSep={minSepM(report.data)}
                        onClose={() => setSelected(null)}
                      />
                    ) : (
                      <TopList rows={rows} onSelect={setSelected} />
                    )}
                  </aside>
                )}
              </div>

              <Legend grid={g} />
            </>
          );
        }}
      </ArtifactView2>

      {/*
        명세 화면 4 의 주 동작은 「갈등 예측 실행」이다. **버튼을 살려두지 않는다** —
        화면 5(공청회 시뮬레이션)는 백엔드 배선이 끝나지 않았고 담당이 넘어갔다.
        누르면 아무 일도 안 일어나는 버튼은 "실행됐나?" 를 사람이 확인할 수 없게
        만든다(절대원칙 1·4). 자리와 사유만 남기고, 넘어가는 길은 「갈등 예측 ▶」로
        열어 둔다 — 명세는 확정 전에도 다음 화면으로 갈 수 있어야 한다고 정했다.
      */}
      <PageFooter
        screen={SCREEN}
        action={
          <button
            type="button"
            disabled
            title="화면 5 공청회 시뮬레이션을 실행하는 API 가 아직 없습니다. 이 화면에서 고른 후보를 넘기는 경로도 정해지지 않았습니다."
            className="btn-secondary cursor-not-allowed text-[13px] opacity-45"
          >
            갈등 예측 실행 (미배선)
          </button>
        }
      />
      <SourceNote
        files={[
          "score_grid.json",
          "topN.csv (좌표 유일 출처)",
          "report.json (coverage · facility_params)",
        ]}
      />
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
    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-hairline bg-white px-4 py-3 text-[12px]">
      <Toggle on={showGrid} set={setShowGrid} label={`점수 격자 (${int(grid.count)}칸)`} />
      <Toggle on={showExcluded} set={setShowExcluded} label={`배제 칸 (${int(excluded)})`} />
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

function Coverage({ report, nTop }: { report: ReportDoc | null; nTop: number }) {
  if (!report) {
    return (
      <div className="rounded-xl border border-hairline bg-white p-4 text-[12px] text-ink-secondary">
        커버율은 <code>report.json</code> 에서 읽습니다. 아직 못 읽었습니다.
      </div>
    );
  }
  const cov = report.coverage;
  if (!cov) {
    return (
      <div className="rounded-xl border border-hairline bg-white p-4 text-[12px] text-ink-secondary">
        이 실행에는 커버율 계산 결과가 없습니다(<code>report.coverage = null</code>).
      </div>
    );
  }
  const atTop = cov.cumulative[nTop - 1] ?? null;
  const reach = Object.entries(cov.reach).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <div className="rounded-xl border border-hairline bg-white p-4">
      <h2 className="text-[13px] font-semibold">커버율</h2>
      <div className="mt-2 flex items-baseline gap-2">
        <b className="tnum text-[24px]">{percent(atTop, 1)}</b>
        <span className="text-[12px] text-ink-secondary">상위 {nTop}곳 설치 시</span>
      </div>
      <CoverageChart cumulative={cov.cumulative} knee={cov.knee} nTop={nTop} />
      <dl className="mt-3 flex flex-col gap-1 text-[12px]">
        {reach.map(([target, n]) => (
          <div key={target} className="flex justify-between">
            <dt className="text-ink-secondary">{percent(Number(target), 0)} 덮으려면</dt>
            <dd className="tnum font-medium">{int(n)}곳</dd>
          </div>
        ))}
        <div className="flex justify-between">
          <dt className="text-ink-secondary">기울기 꺾이는 지점</dt>
          <dd className="tnum font-medium">{int(cov.knee)}곳</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-secondary">상한</dt>
          <dd className="tnum font-medium">{percent(cov.ceiling, 2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-secondary">아무리 놓아도 못 닿는 수요점</dt>
          <dd className="tnum font-medium">{int(cov.unreached_n)}개</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary">
        상한이 100% 가 아닌 것은 버그가 아니라 사실입니다 — 배제구역 안에만 있어 어떤
        후보로도 닿지 않는 수요점이 {int(cov.unreached_n)}개 있습니다. 수요점{" "}
        {int(cov.n_demand)}개 · 커버 쌍 {int(cov.cover_pairs)}쌍으로 계산했습니다.
      </p>
    </div>
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
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[90px] w-full" role="img" aria-label="커버율 곡선">
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
  onSelect,
}: {
  rows: TopNCsvRow[];
  onSelect: (rank: number) => void;
}) {
  const sorted = [...rows].sort((a, b) => a.순위 - b.순위);
  return (
    <div className="rounded-xl border border-hairline bg-white p-4">
      <h2 className="text-[13px] font-semibold">후보지 {rows.length}곳</h2>
      <p className="mt-1 text-[11px] text-ink-secondary">
        순위는 <b>커버 기여</b> 순입니다 — 점수가 높아도 앞 순위와 겹치면 뒤로 밀립니다.
      </p>
      <ul className="mt-3 flex flex-col gap-1">
        {sorted.map((r) => (
          <li key={r.순위}>
            <button
              type="button"
              onClick={() => onSelect(r.순위)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-black/[0.04]"
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
        ))}
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
    <div className="rounded-xl border border-primary/30 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[12px] text-ink-secondary">{row.순위}순위 후보지</div>
          <h2 className="text-[15px] font-semibold">{row.JIBUN}</h2>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary text-[12px]">
          목록으로
        </button>
      </div>

      <dl className="mt-3 flex flex-col gap-1 text-[12px]">
        <Row k="점수" v={fixed(row.점수, 4)} />
        <Row k="커버 기여" v={`${fixed(row.커버기여, 4)} (수요값)`} />
        <Row
          k="커버율 증가"
          v={`+${fixed(deltaCover * 100, 2)}%p${prev ? "" : " (0 에서)"}`}
        />
        <Row k="누적 커버율" v={percent(row.누적커버율, 2)} />
        <Row k="지목" v={row.지목} />
        <Row k="면적" v={areaM2(row.면적)} />
        <Row k="내접폭" v={`${fixed(row.내접폭, 2)} m`} />
        <Row
          k="최소 이격 기준"
          v={minSep === null ? "—" : `${fixed(minSep, 0)} m`}
        />
        <Row
          k="가장 가까운 후보"
          v={near === null ? "다른 후보 없음" : `${fixed(near.m, 0)} m · ${near.rank}순위`}
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
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink-secondary">
      <span className="flex items-center gap-2">
        <span className="h-3 w-24 rounded" style={{ background: "linear-gradient(90deg,#e9edf2,#0075de)" }} />
        점수 {fixed(grid.score_min, 3)} → {fixed(grid.score_max, 3)}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded" style={{ background: "rgba(190,60,60,0.30)" }} />
        배제 칸
      </span>
      <span className="flex items-center gap-1.5">
        <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-primary bg-white text-[9px] font-semibold text-primary">
          1
        </span>
        Top-N 후보지
      </span>
      <span className="ml-auto">
        격자 사각형은 산출물의 <b>중심점</b>과 <code>spacing_m={grid.spacing_m}</code> 로
        화면에서 만든 것입니다 — 산출물에 폴리곤은 없습니다.
      </span>
    </div>
  );
}
