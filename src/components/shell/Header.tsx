"use client";

/**
 * 상단 셸 — 로고 · 6단계 내비 · 실행 상태.
 *
 * 내비에는 **화면 번호**만 나온다. STEP 번호는 여기 절대 안 들어온다.
 * 완료 표시(✓)의 기준은 "그 화면이 읽을 산출물이 run 에 있는가" 다 —
 * 사용자가 방문했는지가 아니라 데이터가 있는지로 판단한다.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SCREENS, PROGRESS_PATH, screenOf } from "@/lib/omnisite/screens";
import { useRun } from "@/lib/omnisite/RunProvider";
import type { ArtifactName, RunDoc } from "@/lib/omnisite/types";

/** 화면 → 그 화면이 살아 있으려면 있어야 하는 산출물. 없으면 아직 미완이다. */
const NEEDS: Record<string, ArtifactName[]> = {
  "1": [],
  "2": ["reviewed"],
  "3": ["weight_set"],
  "4": ["score_grid", "topN"],
  "5": [], // 파이프라인 밖 — 산출물로 판정하지 않는다
  "6": ["report"],
};

function ready(run: RunDoc | null, no: string): boolean {
  if (!run) return false;
  const need = NEEDS[no];
  if (!need || need.length === 0) return false;
  return need.every((n) => Boolean(run.artifacts[n]));
}

export function Header() {
  const pathname = usePathname();
  const { run } = useRun();
  const current = screenOf(pathname);
  const live = run?.status === "queued" || run?.status === "running";

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-glass-mid backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-5">
        <Link href="/" className="flex shrink-0 items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight">OmniSite</span>
          <span className="text-[11px] text-ink-secondary">B2G SDSS</span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV_SCREENS.map((s, i) => {
            const active = current?.no === s.no;
            const done = ready(run, s.no) && !active;
            return (
              <div key={s.no} className="flex shrink-0 items-center">
                {i > 0 && <span className="px-1 text-ink-secondary/40">›</span>}
                <Link
                  href={s.path}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-primary text-white"
                      : "text-ink-secondary hover:bg-black/[0.04] hover:text-ink",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                      active
                        ? "bg-white/25 text-white"
                        : done
                          ? "bg-primary/12 text-primary"
                          : "bg-black/[0.06] text-ink-secondary",
                    ].join(" ")}
                  >
                    {done ? "✓" : s.no}
                  </span>
                  <span className="whitespace-nowrap">{s.name}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <Link
          href={PROGRESS_PATH}
          className="flex shrink-0 items-center gap-2 rounded-md border border-hairline bg-white px-3 py-1.5 text-[12px] text-ink-secondary transition-colors hover:text-ink"
        >
          {live && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          )}
          {run ? (
            <>
              <span className="tnum">{run.run_id}</span>
              <span className="text-ink-secondary/60">·</span>
              <span>{statusText(run.status)}</span>
            </>
          ) : (
            <span>실행 없음</span>
          )}
        </Link>
      </div>
    </header>
  );
}

function statusText(s: RunDoc["status"]): string {
  // 상태값을 한글로 바꾸되 의미를 보태지 않는다. failed 를 "오류"로 순화하지 않는다.
  //
  // 🔴 `awaiting_hitl` 을 "대기" 라고 쓰면 `queued` 와 같은 말이 된다. 둘 다 멈춰
  //    있지만 `queued` 는 서버가 곧 집어가고 이쪽은 **사람이 답할 때까지 영영**
  //    안 움직인다. 상단 배지는 좁아서 줄이고 싶어지는 자리인데, 여기서 줄이면
  //    사람이 실행이 알아서 굴러가는 줄 알고 기다린다.
  return {
    queued: "대기",
    running: "진행 중",
    awaiting_hitl: "확인 대기",
    succeeded: "완료",
    failed: "실패",
  }[s];
}
