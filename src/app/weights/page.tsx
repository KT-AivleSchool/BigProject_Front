"use client";

/**
 * 화면 3 · 가중치
 * ===============
 * 읽는 것: `weight_set.json`. 이름 붙이기에만 `reviewed` · `clean_report` 를 곁들인다
 * (없어도 화면은 뜬다 — id 로 표시된다).
 *
 * 🔴 **이 화면에는 층이 둘 있다. 겹치면 무엇을 만졌는지 아무도 설명 못 한다.**
 *
 *    1. **게이트B 답변 폼**(위) — `awaiting_hitl` + `gate.id === "weight"` 일 때만.
 *       묻는 것은 `slider_proposed`(`-1~+1`) · `radius_proposed`, 즉 **계산 전 입력**
 *       이고 제안 패스(`--propose-only`)가 만든 사전값이다.
 *    2. **산출물 `weight_set.json`**(아래) — **계산이 끝난 최종 가중치**다. 여기에는
 *       슬라이더를 달지 않고 **막대(bar)로** 그린다. 최종값에 슬라이더를 달면 사람은
 *       이 숫자를 조정했다고 믿는데 서버가 받는 것은 다른 층의 값이다.
 *
 *    폼이 열려 있는 동안 아래 표는 **직전 실행의 값**이거나 아예 없다. 그게 정상이다.
 *
 * 🔴 명세의 지표명("유동인구 · 건물 밀도")은 **산출물에 없다.** 지어내지 않고
 *    `labels.ts` 규칙으로 데이터에서 끌어온다. 끌어온 근거도 같이 보여준다.
 *
 * 🔴 `w_human` 은 **크기만**이다(항상 ≥ 0). 방향은 `direction`(benefit/cost).
 *    명세의 `-1 ~ +1` 슬라이더는 UI 표현이고, 부호를 크기에 섞으면 cost 반전과
 *    이중으로 걸려 조용히 뒤집힌다(CLAUDE.md 규약). 그래서 여기서는
 *    **크기와 방향을 분리해서** 보여준다. 합치지 않는다.
 */
import Link from "next/link";
import { WeightGate } from "@/components/gate/WeightGate";
import { ArtifactView } from "@/components/ui/ArtifactView";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { GATE_WEIGHT, openGate, gateScreen } from "@/lib/omnisite/gate";
import { useRun } from "@/lib/omnisite/RunProvider";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import {
  loadCleanReport,
  loadReport,
  loadReviewed,
  loadWeightSet,
} from "@/lib/omnisite/pipeline";
import { buildDatasetLabels, indicatorLabel } from "@/lib/omnisite/labels";
import { fixed, int, meters, percent } from "@/lib/omnisite/format";
import { SCREENS } from "@/lib/omnisite/screens";
import type {
  CleanReportDoc,
  Indicator,
  ReportDoc,
  ReviewedDoc,
  WeightSetDoc,
  RunDoc,
} from "@/lib/omnisite/types";

const SCREEN = SCREENS.find((s) => s.no === "3")!;

