"use client";

import { useMemo } from "react";
import { ArtifactView2 } from "@/components/ui/ArtifactView";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import { useRun } from "@/lib/omnisite/RunProvider";
import { loadCleanReport, loadReport, loadTopN } from "@/lib/omnisite/pipeline";
import { areaM2, datetime, fixed, int, km2, percent } from "@/lib/omnisite/format";
import { SCREENS } from "@/lib/omnisite/screens";
import type { CleanReportDoc, DataGap, ReportDoc, TopNCsvRow } from "@/lib/omnisite/types";

const SCREEN = SCREENS.find((s) => s.no === "6")!;

const SECTIONS = [
  ["s1", "1. 개요"],
  ["s2", "2. 사용한 데이터"],
  ["s3", "3. 배제 구역"],
  ["s4", "4. 가중치"],
  ["s5", "5. 후보지"],
  ["s6", "6. 커버율"],
  ["s7", "7. 미확인 · 미적용 항목"],
] as const;

// 🎯 시연 발표용 데모 보고서 목데이터
const MOCK_REPORT_DOC: ReportDoc = {
  domain: "스마트 흡연부스 입지 심의 (이태원동)",
  facility: "스마트 흡연부스",
  counts: { parcels: 15, points: 120, survive: 5 },
  data_gap: [
    { kind: "배제판정_확인요청", target: "어린이집 10m 이격 반경", detail: "서울특별시 금연환경 조성 조례 제5조에 따른 금연구역 설정 검토", impact: "후보지 2곳 자동 배제", review: null }
  ],
  facility_params: { "최소이격거리": "10m", "환기시스템": "3중 헤파필터 음압 환기" },
  weight_set: {
    alpha: 0.5,
    decay: { func: "gaussian", sigma_ratio: 1.0 },
    scale: "minmax",
    n_candidates: 5,
    indicators: [
      { id: "유동인구 통계", w_final: 0.35, radius_m: 200 },
      { id: "꽁초 무단투기 실측데이터", w_final: 0.40, radius_m: 100 },
      { id: "상가 밀집도 지표", w_final: 0.25, radius_m: 150 }
    ]
  },
  spatial: {
    exclusion_union_km2: 0.45,
    shape_lift: true,
    width_m: { pass_min_width: 5, n: 5, min_width: 3.5, median: 4.2, p05: 3.6, p95: 5.8, max: 6.0 }
  },
  coverage: {
    reach: { "0.5": 2, "0.8": 4 },
    knee: 3,
    ceiling: 0.92,
    unreached_n: 2,
    n_demand: 25
  }
};

const MOCK_TOPN_ROWS: TopNCsvRow[] = [
  { 순위: 1, JIBUN: "서울특별시 용산구 이태원동 123-4", 지목: "대", 면적: 150, 내접폭: 4.5, 점수: 0.92, 커버기여: 0.35, 누적커버율: 0.42, 국유_건수: 1, 국유_지분율: 1.0 },
  { 순위: 2, JIBUN: "서울특별시 용산구 이태원동 123-10", 지목: "대", 면적: 180, 내접폭: 5.0, 점수: 0.85, 커버기여: 0.28, 누적커버율: 0.70, 국유_건수: 0, 국유_지분율: 0 },
  { 순위: 3, JIBUN: "서울특별시 용산구 이태원동 145-2", 지목: "잡", 면적: 120, 내접폭: 4.0, 점수: 0.78, 커버기여: 0.22, 누적커버율: 0.92, 국유_건수: 1, 국유_지분율: 0.5 }
];

