"use client";

/**
 * 「기록 다시보기」 중임을 알리는 띠.
 * =================================
 * 🔴 **왜 전 화면 공통인가.** 다시보기는 `/report`(화면6)로 들어오지만 사람은
 *    거기서 화면 2·3·4 로 돌아다닌다. 어느 화면에 서 있어도 「지금 보고 있는 건
 *    지난 실행이다」가 보여야 한다 — 한 화면에만 적으면 다른 화면에서는 방금
 *    돌린 결과와 **구분이 안 된다**(서버 응답이 똑같다. `runStore` 주석 참고).
 *
 * 🔴 **나가는 문을 같은 자리에 둔다.** 다시보기 중에는 화면1(데이터 입력)이
 *    잠긴다. 잠긴 이유와 푸는 법이 다른 데 있으면 사람은 「고장났다」고 읽는다.
 *    「나가기」는 `reset()` + `/` 다 — 브라우저 상태만 지운다.
 *
 * 🔴 **헤더의 「데이터 초기화」와 더 이상 같은 동작이 아니다**(2026-08-14).
 *    그쪽은 이제 run 을 취소하고 **올린 파일까지 서버에서 지운다.** 여기서
 *    그러면 안 된다 — 다시보기는 지난 실행을 **보고만** 있는 자리이고, 구경하다
 *    나가는 동작이 남의(혹은 예전) 실행 입력을 지우면 안 된다. 되돌릴 수 없다.
 *    「같은 동작이니 같이 고치자」는 판단이 나오면 **여기부터 읽을 것.**
 *
 * ⚠ 여기서 `clearReviewRunId()` 만 부르면 안 된다. 깃발만 지우면 지난 run 이
 *   **현재 run 인 척** 남고 화면1 잠금만 풀린다 — 그게 다시보기보다 나쁘다.
 */
import { useRouter } from "next/navigation";
import { useRun } from "@/lib/omnisite/RunProvider";
import { datetime } from "@/lib/omnisite/format";

export function ReviewBanner() {
  const { reviewing, run, reset } = useRun();
  const router = useRouter();

  if (!reviewing || !run) return null;

  const leave = () => {
    reset();
    router.push("/");
  };

  return (
    <div className="shrink-0 border-b border-amber-300/70 bg-amber-50/90 backdrop-blur-xl">
      <div className="mx-auto flex h-9 max-w-[1600px] items-center gap-3 px-5 text-[13px] text-amber-900">
        <span className="shrink-0 font-semibold">🕘 기록 다시보기</span>
        <span className="text-amber-800/60">—</span>
        {/* 값이 없으면 `—` 다. 지어내지 않는다(format.ts 규칙). */}
        <span className="truncate">
          {datetime(run.started_at)} · {run.domain} · {run.run_id}
        </span>
        <button
          type="button"
          onClick={leave}
          className="ml-auto shrink-0 rounded-md border border-amber-400 px-2.5 py-1 text-[12px] font-medium text-amber-900 transition hover:bg-amber-100"
          title="다시보기를 끝내고 처음 화면으로 돌아갑니다. 헤더의 「데이터 초기화」와 같습니다."
        >
          나가기
        </button>
      </div>
    </div>
  );
}
