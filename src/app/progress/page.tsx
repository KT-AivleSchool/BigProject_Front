"use client";

/**
 * 진행 현황 (화면 번호 없음)
 * ==========================
 * 명세: 「실행을 막지 않는다. 어디까지 갔는지만 보여준다.」
 *
 * 🔴 여기 나오는 `2 · 3-1 · 4-2` 는 **백엔드 STEP 번호**다. 화면 번호가 아니다.
 *    같은 화면에 둘이 다 나오면 반드시 섞이므로, STEP 번호는 회색 배지로
 *    한 번만 쓰고 각주로 못을 박는다.
 *
 * 「실시간 처리 로그」 — 2026-08-05 에 붙었다.
 *   오랫동안 비워 두고 "API 가 로그를 안 낸다"고만 적어 뒀던 자리다. 백엔드가
 *   `GET /runs/{id}/log` 를 냈다(커밋 `836455e`). 없는 문장을 지어내 채우지 않고
 *   기다린 것이 맞았다 — 지금 나오는 것은 진짜 실행 로그다.
 *
 * 🔴 게이트(`awaiting_hitl`) — **끝나지 않았는데 폴링을 멈추는** 상태다.
 *    사람이 답을 주기 전까지 서버가 안 바꾼다(계약 7절). 그래서 이 화면은
 *    "멈춰 있다"와 "끝났다"를 **다르게** 그려야 한다. 진행률 막대만 보면
 *    둘이 똑같이 보이고, 사람은 실행이 끝난 줄 안다.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageBody } from "@/components/ui/Page";
import { NoRun } from "@/components/ui/State";
import { useRun } from "@/lib/omnisite/RunProvider";
import { computeProgress, formatDuration, loadBaseline } from "@/lib/omnisite/progress";
import { fetchRunLog } from "@/lib/omnisite/pipeline";
import { datetime, int, percent } from "@/lib/omnisite/format";
import { SCREENS } from "@/lib/omnisite/screens";
import type { RunDoc, RunStep } from "@/lib/omnisite/types";

export default function ProgressPage() {
  const { run, restoring, runningElapsedSec, refresh } = useRun();

  /**
   * 기준선(직전 성공 실행의 단계별 소요시간)은 localStorage 에 있다.
   *
   * 🔴 `useMemo(() => loadBaseline(), [run?.run_id, run?.status])` 였다.
   *    `loadBaseline()` 은 인자를 안 받으므로 저 의존성은 **memo 를 언제 버릴지
   *    정하는 용도**였고, 린트가 "쓰이지 않는 의존성" 으로 잡는다. 맞는 지적이다 —
   *    실행이 성공하는 순간 `saveBaseline` 이 값을 갈아치우는데, memo 는 그걸
   *    모르고 옛 기준선으로 남은 시간을 계산할 수 있다.
   *    매 렌더 읽는다. 작은 JSON 하나고 이 화면은 1초에 한 번 그린다.
   */
  const baseline = loadBaseline();

  if (restoring) {
    return (
      <PageBody>
        <p className="text-[13px] text-ink-secondary">이전 실행을 확인하는 중…</p>
      </PageBody>
    );
  }
  if (!run) {
    return (
      <PageBody>
        <NoRun />
      </PageBody>
    );
  }

  const p = computeProgress(run, baseline, runningElapsedSec);
  const live = run.status === "queued" || run.status === "running";

  return (
    <PageBody>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">진행 현황</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            실행을 막지 않는다. 어디까지 갔는지만 보여준다.
          </p>
        </div>
        <dl className="flex gap-6 text-[12px]">
          <Meta k="run_id" v={run.run_id} mono />
          <Meta k="도메인" v={run.domain} />
          <Meta k="모드" v={run.mode} />
          <Meta k="시작" v={datetime(run.started_at)} />
          <Meta k="종료" v={datetime(run.finished_at)} />
        </dl>
      </div>

      {/* ── 진행률 ─────────────────────────────────────── */}
      <section className="glass-panel mt-6 rounded-xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            {live && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
            <span className="text-[14px] font-semibold">{statusLabel(run.status)}</span>
          </div>
          <div className="flex items-baseline gap-5 text-[13px] text-ink-secondary">
            <span>
              진행률{" "}
              <b className="tnum text-[18px] text-ink">
                {p.ratio === null ? "—%" : percent(p.ratio, 0)}
              </b>
            </span>
            <span>
              예상 남은 시간 <b className="tnum text-ink">{formatDuration(p.remainSec)}</b>
            </span>
            <span>
              작업 현황{" "}
              <b className="tnum text-ink">
                {p.totalCount}개 중 {p.doneCount}개 완료
              </b>
            </span>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: p.ratio === null ? "0%" : `${p.ratio * 100}%` }}
          />
        </div>

        {p.note && <p className="mt-2 text-[11px] text-ink-secondary">{p.note}</p>}
        <p className="mt-2 text-[11px] text-ink-secondary">
          진행률은 완료 단계 수가 아니라 <b>실측 소요시간 비율</b>입니다. 지난
          완주 실행의 단계별 소요시간을 분모로 씁니다.
        </p>

        {run.status === "failed" && (
          <pre className="mt-3 whitespace-pre-wrap break-all rounded border border-red-200 bg-red-50 p-3 font-mono text-[12px] text-red-800">
            {run.error ?? "(서버가 사유를 남기지 않았습니다)"}
          </pre>
        )}
      </section>

      {run.status === "awaiting_hitl" && <GateBlock run={run} onRefresh={refresh} />}

      {/* ── 단계 ───────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="text-[14px] font-semibold">단계</h2>
        <p className="mt-1 text-[11px] text-ink-secondary">
          <span className="tnum rounded bg-black/[0.06] px-1">2</span> ·{" "}
          <span className="tnum rounded bg-black/[0.06] px-1">3-1</span> 처럼 붙는
          번호는 <b>백엔드 STEP 번호</b>입니다. 상단 내비의 화면 번호(1·2·3…)와
          다른 체계이니 섞어 읽지 마세요.
        </p>
        <ol className="mt-3 flex flex-col gap-1.5">
          {run.steps.map((s) => (
            <StepRow key={s.id} step={s} baselineSec={baseline?.[s.id] ?? null} />
          ))}
        </ol>
      </section>

      {/* ── 확인 요청 / 로그 ────────────────────────────── */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-hairline bg-white p-5">
          <h2 className="text-[14px] font-semibold">확인 요청</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
            감리 확인이 필요한 건은 화면 2 에, 실행이 남긴 미확인 항목(
            <code>data_gap</code>)은 화면 6 에 있습니다. 두 목록은 출처가 달라
            한 화면에 합치지 않았습니다.
          </p>
          <div className="mt-3 flex gap-2">
            <Link href={SCREENS[1]!.path} className="btn-secondary text-[12px]">
              화면 2 · 감리 확인
            </Link>
            <Link href="/report" className="btn-secondary text-[12px]">
              화면 6 · 미확인 항목
            </Link>
          </div>
        </section>

        <LogPanel runId={run.run_id} live={live} />
      </div>

      <p className="mt-6 text-[11px] text-ink-secondary/80">
        읽는 산출물 · GET /api/v1/pipeline/runs/{"{run_id}"} (status.json 원문) ·
        GET /api/v1/pipeline/runs/{"{run_id}"}/log (마스킹된 실행 로그)
      </p>
    </PageBody>
  );
}