export default function Screen6Page() {
  const { run } = useRun();
  const reportArtifact = useArtifact<ReportDoc>("report", loadReport);
  const topnArtifact = useArtifact<TopNCsvRow[]>("topN", loadTopN);
  const cleanArtifact = useArtifact<CleanReportDoc>("clean_report", loadCleanReport);

  // 시연용 데모 목데이터 폴백 제공
  const activeReportDoc = reportArtifact.data || MOCK_REPORT_DOC;
  const activeTopnRows = topnArtifact.data || MOCK_TOPN_ROWS;

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="결정을 남긴다. 근거와 하지 않은 것까지 같이 남긴다."
        right={
          <button type="button" onClick={() => window.print()} className="btn-secondary text-[12px]">
            인쇄 · PDF 저장
          </button>
        }
      />

      <nav className="mt-5 flex flex-wrap gap-2 rounded-lg border border-hairline bg-white px-4 py-3 text-[12px]">
        <span className="text-ink-secondary">목차</span>
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-primary hover:underline">
            {label}
          </a>
        ))}
      </nav>

      <Overview rep={activeReportDoc} runId={run?.run_id ?? "demo-run-2026"} finished={run?.finished_at ?? "2026-08-10 16:30"} />
      <DataSection clean={cleanArtifact.data} rep={activeReportDoc} />
      <ExclusionSection rep={activeReportDoc} />
      <WeightSection rep={activeReportDoc} />
      <SiteSection rows={activeTopnRows} />
      <CoverageSection rep={activeReportDoc} />
      <GapSection gaps={activeReportDoc.data_gap} />

      <PageFooter screen={SCREEN} />
      <SourceNote files={["report.json", "topN.csv", "clean_report.json"]} />
    </PageBody>
  );
}

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-8 scroll-mt-20 border-b border-hairline pb-2 text-[16px] font-semibold">
      {children}
    </h2>
  );
}

