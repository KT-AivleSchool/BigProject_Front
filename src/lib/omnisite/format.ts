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

/**
 * ISO 문자열 → 보는 사람의 로컬 시각.
 *
 * 🔴 **오프셋을 잘라내면 9시간 이른 시각이 뜬다**(2026-08-12 백엔드 실측 정정).
 *    예전 구현은 `v.replace("T"," ").slice(0,19)` 라 `+00:00`·`Z` 를 통째로
 *    버렸다. `run_records.started_at` 은 값(순간)은 옳지만 **표기가 UTC** 다
 *    (DB 세션 TZ 가 `Etc/UTC`) — 19:59:32(KST)에 넣은 run 이
 *    `2026-08-12T10:59:32+00:00` 으로 나온다. 잘라 쓰면 화면에 **10:59:32** 가
 *    뜨는데 **에러가 안 난다**(절대원칙 4).
 *    ⚠ 서버에 `+09:00` 으로 바꿔 달라고 하지 않았다 — 그러면 표기가 서버 TZ 에
 *    묶여 서버를 옮기는 순간 조용히 갈린다. 고칠 자리는 **읽는 쪽**이다.
 *    같은 이유로 `writeHearingB` 의 `savedAt`(`toISOString()` = `Z`)도 여태
 *    9시간 이르게 떠 있었다 — 여기 한 곳을 고치면 같이 낫는다.
 *
 * ⚠ **오프셋이 없는 값도 그대로 옳다.** `status.json` 의 `finished_at` 처럼
 *   오프셋 없는 ISO 는 JS 가 **로컬 시각**으로 파싱하므로(ES2015+) 결과가 안
 *   바뀐다. 두 모양을 갈라 처리할 필요가 없다.
 * ⚠ `toLocaleString` 을 안 쓴다 — 브라우저·로케일마다 모양이 달라져 산출물
 *   문자열이 흔들린다. 자리수는 손으로 맞춘다.
 * ⚠ 못 읽는 문자열은 **지어내지 않고** 받은 것을 그대로 보여준다.
 */
export function datetime(v: string | null | undefined): string {
  if (!v) return DASH;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return v.replace("T", " ").slice(0, 19);
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

export { DASH };
