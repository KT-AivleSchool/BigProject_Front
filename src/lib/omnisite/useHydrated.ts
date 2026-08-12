"use client";

/**
 * 「하이드레이션이 끝났는가」 — 렌더 중에 브라우저 저장소를 읽어도 되는 시점.
 * ==========================================================================
 * 서버 프리렌더와 하이드레이션 첫 판에는 `sessionStorage`·`localStorage` 가 없다.
 * 그래서 그 값을 **렌더 중에 읽으면** 서버가 그린 것과 달라져 하이드레이션이
 * 깨진다(2026-08-05 에 한 번 밟은 자리다). 예전 해법은 `useState(초깃값)` +
 * `useEffect(() => setState(읽기), [])` 였는데, 그건 **effect 안의 동기 setState** 라
 * `react-hooks/set-state-in-effect` 가 잡는다.
 *
 * 저장소 자체를 구독할 수 있으면 `useSyncExternalStore` 로 **값을** 구독하는 게 맞다
 * (`sitePick.ts` 가 그렇게 한다). 하지만 쓰는 쪽이 이 모듈을 안 거치는 값이면
 * (예: `hearingResult.ts` 의 `sim_*` 키는 화면 5 가 `sessionStorage.setItem` 으로
 * 직접 쓴다) 구독이 **불완전**해진다 — 「구독한다」고 해놓고 못 듣는 변경이 있는 건
 * 안 듣는 것보다 나쁘다. 그럴 때 쓰는 것이 이 훅이다: 값이 아니라 **시점**만 구독하고,
 * 읽기는 호출부가 렌더 중에 직접 한다.
 *
 * 🔴 구독 함수가 아무도 안 부르는 것이 여기서는 **정직하다.** 「하이드레이션 완료」는
 *    첫 클라이언트 렌더 뒤로 **다시 바뀌지 않는** 값이라 알릴 변경이 애초에 없다.
 *    (같은 모양을 값 구독에 쓰면 그건 거짓말이다.)
 */
import { useSyncExternalStore } from "react";

const NO_CHANGE = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    NO_CHANGE,
    () => true,
    () => false,
  );
}
