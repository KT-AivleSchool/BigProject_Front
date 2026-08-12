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

import { Suspense, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Swords, Users, ArrowRight, MapPin, CheckCircle2 } from "lucide-react";

import { PageBody, PageHeader } from "@/components/ui/Page";
import { SCREENS } from "@/lib/omnisite/screens";
import { readSitePick, subscribeSitePick, type SitePick } from "@/lib/omnisite/sitePick";
import { readHearingA, readHearingB } from "@/lib/omnisite/hearingResult";
import { useHydrated } from "@/lib/omnisite/useHydrated";

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
      "찬성측과 반대측으로 나뉘어 토론을 진행합니다"
    ],
    saved: "결과가 서버에 저장됩니다 (같은 필지는 최신 1건만 조회됩니다).",
  },
  {
    key: "B" as const,
    path: "/dynamic-hearing",
    title: "다자간 토론",
    tag: "이해관계자 N명",
    icon: Users,
    lines: [
      "선정된 주제와 목적으로 이해관계자를 찾아 다자간 토론을 진행합니다."
    ],
    saved: "결과가 서버에 저장됩니다 (건별로 남아 옛 토론도 다시 볼 수 있습니다).",
  },
];

/**
 * 지금 고른 위치(`pick`)로 **이미 돌린** 토론이 있는가.
 *
 * 🔴 「기록이 있다」가 아니라 **「이 위치의 기록이 있다」**를 묻는다. 앞엣것으로
 *    판정하면 다른 필지에서 돈 토론이 이 위치의 완료 표시가 되고, 아래 자동
 *    이동까지 걸려 **다른 땅의 결과 화면**으로 넘어간다(원칙 4).
 *
 * 대조 재료가 엔진마다 다르다 —
 *   B  기록 자체가 `scope.pnu`·`scope.runId` 를 들고 있다. 둘 다 같아야 한다.
 *   A  기록(`sim_*`)에는 범위가 없다. 대신 화면 5(A)가 토론을 **시작할 때**
 *      `sim_run_id`·`sim_pnu` 를 따로 적어 둔다(`app/hearing/page.tsx:219`).
 *      그 둘이 **아예 없으면** 그 배선이 생기기 전의 옛 기록이라 대조할 방법이
 *      없다 — 그때만 「이 위치의 것」으로 친다. 있는데 다르면 아니다.
 *
 * ⚠ `runId` 가 `null` 인 B 기록은 **안 맞는 것으로 친다.** `isHearingDoneFor`
 *   (`hearingResult.ts`)는 같은 경우를 「끝난 것으로」 치는데, 거긴 진행률
 *   표시이고 여기는 **자동 이동**이라 틀렸을 때 값이 다르다. 여기서 틀리면
 *   사람을 남의 결과 화면에 데려다 놓는다 — 안 맞다고 해도 카드는 눌린다.
 */
function matchExistingHearing(pick: SitePick): { A: boolean; B: boolean } {
  const resB = readHearingB();
  const B = resB !== null && resB.scope.pnu === pick.pnu && resB.scope.runId === pick.run_id;

  let A = false;
  if (readHearingA() !== null && typeof window !== "undefined") {
    const simRunId = window.sessionStorage.getItem("sim_run_id");
    const simPnu = window.sessionStorage.getItem("sim_pnu");
    if (simRunId === null && simPnu === null) {
      A = true; // 범위를 안 남기던 시절의 기록. 대조 불가 — 「있다」까지만 말한다.
    } else {
      A = simRunId === pick.run_id && simPnu === pick.pnu;
    }
  }

  return { A, B };
}

function HearingSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const force = searchParams.get("force") === "true";

  /**
   * 🔴 **`useState` + `useEffect(setState)` 로 읽지 않는다.** 그러면 effect 안의
   *    동기 setState 라 `react-hooks/set-state-in-effect` 를 억제(`eslint-disable`)
   *    해야 하고, 더 나쁜 건 **화면 4 에서 고른 값이 바뀌어도 못 듣는다**는 것이다.
   *    `sitePick.ts` 는 쓰는 쪽이 전부 그 모듈을 거치므로 **값을 구독**할 수 있다.
   *
   *    `undefined` = 아직 안 읽음 · `null` = 고른 적 없음. 서버 스냅샷을
   *    `() => undefined` 로 두어 둘을 갈라둔다 — 섞으면 프리렌더에서 「고른 적 없음」
   *    안내가 한 번 깜빡였다가 사라진다(없는 사실을 잠깐 말하는 것이다).
   */
  const pick = useSyncExternalStore<SitePick | null | undefined>(
    subscribeSitePick,
    readSitePick,
    () => undefined,
  );

  /**
   * 이미 돌린 기록이 있는 방식. 덮어쓰기 전에 알려주려는 것이다.
   *
   * 🔴 이쪽은 **값이 아니라 시점만** 구독한다(`useHydrated`). `hearingResult.ts` 의
   *    `sim_*` 키는 화면 5 가 `sessionStorage.setItem` 으로 **직접** 쓰므로 구독을
   *    걸어도 못 듣는 변경이 생긴다 — 「구독한다」고 해놓고 못 듣는 건 안 듣는 것보다
   *    나쁘다(`useHydrated.ts` 머리말).
   */
  const hydrated = useHydrated();
  const done: { A: boolean; B: boolean } =
    hydrated && pick ? matchExistingHearing(pick) : { A: false, B: false };

  /**
   * 이미 **이 위치로** 돌린 토론이 있으면 그 결과 화면으로 바로 넘긴다.
   *
   * 🔴 이 effect 는 **setState 를 하지 않는다** — 위 두 값은 렌더 중에 읽으므로
   *    여기서 다시 담을 이유가 없다. effect 가 하는 일은 이동 하나뿐이다.
   *
   * 🔴 **`?force=true` 면 안 넘긴다.** 없으면 「같은 위치로 다른 방식을 한 번 더」가
   *    영영 불가능하다 — 이 화면에 들어오는 순간 옛 결과로 튕겨 나간다.
   *    사이드바·탭처럼 **결과를 보러** 오는 경로는 force 없이 오고, 「다시 고르기」
   *    처럼 **새로 돌리러** 오는 경로가 force 를 붙인다.
   */
  useEffect(() => {
    if (!pick || force) return;

    const m = matchExistingHearing(pick);
    // B 를 먼저 본다 — 대조 재료가 확실한 쪽이다(`matchExistingHearing` 머리말).
    if (m.B) {
      router.replace("/dynamic-hearing");
      return;
    }
    if (m.A) {
      router.replace("/hearing");
    }
  }, [pick, force, router]);

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
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
            /**
             * 🔴 **어느 점으로 토론하는지는 반드시 보인다.** 이 화면의 존재 이유가
             *    「방식만 고르고 위치는 이미 정해져 있음」을 밝히는 것이라(머리말 :14)
             *    이 줄을 지우면 사람이 **무엇을 대상으로 토론하는지 모른 채** 시작한다.
             */
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

                {/* 고르기 **전에** 알아야 하는 차이다 — 머리말 :47 이 이 줄을 가리킨다. */}
                <p className="mt-3 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-secondary/80">
                  {m.saved}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-start">
          <Link
            href={SCREEN4.path}
            className="inline-flex items-center justify-center rounded-xl bg-gray-800 px-10 py-3 text-[15px] font-semibold text-white hover:bg-gray-900 transition-colors shadow-md"
          >
            위치선정 다시 하러 가기
          </Link>
        </div>
      </div>
    </PageBody>
  );
}

export default function HearingSelectPage() {
  return (
    <Suspense fallback={<PageBody><div className="p-8 flex justify-center text-gray-500">불러오는 중...</div></PageBody>}>
      <HearingSelectContent />
    </Suspense>
  );
}