export default function Screen3Page() {
  const { run } = useRun();
  const gate = openGate(run, GATE_WEIGHT);
  const ws = useArtifact<WeightSetDoc>("weight_set", loadWeightSet);
  const reviewed = useArtifact<ReviewedDoc>("reviewed", loadReviewed);
  const clean = useArtifact<CleanReportDoc>("clean_report", loadCleanReport);
  // 후보 필지 수는 weight_set 에도 있지만, 실제 통과 수(survive)는 report 에만 있다.
  const report = useArtifact<ReportDoc>("report", loadReport);

  /**
   * 지표 이름은 게이트B 폼과 아래 표가 **같은 규칙**으로 지어야 한다. 두 곳에서
   * 따로 지으면 같은 지표가 화면 위아래에서 다른 이름으로 불린다.
   * (게이트B 시점에도 `reviewed`·`clean_report` 는 이미 있다 — 실측)
   */
  const labels = buildDatasetLabels(reviewed.data, clean.data);

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="최종 분석에 반영할 지표별 중요도를 설정하는 단계입니다. 지표의 가중치를 조정하여 분석 결과를 세밀하게 제어할 수 있습니다."
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pr-2 mt-4">
        {gate ? (
          <WeightGate gate={gate} runId={run!.run_id} labels={labels} />
        ) : (
          <NoGateNotice run={run ?? null} />
        )}

        {(!gate && run?.status !== "running" && run?.status !== "queued" && !(run?.status === "awaiting_hitl" && run?.gate && run.gate.id !== GATE_WEIGHT)) && (
          <ArtifactView state={ws} what="가중치">
          {(w) => {
            const sorted = [...w.indicators].sort((a, b) => b.w_final - a.w_final);
            const sum = w.indicators.reduce((s, i) => s + i.w_final, 0);
          /**
           * 🔴 `w_final` 은 산출물에 **소수 4자리로 반올림돼** 실린다(실측). 그래서 합에는
           *    지표 수만큼 반올림 오차가 쌓인다 — 실측 6지표에서 0.9999 다.
           *    처음엔 `|합-1| < 1e-6` 으로 봤더니 정상 산출물에 "🔴 정규화가 안 됐다"고
           *    경고를 띄웠다. **틀린 경고도 거짓말**이고, 한 번 겪으면 진짜 경고까지
           *    안 믿게 된다. 허용치는 눈대중 상수가 아니라 표기 자릿수에서 계산한다.
           */
          const sumTol = w.indicators.length * 5e-5; // 지표당 ±0.00005
          const sumOk = Math.abs(sum - 1) <= sumTol;
          const maxFinal = Math.max(...w.indicators.map((i) => i.w_final), 0);

          return (
            <>
              <section className="mt-6 grid gap-4 md:grid-cols-4">
                <Stat label="지표" value={`${w.indicators.length}개`} />
                <Stat
                  label="가중치 합"
                  value={fixed(sum, 4)}
                  note={
                    sumOk
                      ? undefined
                      : `🔴 1 이 아닙니다(오차 ${fixed(Math.abs(sum - 1), 5)} > 반올림 허용 ${fixed(sumTol, 5)}). 정규화가 안 된 상태이거나 지표가 빠졌습니다.`
                  }
                />
                <Stat
                  label="사람 : 데이터"
                  value={`${fixed(1 - w.alpha, 2)} : ${fixed(w.alpha, 2)}`}
                />
                <Stat
                  label="후보 수"
                  value={int(w.n_candidates)}
                  note={report.data ? `점수 산정 후 최종 생존: ${int(report.data.counts.survive)}개` : undefined}
                />
              </section>

              <HitlState hitl={w.hitl} />

              <section className="mt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[14px] font-semibold">지표별 가중치</h2>
                  <p className="text-[11px] text-ink-secondary">
                    가중치가 큰 순. 막대 길이는 <b>최종 가중치(w_final)</b> 기준입니다.
                  </p>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {sorted.map((ind) => (
                    <IndicatorRow
                      key={ind.id}
                      ind={ind}
                      name={indicatorLabel(ind.id, ind.components, labels)}
                      max={maxFinal}
                    />
                  ))}
                </ul>
              </section>

              <Method w={w} />

              <Method w={w} />
            </>
          );
        }}
      </ArtifactView>
      )}
      </div>

      {!gate && run?.status === "succeeded" && (
        <div className="shrink-0 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-emerald-200 bg-emerald-50/30 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-pulse">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-emerald-900">
                  가중치 계산이 완료되었습니다
                </span>
                <span className="text-[13px] text-emerald-700/80">
                  다음 단계에서 후보 위치의 점수를 산정하고 최적 위치를 선정합니다.
                </span>
              </div>
            </div>
            <Link
              href="/sites"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95"
            >
              위치 선정 단계로 이동하기
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      )}

      <PageFooter screen={SCREEN} />
    </PageBody>
  );
}

