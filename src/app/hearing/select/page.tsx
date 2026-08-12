"use client";

/**
 * 화면 5 진입 — **토론 방식 고르기.**
 * ===================================
 * 화면 5 는 토론 방식이 둘이고 백엔드 엔진도 둘로 갈려 있다.
 *   A 대립 토론  `/hearing`          `app/core/sim_ai/`          `/simulations/stream`
 *   B 다인 토론  `/dynamic-hearing`  `app/core/stakeholder_mode/` `/stakeholders/*`
 *
 * 예전엔 화면 4 의 「토론 시작」이 `/hearing` 을 **박아** 두고 있었다(A 고정).
 * 그래서 B 는 URL 을 직접 쳐야 닿았고, 두 화면에 서로를 가리키는 **임시 링크**가
 * 한 개씩 붙어 있었다. 이 화면이 그 자리다 — 임시 링크 두 개는 같이 지웠다.
 *
 * 🔴 **여기서 고르는 건 「방식」뿐이다. 「어디를」은 이미 정해져 있다** —
 *    화면 4 에서 사람이 고른 그 점이고, 이 화면은 그걸 **보여만 준다.**
 *    고칠 수 있게 만들면 선택이 두 곳에서 생기고, 그때 나는 사고는
 *    「화면 4 에서 본 땅과 다른 땅으로 토론이 돌았다」다(원칙 4).
 *
 * 🔴 **후보 조회(`/candidates`)를 여기서 하지 않는다.** PNU 로 잇고 못 이으면
 *    멈추는 규칙은 `useSelectedSite` 한 곳에 있고 두 토론 화면이 그걸 쓴다.
 *    여기서 한 번 더 부르면 같은 규칙이 세 곳이 되고, 한 곳만 고쳐지는 날
 *    화면마다 다른 판정을 낸다. 이 화면은 **화면 4 의 선택이 있는지**만 본다.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Swords, Users, ArrowRight, MapPin, CheckCircle2 } from "lucide-react";

import { PageBody, PageHeader, SourceNote } from "@/components/ui/Page";
import { SCREENS } from "@/lib/omnisite/screens";
import { readSitePick, type SitePick } from "@/lib/omnisite/sitePick";
import { readHearingA, readHearingB } from "@/lib/omnisite/hearingResult";

const SCREEN = SCREENS.find((s) => s.no === "5")!;
const SCREEN4 = SCREENS.find((s) => s.no === "4")!;

/**
 * 두 방식의 설명은 **엔진이 실제로 하는 일**이다. 화면을 팔려고 쓴 문구가 아니다 —
 * 여기서 부풀리면 고른 사람이 안 나오는 결과를 기다린다.
 *
 * `saved` 는 **결과가 서버에 남는지**다. 2026-08-11 로 **둘 다 남는다** — 그전까지
 * B 는 이 탭에만 남았고 카드에도 그렇게 적혀 있었다(그 문구는 이제 지웠다).
 *   A  `conflict_simulations` + `debate_logs` · 조회 `GET /simulations/results/{parcel_id}`
 *   B  `hearing_results_b` · 조회 `GET /simulations/hearings/b/{hearing_id}`
 * 다만 **되찾는 방식이 다르다**: A 는 필지의 **최신 1건**만 조회되고(같은 필지를 여러 번
 * 토론하면 옛 건은 가리킬 URL 이 없다), B 는 건별 id 라 옛 건도 자기 URL 을 갖는다.
 * 고르기 전에 알아야 하는 차이라 카드에 적는다.
 */
const MODES = [
  {
    key: "A" as const,
    path: "/hearing",
    title: "대립 토론",
    tag: "찬성 · 반대",
    icon: Swords,
    lines: [
      "찬성측과 반대측 두 에이전트가 라운드를 주고받습니다.",
      "매 라운드 평가자가 갈등 등급(LOW·MEDIUM·HIGH)과 양측 수용도를 갱신하고, 마지막에 조정 시나리오를 냅니다.",
    ],
    saved: "결과가 서버에 저장됩니다 (같은 필지는 최신 1건만 조회됩니다).",
  },
  {
    key: "B" as const,
    path: "/dynamic-hearing",
    title: "다인(N명) 토론",
    tag: "이해관계자 N명",
    icon: Users,
    lines: [
      "주제와 목적을 입력하면 대상지 주변 이해관계자 페르소나를 발굴합니다.",
      "누구를 참여시킬지 직접 고른 뒤(HITL), 고른 인물들이 각자의 입장에서 발언합니다.",
    ],
    saved: "결과가 서버에 저장됩니다 (건별로 남아 옛 토론도 다시 볼 수 있습니다).",
  },
];

