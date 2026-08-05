/**
 * CSV 파서 (RFC 4180).
 *
 * 왜 `split(",")` 이 아닌가 — 현재 흡연 도메인의 `topN.csv` 에는 따옴표도
 * 쉼표도 없다. 그래서 split 으로도 "지금은" 동작한다. 그런데 `JIBUN` 은
 * 지번 문자열이고 도메인이 바뀌면 `"산 12-3, 12-4"` 같은 값이 들어올 수 있다.
 * 그 순간 열이 하나 밀리고, **터지지 않고 조용히 좌표가 어긋난다.**
 * 이 프로젝트가 계속 당해온 유형이라 처음부터 제대로 읽는다.
 *
 * 라이브러리를 안 쓴 이유: 필요한 건 40줄이고, 의존성 하나가 더 늘면
 * 백엔드와 맞춰 둔 환경 동결이 흔들린다.
 */

/** 헤더를 키로 하는 행 배열. 값은 전부 문자열 — 형변환은 호출자가 한다. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = parseRows(text);
  const header = rows.shift();
  if (!header) return [];

  return rows
    // 마지막 개행이 만든 빈 행을 버린다. 값이 있는 행은 절대 안 버린다.
    .filter((r) => !(r.length === 1 && r[0] === ""))
    .map((r) => {
      if (r.length !== header.length) {
        throw new Error(
          `CSV 열 수가 헤더와 다릅니다: 헤더 ${header.length}개, 행 ${r.length}개 — ${r.join("|")}`,
        );
      }
      const o: Record<string, string> = {};
      header.forEach((h, i) => {
        o[h] = r[i] as string;
      });
      return o;
    });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // CRLF 는 한 번만 끊는다.
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
