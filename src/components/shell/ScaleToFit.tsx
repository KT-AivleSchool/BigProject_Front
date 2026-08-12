/**
 * 화면 전체를 **기준 해상도(15" · 1512×982) 캔버스**로 놓고, 실제 화면 크기에 맞춰
 * 가로세로 비율을 유지한 채 통째로 줄이거나 키운다.
 *
 * 2026-08-12, 사용자 지시 — "13인치랑 15인치에서 다르게 보인다" 문제를
 * 컴포넌트별 반응형(브레이크포인트마다 폰트·여백 다시 정하기) 대신 이 방식으로
 * 푼다: 안쪽 내용은 **항상 1512×982 라고 믿고** 그리고, 실제 화면 크기에 맞춰
 * `transform: scale()` 로 시각적으로만 조절한다. 그래서
 * - 기존 px 계산(예: 화면1 카드 높이)이 실제 화면 크기와 무관하게 그대로 유효하다.
 * - 색·폰트·간격 값을 단 하나도 안 건드린다(디자인 시스템 금지 원칙과 충돌 없음).
 *
 * 배율은 CSS `min()`/`calc()` 로만 계산한다 — JS 로 리사이즈를 재는 순간 SSR
 * 첫 페인트에는 배율을 모르니(서버는 화면 크기를 모른다) 로드 직후 한 번
 * "커졌다 줄어드는" 깜빡임이 생긴다. CSS 는 브라우저가 페인트 시점에 바로
 * 계산해 그런 깜빡임이 없고, 리사이즈에도 별도 리스너 없이 따라온다.
 *
 * 🔴 **상한(`min(1, …)`)을 두지 않는다**(2026-08-12 사용자 지시로 제거).
 *    기준보다 큰 화면(외부 모니터·프로젝터)에서는 1 을 넘겨 **더 크게** 그린다.
 *    상한이 있으면 큰 화면일수록 가운데 작은 사각형만 쓰고 사방이 여백이 됐다 —
 *    발표를 큰 화면으로 하는 이상 그게 손해다. 글자·아이콘은 벡터라 확대해도
 *    선명하다(래스터 이미지를 넣게 되면 그때는 원본 해상도를 확인할 것).
 *
 * 🔴 캔버스에 `flexShrink: 0` 이 필수다 — 없으면 부모 flex 가 화면이 작을 때
 *    박스 자체를 눌러 찌그러뜨리려 하고, 그러면 안쪽 레이아웃이 진짜로
 *    재계산돼서(우리가 피하려던 바로 그 반응형 리플로우) `scale()` 의 의미가
 *    없어진다. 박스 크기는 절대 안 바뀌고 시각적으로만 줄어야 한다.
 */
export function ScaleToFit({
  baseWidth,
  baseHeight,
  children,
}: {
  baseWidth: number;
  baseHeight: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--canvas-soft)",
      }}
    >
      <div
        style={{
          width: baseWidth,
          height: baseHeight,
          flexShrink: 0,
          // 🔴 나누는 쪽에 `px` 를 꼭 붙인다 — 길이 ÷ 숫자(단위 없음)는 CSS 에서
          //    다시 길이가 된다(숫자가 안 됨). `scale()` 은 숫자만 받으므로
          //    길이 ÷ 길이(둘 다 `px`)라야 나눗셈이 숫자로 떨어진다. 하나라도
          //    단위가 안 맞으면 `min()` 인자 타입이 안 섞여 선언 전체가 무효가
          //    되고, 브라우저는 `transform: none` 으로 조용히 되돌린다(실측 확인).
          transform: `scale(min(calc(100dvw / ${baseWidth}px), calc(100dvh / ${baseHeight}px)))`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