function IndicatorRow({
  ind,
  name,
  max,
}: {
  ind: Indicator;
  name: string;
  max: number;
}) {
  const pct = max > 0 ? (ind.w_final / max) * 100 : 0;
  const cost = ind.direction === "cost";
  const excluded = ind.sparse_excluded;

  return (
    <li
      className={`group relative overflow-hidden rounded-2xl border transition-all hover:shadow-md ${
        excluded ? "border-gray-200 bg-gray-50/50 opacity-70 grayscale" : "border-gray-200 bg-white hover:border-blue-300"
      }`}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-7 items-center justify-center rounded-lg px-2.5 font-mono text-xs font-bold shadow-sm ${
              excluded ? "bg-gray-200 text-gray-600" : cost ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}>
              {ind.id}
            </span>
            <span className="text-base font-bold text-gray-900 tracking-tight">{name}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                cost ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
              }`}
              title={
                cost
                  ? "cost — 값이 클수록 점수가 낮아집니다(반전 적용)."
                  : "benefit — 값이 클수록 점수가 높아집니다."
              }
            >
              {cost ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12h20"/><path d="m12 5-7 7 7 7"/></svg> 낮을수록 좋음 (cost)</> : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12h20"/><path d="m12 5 7 7-7-7"/></svg> 높을수록 좋음 (benefit)</>}
            </span>
            {excluded && (
              <span className="rounded-full bg-gray-200 px-2 py-1 text-[11px] font-bold text-gray-600">
                희소 제외
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 text-right">
            <span className="text-xs font-bold uppercase text-gray-400">최종 가중치</span>
            <b className={`text-2xl font-black ${excluded ? "text-gray-500" : "text-blue-600"}`}>
              {fixed(ind.w_final, 4)}
            </b>
          </div>
        </div>

        <div className="mt-4 relative h-3.5 w-full overflow-hidden rounded-full bg-gray-100 shadow-inner">
          <div
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${
              excluded
                ? "bg-gray-400"
                : cost
                  ? "bg-gradient-to-r from-red-400 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  : "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cell k="전문가 (w_human)" v={fixed(ind.w_human, 4)} sub={ind.w_human_source} />
          <Cell
            k="데이터 (w_critic)"
            v={fixed(ind.w_critic, 4)}
            sub={
              ind.w_critic_ci
                ? `95% CI ${fixed(ind.w_critic_ci.ci_low, 4)}–${fixed(ind.w_critic_ci.ci_high, 4)}`
                : "CRITIC 미산출"
            }
          />
          <Cell k="집계 반경" v={meters(ind.radius_m)} sub={ind.radius_source} />
          <Cell k="방향 출처" v={ind.direction_source} sub={ind.direction_llm ?? undefined} />
        </div>

        {(ind.direction_conflict || ind.radius_rationale || ind.seed_rationale) && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl bg-gray-50 p-4 border border-gray-100 text-sm">
            {ind.direction_conflict && (
              <p className="flex items-start gap-2 text-amber-800">
                <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                <span><strong>방향 충돌:</strong> {ind.direction_conflict}</span>
              </p>
            )}
            {ind.radius_rationale && (
              <p className="text-gray-600">
                <strong className="text-gray-700">반경 근거:</strong> {ind.radius_rationale}
              </p>
            )}
            {ind.seed_rationale && (
              <p className="text-gray-600">
                <strong className="text-gray-700">가중치 근거:</strong> {ind.seed_rationale}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex flex-col justify-center rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{k}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 font-mono text-sm font-semibold text-gray-900">
        {v}
        {sub && <span className="text-[10px] font-medium text-gray-400">{sub}</span>}
      </dd>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  const isWarn = note ? note.includes("🔴") : false;
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
      isWarn ? "border-red-200 bg-gradient-to-br from-red-50 to-white" : "border-gray-200 bg-gradient-to-br from-gray-50 to-white"
    }`}>
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl ${
        isWarn ? "bg-red-500" : "bg-blue-500"
      }`}></div>
      <div className="relative z-10">
        <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</div>
        <div className={`mt-2 text-3xl font-black tracking-tight ${isWarn ? "text-red-700" : "text-gray-900"}`}>{value}</div>
        {note && <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{note}</p>}
      </div>
    </div>
  );
}

function HitlState({ hitl }: { hitl: WeightSetDoc["hitl"] }) {
  const src = hitl.value_source;
  const trusted = src === "human" || src === "fixture";
  
  // 개발자용 정보가 아닌, 사용자 친화적인 정보만 노출하도록 간소화
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <span className="text-sm font-bold text-gray-700">전문가 개입 여부</span>
        </div>
        <Chip ok={hitl.radius_confirmed} label="집계 반경 [R]" trusted={trusted} />
        <Chip ok={hitl.weight_confirmed} label="가중치 [W]" trusted={trusted} />
      </div>
      
      {!trusted && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5 text-sm text-gray-600 mt-2">
          <svg className="mt-0.5 shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span className="text-[13px] leading-relaxed">
            과거 버전의 분석이거나 자동화된 테스트 모드로 실행되어 전문가의 개입 기록이 없는 결과입니다. 최신 모드로 다시 실행하시면 정확한 개입 기록이 남습니다.
          </span>
        </div>
      )}
    </div>
  );
}

function Chip({ ok, label, trusted }: { ok: boolean; label: string; trusted: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-sm transition-all ${
        !trusted
          ? "bg-gray-100 text-gray-400 line-through decoration-gray-400/50"
          : ok
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-gray-50 text-gray-600 border border-gray-200"
      }`}
    >
      {ok && trusted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      {!ok && trusted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
      {label} {ok && trusted ? "(사람이 확정)" : !trusted ? "" : "(기본값 사용)"}
    </span>
  );
}