export default function HearingSelectPage() {
  const router = useRouter();

  /** `undefined` = 아직 안 읽음 · `null` = 고른 적 없음. 섞으면 안내가 한 번 깜빡인다. */
  const [pick, setPick] = useState<SitePick | null | undefined>(undefined);
  /** 이미 돌린 기록이 있는 방식. 덮어쓰기 전에 알려주려는 것이다. */
  const [done, setDone] = useState<{ A: boolean; B: boolean }>({ A: false, B: false });

  // 🔴 렌더 중에 sessionStorage 를 읽지 않는다 — 서버 프리렌더엔 없어서
  //    초깃값을 그쪽에서 정하면 하이드레이션이 어긋난다.
  useEffect(() => {
    const currentPick = readSitePick();
    setPick(currentPick);
    
    const resA = readHearingA();
    const resB = readHearingB();
    
    // 현재 고른 위치(currentPick)에 대해 이미 진행된 토론이 있는지 판별
    let matchA = false;
    let matchB = false;
    
    if (currentPick) {
      if (resB && resB.scope.pnu === currentPick.pnu) matchB = true;
      // A 엔진은 pnu나 runId를 모른다. 기록이 있으면 현재 위치의 토론이라고 가정한다.
      if (resA) matchA = true;
    }

    // 이미 진행한 토론이 있다면 해당 결과 화면으로 바로 넘긴다
    if (matchB) {
      router.replace("/dynamic-hearing");
      return;
    } else if (matchA) {
      router.replace("/hearing");
      return;
    }

    setDone({ A: resA !== null, B: resB !== null });
  }, [router]);

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="화면 4 에서 고른 위치로 공청회를 엽니다. 어떤 방식으로 진행할지 먼저 고르세요."
      />

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
        {/* 어느 점으로 토론하는지 먼저 밝힌다. 고른 적이 없으면 여기서 멈춘다. */}
        <div className="mt-5">
          {pick === undefined ? (
            <div className="h-[62px] rounded-xl border border-hairline bg-black/[0.02]" />
          ) : pick === null ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-[13px] font-medium text-amber-900">
                토론할 위치가 정해지지 않았습니다.
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                화면 5 는 화면 4 에서 <strong>사람이 고른 위치</strong>로 토론합니다. 1위 후보를
                대신 넣지 않습니다 — 추천은 추천이고, 어디에 열지는 사람이 정합니다.
              </p>
              <Link
                href={SCREEN4.path}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-900 hover:bg-amber-100"
              >
                {SCREEN4.name} 화면으로 가서 고르기 <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-hairline bg-white px-5 py-4">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <MapPin size={15} className="text-primary" />
                {pick.jibun || "지번 없음"}
              </span>
              <span className="tnum text-[12px] text-ink-secondary">PNU {pick.pnu}</span>
              <span className="tnum rounded-md bg-black/[0.04] px-2 py-0.5 text-[12px] text-ink-secondary">
                화면 4 표의 순위 {pick.rank}
              </span>
              {pick.run_id && (
                <span className="tnum text-[12px] text-ink-secondary/80">
                  고른 실행 {pick.run_id}
                </span>
              )}
              <Link
                href={SCREEN4.path}
                className="ml-auto text-[12px] font-medium text-ink-secondary underline underline-offset-2 hover:text-ink"
              >
                다시 고르기
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            /**
             * 위치를 못 고른 상태에서는 못 들어간다. 들어가도 두 토론 화면이 사유를
             * 띄우고 멈추지만, **누를 수 있게 두면 「눌렀는데 아무 일도 안 난다」**로
             * 읽힌다 — 무엇이 없어서 못 하는지는 이 화면이 이미 위에 적었다.
             */
            const blocked = pick === null;
            return (
              <button
                key={m.key}
                type="button"
                disabled={blocked || pick === undefined}
                onClick={() => router.push(m.path)}
                className={[
                  "group flex flex-col rounded-2xl border p-6 text-left transition-all",
                  blocked || pick === undefined
                    ? "cursor-not-allowed border-hairline bg-black/[0.02] opacity-60"
                    : "border-hairline bg-white hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={22} />
                  </span>
                  {done[m.key] && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-black/[0.03] px-2.5 py-1 text-[11px] font-semibold text-ink-secondary">
                      <CheckCircle2 size={12} /> 이 방식으로 돌린 기록 있음
                    </span>
                  )}
                </div>

                <h2 className="mt-4 text-[17px] font-semibold tracking-tight text-ink">
                  {m.title}
                </h2>
                <span className="mt-1 text-[12px] font-medium text-ink-secondary">{m.tag}</span>

                <div className="mt-3 space-y-1.5">
                  {m.lines.map((l, i) => (
                    <p key={i} className="text-[13px] leading-relaxed text-ink-secondary">
                      {l}
                    </p>
                  ))}
                </div>

                <p className="mt-3 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-secondary/80">
                  {m.saved}
                </p>

                <span
                  className={[
                    "mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold",
                    blocked || pick === undefined ? "text-ink-secondary" : "text-primary",
                  ].join(" ")}
                >
                  이 방식으로 시작
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-[12px] leading-relaxed text-ink-secondary/80">
          두 방식은 <strong>같은 위치</strong>로 각각 돌릴 수 있습니다. 결과는 방식별로 따로
          남고, 화면 6(보고서)은 남아 있는 기록을 <strong>둘 다</strong> 싣습니다.
        </p>
      </div>

      <SourceNote files={["없음 — 화면 4 에서 고른 위치(브라우저 세션)만 읽습니다"]} />
    </PageBody>
  );
}
