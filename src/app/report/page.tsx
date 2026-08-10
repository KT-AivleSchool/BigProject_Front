"use client";

/**
 * 화면 6 · 보고서
 * ===============
 * 명세: 「결정을 남긴다. 근거와 **하지 않은 것**까지 같이 남긴다.」
 *
 * 읽는 것
 *   report.json      본문 거의 전부 (weight_set 요약 · counts · coverage · spatial · topn · data_gap)
 *   topN.csv         좌표 (report.topn[] 에는 없다)
 *   clean_report.json 데이터 출처와 정제 이력
 *
 * 🔴 `data_gap` 은 이 화면의 **핵심**이지 부록이 아니다. 실측 6건 —
 *    배제판정_확인요청 4 · 주변이격_미적용 1 · 수요_도달불가 1. 적용 안 한 것을
 *    "안 했다"고 적는 것이 산출물 계약이다(절대원칙 4). 그래서 목차 맨 끝이 아니라
 *    개요 바로 아래에도 건수를 띄운다.
 *
 * 🔴 화면 2 의 확인 요청(`reviewed.hitl_flags`)과 **섞지 않는다.** 출처가 다르다.
 *    저기는 감리 단계, 여기는 실행이 끝난 뒤 엔진이 남긴 것이다.
 *
 * 내보내기는 `window.print()` 다. `jspdf` 가 설치돼 있지만 쓰지 않았다 —
 * 캔버스로 그린 PDF 는 글자가 이미지가 되고 한글 폰트를 따로 실어야 한다.
 * 브라우저 인쇄는 텍스트가 텍스트로 남고, 화면과 결과가 다를 일이 없다.
 */
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

export default function Screen6Page() {
  const { run } = useRun();
  const report = useArtifact<ReportDoc>("report", loadReport);
  const topn = useArtifact<TopNCsvRow[]>("topN", loadTopN);
  const clean = useArtifact<CleanReportDoc>("clean_report", loadCleanReport);

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

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pr-2 mt-4 pb-4">
        <ArtifactView2 a={report} b={topn} what="보고서">
          {(rep, rows) => (
            <>
              <nav className="flex flex-wrap gap-2 rounded-lg border border-hairline bg-white px-4 py-3 text-[12px]">
                <span className="text-ink-secondary">목차</span>
                {SECTIONS.map(([id, label]) => (
                  <a key={id} href={`#${id}`} className="text-primary hover:underline">
                    {label}
                  </a>
                ))}
              </nav>

              <Overview rep={rep} runId={run?.run_id ?? null} finished={run?.finished_at ?? null} />
              <DataSection clean={clean.data} rep={rep} />
              <ExclusionSection rep={rep} />
              <WeightSection rep={rep} />
              <SiteSection rows={rows} />
              <CoverageSection rep={rep} />
              <GapSection gaps={rep.data_gap} />
            </>
          )}
        </ArtifactView2>
      </div>

      <PageFooter screen={SCREEN} />
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
  const params = Object.entries(rep.facility_params);
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
          <code>clean_report.json</code> 을 아직 읽지 못했습니다. 데이터 목록을 지어내지
          않습니다.
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
                {/* 🔴 r.output 은 서버 절대경로다. 절대 화면에 내지 않는다. */}
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
        가중치에 실제로 쓰인 지표는 {rep.weight_set.indicators.length}개입니다 — 데이터셋
        수와 다릅니다(배제·참고용은 점수에 안 들어갑니다).
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
            {/* 🔴 `spatial` 이 있어도 `width_m` 은 없을 수 있다 — 내접폭 컬럼이 없는
                지적도. 보고서는 인쇄돼 나가는 문서라, 없는 계측을 "0 / 0" 으로 찍으면
                읽는 사람이 "전부 탈락했다"로 읽는다. 항목째로 빼고 사유를 적는다. */}
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
                이 실행에는 <b>내접폭 계측이 없습니다</b>(<code>spatial.width_m</code> 키
                없음). 지적도에 내접폭을 낼 수 있는 형태 정보가 없으면 계산되지 않습니다 —
                면적이 넓어도 길쭉해서 {rep.facility}가 못 들어가는 필지가 걸러지지
                않았다는 뜻입니다.
              </>
            )}
          </p>
          <p className="mt-2 text-[12px] text-ink-secondary">
            레이어별 내역과 근거는 <b>화면 2b · 배제 근거</b>에 있습니다.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-ink-secondary">
          이 실행에는 공간 계측 결과가 없습니다(<code>report.spatial = null</code>).
        </p>
      )}
    </section>
  );
}

