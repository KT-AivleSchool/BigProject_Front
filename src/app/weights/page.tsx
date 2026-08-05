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
import { WeightGate } from "@/components/gate/WeightGate";
import { ArtifactView } from "@/components/ui/ArtifactView";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { GATE_WEIGHT, openGate } from "@/lib/omnisite/gate";
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
        lead="무엇을 중요하게 볼지 사람이 정한다. 여기서 정한 값이 점수의 분모다."
      />

      {gate ? (
        <WeightGate gate={gate} runId={run!.run_id} labels={labels} />
      ) : (
        <NoGateNotice status={run?.status ?? null} />
      )}

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
                <Stat label="지표" value={`${w.indicators.length}개`} note="점수를 만드는 축의 수." />
                <Stat
                  label="가중치 합"
                  value={fixed(sum, 4)}
                  note={
                    sumOk
                      ? `1 로 정규화돼 있습니다. (표기가 소수 4자리라 합이 정확히 1 은 아닙니다 — 허용 ±${fixed(sumTol, 5)})`
                      : `🔴 1 이 아닙니다(오차 ${fixed(Math.abs(sum - 1), 5)} > 반올림 허용 ${fixed(sumTol, 5)}). 정규화가 안 된 상태이거나 지표가 빠졌습니다.`
                  }
                />
                <Stat
                  label="사람 : 데이터"
                  value={`${fixed(1 - w.alpha, 2)} : ${fixed(w.alpha, 2)}`}
                  note={`w_final = (1-α)·w_human + α·w_critic, α=${fixed(w.alpha, 2)}. α 가 클수록 데이터(CRITIC)가 이깁니다.`}
                />
                {/* `candidate_unit` 은 단위 명사가 아니라 설명 문장이다(실측:
                    "candidates 레이어 1행 (Point)"). 숫자 뒤에 붙이면 "42,216 candidates
                    레이어 1행 (Point)" 처럼 읽힌다. 숫자는 숫자대로, 설명은 설명줄로 뺀다. */}
                <Stat
                  label="후보"
                  value={int(w.n_candidates)}
                  note={
                    `1개 = ${w.candidate_unit}.` +
                    (report.data ? ` 점수화 후 생존 ${int(report.data.counts.survive)}개 (화면 4)` : "")
                  }
                />
              </section>

              <HitlState hitl={w.hitl} />

              <section className="mt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[14px] font-semibold">지표별 가중치</h2>
                  <p className="text-[11px] text-ink-secondary">
                    가중치가 큰 순. 막대 길이는 <b>w_final</b> 기준입니다.
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
            </>
          );
        }}
      </ArtifactView>

      <PageFooter screen={SCREEN} />
      <SourceNote
        files={[
          "status.json 의 gate (게이트B)",
          "weight_set.json",
          "reviewed.json · clean_report.json (지표 이름)",
        ]}
      />
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

  return (
    <li
      className={`rounded-lg border p-4 ${
        ind.sparse_excluded ? "border-hairline bg-black/[0.02] opacity-70" : "border-hairline bg-white"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="tnum rounded bg-black/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
            {ind.id}
          </span>
          <span className="text-[14px] font-medium">{name}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
              cost ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
            title={
              cost
                ? "cost — 값이 클수록 점수가 낮아집니다(반전 적용)."
                : "benefit — 값이 클수록 점수가 높아집니다."
            }
          >
            {cost ? "낮을수록 좋음 (cost)" : "높을수록 좋음 (benefit)"}
          </span>
          {ind.sparse_excluded && (
            <span className="rounded bg-black/[0.06] px-1.5 py-0.5 text-[11px] text-ink-secondary">
              희소로 제외됨
            </span>
          )}
        </div>
        <div className="tnum text-[13px]">
          <b className="text-[16px]">{fixed(ind.w_final, 4)}</b>
          <span className="ml-1 text-[11px] text-ink-secondary">w_final</span>
        </div>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className={`h-full rounded-full ${cost ? "bg-red-400" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
        <Cell k="사람 w_human" v={fixed(ind.w_human, 4)} sub={ind.w_human_source} />
        {/* 🔴 희소 제외 지표는 w_critic·CI 가 **null 이다**(실측 09).
            없는 값을 0 으로 찍으면 "데이터가 0 이라고 판단했다"는 거짓말이 된다. */}
        <Cell
          k="데이터 w_critic"
          v={fixed(ind.w_critic, 4)}
          sub={
            ind.w_critic_ci
              ? `95% CI ${fixed(ind.w_critic_ci.ci_low, 4)}–${fixed(ind.w_critic_ci.ci_high, 4)}`
              : "CRITIC 미산출"
          }
        />
        <Cell k="집계 반경" v={meters(ind.radius_m)} sub={ind.radius_source} />
        <Cell k="방향 출처" v={ind.direction_source} sub={ind.direction_llm ?? undefined} />
      </dl>

      {ind.direction_conflict && (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          방향 충돌: {ind.direction_conflict}
        </p>
      )}
      {ind.radius_rationale && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
          반경 근거 · {ind.radius_rationale}
        </p>
      )}
      {ind.seed_rationale && (
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
          가중치 근거 · {ind.seed_rationale}
        </p>
      )}
    </li>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-secondary">{k}</dt>
      <dd className="tnum font-medium">
        {v}
        {sub && <span className="ml-1 text-[11px] font-normal text-ink-secondary">{sub}</span>}
      </dd>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="text-[12px] text-ink-secondary">{label}</div>
      <div className="tnum mt-1 text-[20px] font-semibold">{value}</div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary">{note}</p>
    </div>
  );
}