/**
 * 게이트 — 실행이 사람을 기다리며 멈춰 있다.
 *
 * 🔴 **답변 UI 를 여기 만들지 않았다.** 이제는 "모른다"가 아니라 **범위 밖**이라서다
 *    — 백엔드가 `POST /runs/{id}/hitl/{audit|weight}` 를 구현·검증했고(2026-08-05)
 *    질문 형태도 계약 7-4 · 7-5 에 실물로 적혀 있다. 다만 1차 목표는 화면 4 까지
 *    돌려 보는 것이고, 게이트 답변은 화면 2 · 3 을 **쓰기 화면으로 바꾸는** 별개
 *    작업이다. 여기(진행 현황)에 축소판 폼을 하나 더 만들면 같은 입력이 두 곳에
 *    생기고 언젠가 갈린다.
 *
 * 🔴 **게이트 이름을 프런트가 갖고 있지 않다.** `gate.label` 을 그대로 쓴다 —
 *    예전엔 `{audit: "게이트A · 감리 확인", …}` 를 여기 박아 뒀는데, 그건 서버가
 *    이미 보내 주는 값을 베껴 둔 것이라 게이트가 늘거나 이름이 바뀌면 조용히
 *    옛 이름을 보여준다(절대원칙 2).
 */
function GateBlock({ run, onRefresh }: { run: RunDoc; onRefresh: () => Promise<void> }) {
  const gate = run.gate;

  return (
    <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-amber-900">
          사람 확인을 기다리는 중입니다 — 실행이 멈춰 있습니다
        </h2>
        <button type="button" onClick={() => void onRefresh()} className="btn-secondary text-[12px]">
          지금 다시 확인
        </button>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-[12px]">
        <div>
          <dt className="text-amber-900/70">게이트</dt>
          <dd className="font-medium text-amber-900">
            {gate ? (
              <>
                {gate.label}{" "}
                <span className="font-normal text-amber-900/60">({gate.id})</span>
              </>
            ) : (
              "서버가 알려주지 않음"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-amber-900/70">확인할 항목</dt>
          <dd className="tnum font-medium text-amber-900">
            {gate ? `${int(gate.questions.length)}건` : "—"}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[12px] leading-relaxed text-amber-900">
        <b>이 화면에서는 답할 수 없습니다.</b> 확정을 되돌려 보내는 API 는 있지만
        (<code>POST …/hitl/{gate?.id ?? "{게이트}"}</code>), 답변 입력은 화면 2(감리
        확인)·화면 3(가중치)이 맡을 자리입니다. 같은 입력을 여기에도 만들면 두 벌이
        생기고 언젠가 서로 다른 값을 보냅니다. 두 화면의 쓰기 기능은 아직입니다.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-amber-900/80">
        멈춰 있는 동안 <b>자동 갱신을 끕니다.</b> 답을 주기 전까지 서버 상태가 바뀌지
        않으므로, 계속 물어보면 아무 일도 안 일어나는 요청만 쌓입니다. 다른 경로로
        답변이 들어갔다면 「지금 다시 확인」을 누르십시오 — 이어서 진행됩니다.
      </p>
    </section>
  );
}

/**
 * 실행 로그.
 *
 * 실행 중에는 폴링하고, 멈추면 한 번만 읽는다. 자동 스크롤은 **실행 중일 때만**
 * 한다 — 끝난 로그를 읽는 사람을 맨 아래로 끌어내리면 읽던 자리를 잃는다.
 */
function LogPanel({ runId, live }: { runId: string; live: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 「다시 읽기」. 값이 아니라 **다시 하라는 신호**라서 숫자를 올린다. */
  const [reloadKey, setReloadKey] = useState(0);
  const preRef = useRef<HTMLPreElement | null>(null);

  /**
   * 🔴 처음엔 `load` 를 `useCallback` 으로 빼고 effect 에서 불렀다가
   *    `react-hooks/set-state-in-effect` 에 걸렸다. 린트가 맞다 — effect 본문에서
   *    이름만 보고는 그게 동기 `setState` 인지 알 수 없다.
   *    `RunProvider` 의 복원 effect 와 **같은 모양**으로 맞췄다: 비동기 함수를
   *    effect 안에 두고 `cancelled` 로 늦게 온 응답을 버린다. run 이 바뀌었는데
   *    옛 run 의 로그가 뒤늦게 도착해 덮어쓰는 사고를 막는다.
   */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const t = await fetchRunLog(runId);
        if (cancelled) return;
        setText(t);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };

    void load();
    if (!live) return () => void (cancelled = true);

    const timer = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runId, live, reloadKey]);

  // 실행 중일 때만 바닥에 붙인다. state 를 안 건드리므로 렌더 루프가 안 생긴다.
  useEffect(() => {
    if (!live || !preRef.current) return;
    preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [text, live]);

  const lines = text === null ? null : text === "" ? 0 : text.split("\n").length;

  return (
    <section className="rounded-xl border border-hairline bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold">실시간 처리 로그</h2>
        <span className="flex items-center gap-2 text-[11px] text-ink-secondary">
          {lines !== null && <span className="tnum">{int(lines)}줄</span>}
          {!live && (
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="btn-secondary text-[11px]"
            >
              다시 읽기
            </button>
          )}
        </span>
      </div>

      {error ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          로그를 읽지 못했습니다 — {error}
        </p>
      ) : text === null ? (
        <p className="mt-2 text-[12px] text-ink-secondary">읽는 중…</p>
      ) : text === "" ? (
        /* 🔴 빈 본문은 오류가 아니다. 서버가 404 대신 200 + 빈 본문을 주기로
           했다 — 404 로 하면 "없는 run" 과 구분이 안 되기 때문이다. */
        <p className="mt-2 text-[12px] text-ink-secondary">
          아직 로그가 없습니다. 실행이 막 시작됐거나 아직 아무것도 출력하지
          않았습니다(빈 응답은 오류가 아닙니다).
        </p>
      ) : (
        <pre
          ref={preRef}
          className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap break-all rounded bg-black/[0.03] p-3 font-mono text-[11px] leading-relaxed text-ink-secondary"
        >
          {text}
        </pre>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary/80">
        🔴 이 로그는 <b>마스킹된 값</b>입니다 — 절대경로는 <code>&lt;repo&gt;</code>·
        <code>&lt;home&gt;</code>, 비밀값은 <code>&lt;마스킹:이름&gt;</code> 으로
        치환돼 나옵니다. 지운 자리에 표시가 남으므로 원본인 척하지 않습니다.
        {live && " 실행 중이라 마지막 줄이 잘려 보일 수 있습니다(파일 락을 걸지 않습니다)."}
      </p>
    </section>
  );
}

function StepRow({ step, baselineSec }: { step: RunStep; baselineSec: number | null }) {
  const tone = {
    done: "border-hairline bg-white",
    running: "border-primary/40 bg-primary/[0.05]",
    failed: "border-red-200 bg-red-50",
    idle: "border-hairline bg-black/[0.02] opacity-60",
  }[step.status];

  return (
    <li className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${tone}`}>
      <span className="tnum shrink-0 rounded bg-black/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
        {step.id}
      </span>
      <span className="flex-1 text-[13px]">{step.label}</span>

      <span className="tnum text-[12px] text-ink-secondary">
        {typeof step.sec === "number" ? (
          `${step.sec.toFixed(2)}초`
        ) : step.status === "done" ? (
          // 🔴 done 인데 sec 이 null 인 것은 **정상**이다(계약 3절: gam4 마커 누락).
          //    "0초"로 찍으면 거짓말이 된다.
          <span title="정상 상태입니다 — 백엔드가 이 단계의 소요시간 마커를 남기지 못했습니다.">
            소요시간 미기록
          </span>
        ) : baselineSec !== null ? (
          <span className="text-ink-secondary/60">지난 실행 {baselineSec.toFixed(1)}초</span>
        ) : (
          "—"
        )}
      </span>

      <span
        className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
          {
            done: "bg-black/[0.06] text-ink-secondary",
            running: "bg-primary text-white",
            failed: "bg-red-600 text-white",
            idle: "bg-black/[0.04] text-ink-secondary",
          }[step.status]
        }`}
      >
        {{ done: "완료", running: "진행 중", failed: "실패", idle: "대기" }[step.status]}
      </span>
    </li>
  );
}

function Meta({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-ink-secondary">{k}</dt>
      <dd className={mono ? "tnum font-medium" : "font-medium"}>{v}</dd>
    </div>
  );
}

function statusLabel(s: string): string {
  return (
    {
      queued: "대기 중",
      running: "진행 중",
      // 🔴 "대기 중"(queued)과 **다른 말**로 적는다. 둘 다 멈춰 있지만 하나는
      //    서버가 곧 집어가고 하나는 사람이 답할 때까지 영영 안 움직인다.
      awaiting_hitl: "사람 확인 대기",
      succeeded: "완료",
      failed: "실패",
    }[s] ?? s
  );
}