function WeightSection({ rep }: { rep: ReportDoc }) {
  const ws = rep.weight_set;
  const sorted = [...ws.indicators].sort((a, b) => b.w_final - a.w_final);
  const max = Math.max(...ws.indicators.map((i) => i.w_final), 0);
  return (
    <section>
      <H id="s4">4. 가중치</H>
      <p className="mt-3 text-[13px] text-ink-secondary">
        사람 : 데이터 = {fixed(1 - ws.alpha, 2)} : {fixed(ws.alpha, 2)} · 거리 감쇠{" "}
        {ws.decay.func}(σ비 {fixed(ws.decay.sigma_ratio, 2)}) · 스케일 {ws.scale} · 후보{" "}
        {int(ws.n_candidates)}.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {sorted.map((i) => (
          <li key={i.id} className="flex items-center gap-3 text-[13px]">
            <span className="tnum w-16 shrink-0 rounded bg-black/[0.06] px-1.5 py-0.5 text-center text-[11px] text-ink-secondary">
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
      <p className="mt-2 text-[11px] text-ink-secondary">
        지표 이름과 근거는 <b>화면 3 · 가중치</b>에 있습니다. 여기 id 는 데이터셋 번호
        조합입니다.
      </p>
    </section>
  );
}

function SiteSection({ rows }: { rows: TopNCsvRow[] }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => a.순위 - b.순위), [rows]);
  return (
    <section>
      <H id="s5">5. 후보지</H>
      <p className="mt-3 text-[13px] text-ink-secondary">
        상위 {rows.length}곳. 순위는 점수가 아니라 <b>커버 기여</b> 순입니다 — 점수가 높아도
        앞 순위와 덮는 범위가 겹치면 뒤로 밀립니다.
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
              {/* 🔴 `커버기여` 는 비율이 아니라 수요값 절대량이다(= coverage.marginal).
                  `percent()` 로 찍었더니 4순위가 "6142.57%" 로 나왔다. 총 수요값이
                  산출물에 없어 백분율 환산이 불가능해서, 단위를 머리글에 밝히고
                  산출물 값을 그대로 쓴다. 진행 정도는 옆의 「누적 커버」로 읽는다. */}
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
      <p className="mt-2 text-[11px] text-ink-secondary">
        지도는 <b>화면 4 · 위치 선정</b>에 있습니다. 좌표는 <code>topN.csv</code> 에만
        있어 이 표도 거기서 읽었습니다.
      </p>
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
            기울기가 꺾이는 지점은 {int(cov.knee)}곳입니다 — 그 뒤로는 하나 더 놓아도 덮이는
            면적이 확 줄어듭니다. 커버 상한은 {percent(cov.ceiling, 2)} 이고, 100% 가 아닌
            이유는 어떤 후보로도 닿지 않는 수요점이 {int(cov.unreached_n)}개 있기
            때문입니다(전체 수요점 {int(cov.n_demand)}개). 이건 계산 오류가 아니라 사실이며,
            7절에도 항목으로 남습니다.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-ink-secondary">
          이 실행에는 커버율 계산 결과가 없습니다(<code>report.coverage = null</code>).
        </p>
      )}
    </section>
  );
}

function GapSection({ gaps }: { gaps: DataGap[] }) {
  const byKind = new Map<string, DataGap[]>();
  for (const g of gaps) {
    const list = byKind.get(g.kind) ?? [];
    list.push(g);
    byKind.set(g.kind, list);
  }
  return (
    <section>
      <H id="s7">7. 미확인 · 미적용 항목</H>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
        엔진이 <b>적용하지 못한 것</b>을 그대로 옮긴 목록입니다. 이 절이 비어 있으면 좋은
        게 아니라 의심스러운 것입니다 — 도메인이 바뀌면 반드시 무언가 남습니다.
        {gaps.length === 0 && " 이번 실행에서는 0건입니다."}
      </p>

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
                {g.review && (
                  <pre className="mt-2 overflow-x-auto rounded border border-amber-200 bg-white/70 p-2 font-mono text-[11px] text-ink-secondary">
                    {JSON.stringify(g.review, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="mt-4 text-[11px] leading-relaxed text-ink-secondary">
        화면 2 의 「확인 요청」과 이 목록은 <b>출처가 다릅니다.</b> 저쪽은 감리 단계에서
        사람 확인이 필요했던 건(<code>reviewed.hitl_flags</code>)이고, 이쪽은 실행이 끝난 뒤
        엔진이 남긴 건(<code>report.data_gap</code>)입니다. 한 화면에 합치면 어느 단계에서
        생긴 문제인지 알 수 없게 됩니다.
      </p>
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