function Method({ w }: { w: WeightSetDoc }) {
  const sparse = w.notes.sparse_excluded_ids;
  return (
    <section className="mt-8 grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <h2 className="text-base font-bold text-gray-900">계산 방식 및 환경</h2>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Line k="거리 감쇠" v={`${w.decay.func} · σ비 ${fixed(w.decay.sigma_ratio, 2)}`} />
          <Line k="스케일" v={w.scale} />
          <Line k="데이터 가중" v={w.notes.critic_method} />
          <Line k="희소 임계" v={percent(w.notes.sparse_threshold, 2)} />
          <Line k="엔진" v={w.engine_version} />
          <Line k="생성 시각" v={w.generated_at.replace("T", " ").slice(0, 19)} />
        </dl>
        <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800 border border-blue-100">
          <strong className="block mb-1">가중치의 의미:</strong>
          {w.notes.weight_meaning}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500"><path d="M2 12h20"/><path d="M12 2v20"/></svg>
          <h2 className="text-base font-bold text-gray-900">제외된 지표 (희소 임계 미달)</h2>
        </div>
        {sparse.length > 0 ? (
          <>
            <p className="text-sm leading-relaxed text-gray-600 mb-4">
              값이 거의 없어(희소 임계 {percent(w.notes.sparse_threshold, 2)} 미만) 점수 산정에서 
              제외된 지표들입니다. <strong className="text-gray-800">데이터가 적다는 뜻이며, 중요하지 않다는 의미는 아닙니다.</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {sparse.map((id) => (
                <span
                  key={id}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-sm font-bold text-gray-600 shadow-sm"
                >
                  {id}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 mb-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p className="text-sm font-medium text-gray-400">제외된 지표가 없습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col justify-center rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{k}</dt>
      <dd className="mt-0.5 font-mono text-sm font-bold text-gray-900 truncate" title={v}>{v}</dd>
    </div>
  );
}

/** 게이트가 안 열려 있을 때 **왜 안 열렸는지**를 말한다. 아래 표에 슬라이더가 없는
 *  이유는 "기능이 없어서" 가 아니라 "그 표가 답할 대상이 아니어서" 다. */
function NoGateNotice({ run }: { run: RunDoc | null }) {
  const status = run?.status;

  if (status === "succeeded") {
    return null; // 완료된 경우 산출물(ArtifactView)만 깔끔하게 보여줍니다.
  }
  
  if (status === "running" || status === "queued") {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-blue-50/50 rounded-2xl border border-blue-100 text-center shadow-sm animate-in fade-in zoom-in-95 mt-5">
        <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4" />
        <h3 className="text-base font-bold text-blue-900 mb-1">AI가 다음 분석을 위해 열심히 데이터를 처리하고 있습니다...</h3>
        <p className="text-sm text-blue-700/80">우측의 실시간 분석 모니터링 창을 통해 진행 상황을 확인하실 수 있습니다.</p>
      </div>
    );
  }

  if (status === "awaiting_hitl" && run?.gate) {
    const target = gateScreen(run.gate.id);
    if (target && target.no !== "3") {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 rounded-2xl border-2 border-yellow-300 text-center shadow-sm animate-in fade-in slide-in-from-bottom-4 mt-5">
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-yellow-600"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
          <h3 className="text-base font-bold text-yellow-900 mb-2">다음 단계({target.name}) 분석이 완료되었습니다!</h3>
          <p className="text-sm text-yellow-800/80 mb-5">AI가 다음 단계를 위한 제안을 준비했습니다. 확인을 위해 이동해주세요.</p>
          <Link href={target.path} className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-yellow-900 font-bold text-sm rounded-xl hover:bg-yellow-500 hover:-translate-y-0.5 transition-all shadow-md">
            {target.name} 단계로 바로 이동하기
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      );
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-hairline bg-white px-4 py-3 text-[12px] leading-relaxed text-ink-secondary">
      <p className="font-medium text-ink">
        지금 답할 게이트가 열려 있지 않습니다{status ? ` (상태: ${status})` : ""}.
      </p>
      <p className="mt-1">
        아래 표는 <b>계산이 끝난 최종 가중치</b>(<code>weight_set.json</code>)라서
        슬라이더가 없습니다. 게이트B 가 받는 것은 이 값이 아니라 <b>이 값을 만들어 낸
        앞단의 입력</b>(집계반경 · 슬라이더 <code>-1~+1</code>)이고, 그 입력은 실행이
        게이트에서 <b>멈춰 있는 동안에만</b> 존재합니다.
      </p>
      <p className="mt-1">
        게이트를 세우려면 화면 1 에서 실행을 <code>mode: hitl</code> 로 만드십시오.
        <b> 픽스처(<code>fixture</code>)는 게이트가 서지 않습니다.</b>
      </p>
    </div>
  );
}