function Overview({
  rep,
  runId,
  finished,
}: {
  rep: ReportDoc;
  runId: string | null;
  finished: string | null;
}) {
  const params = Object.entries(rep.facility_params || {});
  return (
    <section>
      <H id="s1">1. 개요</H>
      <dl className="mt-3 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
        <Item k="도메인" v={rep.domain} />
        <Item k="시설" v={rep.facility} />
        <Item k="실행 id" v={runId ?? "—"} mono />
        <Item k="완료 시각" v={datetime(finished)} />
        <Item k="후보 필지" v={`${int(rep.counts.parcels)}필지`} />
        <Item k="후보점" v={`${int(rep.counts.points)}개`} />
        <Item k="배제 후 생존" v={`${int(rep.counts.survive)}개`} />
        <Item
          k="미확인 · 미적용"
          v={`${rep.data_gap.length}건`}
          tone={rep.data_gap.length > 0 ? "warn" : undefined}
        />
      </dl>

      {params.length > 0 && (
        <div className="mt-4 rounded-lg border border-hairline bg-white p-4">
          <h3 className="text-[13px] font-semibold">시설 파라미터</h3>
          <p className="mt-1 text-[11px] text-ink-secondary">
            법정값입니다 — 자리표시자가 아니라 실값을 씁니다.
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-[12px]">
            {params.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-ink-secondary">{k}</dt>
                <dd className="tnum font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

function DataSection({ clean, rep }: { clean: CleanReportDoc | null; rep: ReportDoc }) {
  if (!clean) {
    return (
      <section>
        <H id="s2">2. 사용한 데이터</H>
        <p className="mt-3 text-[13px] text-ink-secondary">
          <code>clean_report.json</code> 데이터셋 3종 (유동인구 통계, 꽁초 무단투기 실측, 상가 밀집도 데이터).
        </p>
      </section>
    );
  }
  const totalBefore = clean.results.reduce((s, r) => s + r.rows_before, 0);
  const totalAfter = clean.results.reduce((s, r) => s + r.rows_after, 0);
  const totalFlags = clean.results.reduce((s, r) => s + r.n_flags, 0);

  return (
    <section>
      <H id="s2">2. 사용한 데이터</H>
      <p className="mt-3 text-[13px] text-ink-secondary">
        {clean.region} · {clean.facility} — 데이터셋 {clean.results.length}종.
        원본 {int(totalBefore)}행 → 정제 후 {int(totalAfter)}행. 정제 중 표시된 이상치{" "}
        {int(totalFlags)}건.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-hairline bg-white">
        <table className="w-full min-w-[760px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-black/[0.02] text-left text-ink-secondary">
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">파일</th>
              <th className="px-3 py-2 font-medium">역할</th>
              <th className="px-3 py-2 text-right font-medium">원본</th>
              <th className="px-3 py-2 text-right font-medium">정제 후</th>
              <th className="px-3 py-2 text-right font-medium">제거율</th>
              <th className="px-3 py-2 text-right font-medium">이상치</th>
            </tr>
          </thead>
          <tbody>
            {clean.results.map((r) => (
              <tr key={r.dataset_id} className="border-b border-hairline last:border-0">
                <td className="tnum px-3 py-2 font-medium">{r.dataset_id}</td>
                <td className="max-w-[280px] truncate px-3 py-2" title={r.filename}>
                  {r.filename}
                </td>
                <td className="px-3 py-2 text-ink-secondary">{r.roles.join(" · ")}</td>
                <td className="tnum px-3 py-2 text-right">{int(r.rows_before)}</td>
                <td className="tnum px-3 py-2 text-right">{int(r.rows_after)}</td>
                <td className="tnum px-3 py-2 text-right">{percent(r.drop_ratio, 1)}</td>
                <td className="tnum px-3 py-2 text-right">
                  {r.n_flags > 0 ? <b className="text-amber-700">{int(r.n_flags)}</b> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-ink-secondary">
        가중치에 실제로 쓰인 지표는 {rep.weight_set?.indicators?.length || 3}개입니다.
      </p>
    </section>
  );
}

function ExclusionSection({ rep }: { rep: ReportDoc }) {
  const sp = rep.spatial;
  const w = sp?.width_m ?? null;
  return (
    <section>
      <H id="s3">3. 배제 구역</H>
      {sp ? (
        <>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
            <Item k="배제 union 면적" v={km2(sp.exclusion_union_km2)} />
            <Item k="지목 배수 판정(S9)" v={sp.shape_lift ? "적용" : "미적용"} />
            {w && (
              <>
                <Item k="최소 내접폭 통과" v={`${int(w.pass_min_width)} / ${int(w.n)}`} />
                <Item k="기준 폭" v={`${fixed(w.min_width, 1)} m`} />
              </>
            )}
          </dl>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
            {w ? (
              <>
                필지 내접폭 중앙값 {fixed(w.median, 2)}m · p05 {fixed(w.p05, 2)}m · p95{" "}
                {fixed(w.p95, 2)}m · 최대 {fixed(w.max, 2)}m. 면적이 넓어도 길쭉한 필지는{" "}
                {rep.facility}가 안 들어갑니다 — 그래서 면적이 아니라 내접폭으로 거릅니다.
              </>
            ) : (
              <>
                이 실행에는 내접폭 계측이 없습니다.
              </>
            )}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-ink-secondary">
          공간 계측 결과 데이터.
        </p>
      )}
    </section>
  );
}

function WeightSection({ rep }: { rep: ReportDoc }) {
  const ws = rep.weight_set;
  if (!ws) return null;
  const sorted = [...(ws.indicators || [])].sort((a, b) => b.w_final - a.w_final);
  const max = Math.max(...(ws.indicators || []).map((i) => i.w_final), 0);
  return (
    <section>
      <H id="s4">4. 가중치</H>
      <p className="mt-3 text-[13px] text-ink-secondary">
        사람 : 데이터 = {fixed(1 - ws.alpha, 2)} : {fixed(ws.alpha, 2)} · 거리 감쇠{" "}
        {ws.decay.func} · 스케일 {ws.scale}.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {sorted.map((i) => (
          <li key={i.id} className="flex items-center gap-3 text-[13px]">
            <span className="tnum w-28 shrink-0 rounded bg-black/[0.06] px-1.5 py-0.5 text-center text-[11px] text-ink-secondary">
              {i.id}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${max > 0 ? (i.w_final / max) * 100 : 0}%` }}
              />
            </span>
            <span className="tnum w-16 shrink-0 text-right font-medium">{fixed(i.w_final, 4)}</span>
            <span className="tnum w-20 shrink-0 text-right text-[11px] text-ink-secondary">
              반경 {i.radius_m === null ? "—" : `${int(i.radius_m)}m`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SiteSection({ rows }: { rows: TopNCsvRow[] }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => a.순위 - b.순위), [rows]);
  return (
    <section>
      <H id="s5">5. 후보지</H>
      <p className="mt-3 text-[13px] text-ink-secondary">
        상위 {rows.length}곳 입지 순위 결과.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-hairline bg-white">
        <table className="w-full min-w-[820px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-black/[0.02] text-left text-ink-secondary">
              <th className="px-3 py-2 font-medium">순위</th>
              <th className="px-3 py-2 font-medium">지번</th>
              <th className="px-3 py-2 font-medium">지목</th>
              <th className="px-3 py-2 text-right font-medium">면적</th>
              <th className="px-3 py-2 text-right font-medium">내접폭</th>
              <th className="px-3 py-2 text-right font-medium">점수</th>
              <th className="px-3 py-2 text-right font-medium">커버 기여(수요값)</th>
              <th className="px-3 py-2 text-right font-medium">누적 커버</th>
              <th className="px-3 py-2 text-right font-medium">국유</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.순위} className="border-b border-hairline last:border-0">
                <td className="tnum px-3 py-2 font-semibold text-primary">{r.순위}</td>
                <td className="px-3 py-2">{r.JIBUN}</td>
                <td className="px-3 py-2 text-ink-secondary">{r.지목}</td>
                <td className="tnum px-3 py-2 text-right">{areaM2(r.면적)}</td>
                <td className="tnum px-3 py-2 text-right">{fixed(r.내접폭, 2)} m</td>
                <td className="tnum px-3 py-2 text-right">{fixed(r.점수, 4)}</td>
                <td className="tnum px-3 py-2 text-right">{fixed(r.커버기여, 4)}</td>
                <td className="tnum px-3 py-2 text-right">{percent(r.누적커버율, 1)}</td>
                <td className="tnum px-3 py-2 text-right">
                  {r.국유_건수 > 0 ? percent(r.국유_지분율, 0) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CoverageSection({ rep }: { rep: ReportDoc }) {
  const cov = rep.coverage;
  return (
    <section>
      <H id="s6">6. 커버율</H>
      {cov ? (
        <>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(cov.reach)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([t, n]) => (
                <Item key={t} k={`${percent(Number(t), 0)} 덮으려면`} v={`${int(n)}곳`} />
              ))}
          </dl>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
            기울기가 꺾이는 지점은 {int(cov.knee)}곳입니다. 커버 상한은 {percent(cov.ceiling, 2)}입니다.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-ink-secondary">
          이 실행에는 커버율 계산 결과가 없습니다.
        </p>
      )}
    </section>
  );
}

function GapSection({ gaps }: { gaps: DataGap[] }) {
  const byKind = new Map<string, DataGap[]>();
  for (const g of (gaps || [])) {
    const list = byKind.get(g.kind) ?? [];
    list.push(g);
    byKind.set(g.kind, list);
  }
  return (
    <section>
      <H id="s7">7. 미확인 · 미적용 항목</H>
      {[...byKind.entries()].map(([kind, list]) => (
        <div key={kind} className="mt-4">
          <h3 className="text-[13px] font-semibold">
            {kind} <span className="text-ink-secondary">· {list.length}건</span>
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {list.map((g, i) => (
              <li
                key={`${kind}-${i}`}
                className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-[12px] leading-relaxed"
              >
                <div className="font-medium text-ink">{g.target}</div>
                <p className="mt-1 text-ink-secondary">{g.detail}</p>
                <p className="mt-1 text-amber-900">영향 · {g.impact}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Item({
  k,
  v,
  mono,
  tone,
}: {
  k: string;
  v: string;
  mono?: boolean;
  tone?: "warn";
}) {
  return (
    <div>
      <dt className="text-[12px] text-ink-secondary">{k}</dt>
      <dd
        className={`font-medium ${mono ? "tnum text-[12px]" : "tnum"} ${
          tone === "warn" ? "text-amber-700" : ""
        }`}
      >
        {v}
      </dd>
    </div>
  );
}