function HitlState({ hitl }: { hitl: WeightSetDoc["hitl"] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
      <Chip ok={hitl.radius_confirmed} label="집계 반경 [R]" />
      <Chip ok={hitl.weight_confirmed} label="가중치 [W]" />
      <span className="self-center text-[11px] text-ink-secondary">
        산출물의 <code>hitl</code> 값 그대로입니다. 이 화면에서 바꿀 수 없습니다.
      </span>
    </div>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-md px-2 py-1 font-medium ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
      }`}
    >
      {label} {ok ? "사람이 확정함" : "미확정 (엔진 기본값 사용)"}
    </span>
  );
}

function Method({ w }: { w: WeightSetDoc }) {
  const sparse = w.notes.sparse_excluded_ids;
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-hairline bg-white p-5">
        <h2 className="text-[14px] font-semibold">계산 방식</h2>
        <dl className="mt-3 flex flex-col gap-1.5 text-[12px]">
          <Line k="거리 감쇠" v={`${w.decay.func} · σ비 ${fixed(w.decay.sigma_ratio, 2)}`} />
          <Line k="스케일" v={w.scale} />
          <Line k="데이터 가중" v={w.notes.critic_method} />
          <Line k="희소 임계" v={percent(w.notes.sparse_threshold, 2)} />
          <Line k="엔진" v={w.engine_version} />
          <Line k="생성 시각" v={w.generated_at.replace("T", " ").slice(0, 19)} />
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-secondary">
          {w.notes.weight_meaning}
        </p>
      </div>

      <div className="rounded-xl border border-hairline bg-white p-5">
        <h2 className="text-[14px] font-semibold">제외된 지표</h2>
        {sparse.length > 0 ? (
          <>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
              값이 거의 없어(희소 임계 {percent(w.notes.sparse_threshold, 2)} 미만) 점수에서
              빠진 지표입니다. 데이터가 없다는 뜻이지 중요하지 않다는 뜻이 아닙니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sparse.map((id) => (
                <span
                  key={id}
                  className="tnum rounded bg-black/[0.06] px-2 py-1 text-[12px] text-ink-secondary"
                >
                  {id}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[12px] text-ink-secondary">없습니다.</p>
        )}
      </div>
    </section>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-secondary">{k}</dt>
      <dd className="tnum font-medium">{v}</dd>
    </div>
  );
}

/** 게이트가 안 열려 있을 때 **왜 안 열렸는지**를 말한다. 아래 표에 슬라이더가 없는
 *  이유는 "기능이 없어서" 가 아니라 "그 표가 답할 대상이 아니어서" 다. */
function NoGateNotice({ status }: { status: string | null }) {
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
