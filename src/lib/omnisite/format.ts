/**
 * 표시 포맷.
 *
 * 규칙 하나: **값이 없으면 `—` 다.** 0 이 아니다.
 * 명세가 자리표시자를 `—` · `0.000` · `N` 으로 정한 이유가, "아직 모른다"와
 * "계산해 보니 0 이다"를 화면에서 구분하기 위해서다. 없는 값을 0 으로 찍으면
 * 그건 산출물이 거짓말하는 것과 같다(절대원칙 4).
 */

const DASH = "—";

export function fixed(v: number | null | undefined, digits: number): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : DASH;
}

export function int(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.round(v).toLocaleString("ko-KR")
    : DASH;
}

export function percent(v: number | null | undefined, digits = 1): string {
  return typeof v === "number" && Number.isFinite(v)
    ? `${(v * 100).toFixed(digits)}%`
    : DASH;
}

/** 미터. 법정 배제 반경은 실값을 쓴다(명세 예외 규정). */
export function meters(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? `${int(v)}m` : DASH;
}

export function areaM2(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? `${int(v)} ㎡` : DASH;
}

export function km2(v: number | null | undefined, digits = 4): string {
  return typeof v === "number" && Number.isFinite(v)
    ? `${v.toFixed(digits)} km²`
    : DASH;
}

/** 서버가 준 ISO 문자열. 타임존이 없으므로 붙이지 않는다 — 로컬 시각으로 읽는다. */
export function datetime(v: string | null | undefined): string {
  if (!v) return DASH;
  return v.replace("T", " ").slice(0, 19);
}

export { DASH };
