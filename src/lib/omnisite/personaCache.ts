/**
 * 화면 5-B(다인 토론) 페르소나 보관.
 * =================================
 * 페르소나 발굴은 LLM 호출이라 되돌릴 때마다 돈이 든다. 그래서 캐시가 있는 것
 * 자체는 맞다. 문제는 **무엇의 캐시인가** 였다.
 *
 * 예전 구현은 `localStorage["personas_" + topic]` 이었다. 네 가지가 걸린다 —
 *
 *  ⓐ **키가 주제뿐이다.** 페르소나는 주제만으로 나오지 않는다. 백엔드
 *     `/stakeholders/generate` 는 위치·조례 문맥을 다 프롬프트에 넣는다
 *     (`discovery_prompt.py:13-14`). 주제를 그대로 두고 **화면 4 에서 다른
 *     필지를 고르면**, 그 위치로 뽑은 적 없는 페르소나가 캐시에서 그대로
 *     나온다. 안 터지고 값만 남의 것이 된다.
 *     🔴 2026-08-11 부터 그 문맥은 프런트가 안 보낸다 — 요청은 `parcel_id`·
 *        `topic`·`purpose` 셋뿐이고 **서버가 `parcel_id` 로 조달한다**. 캐시
 *        키 얘기는 그대로 유효하다: 조달의 입력이 곧 `parcel_id`(≡ PNU)라서
 *        범위에 위치가 들어가야 하는 이유는 오히려 더 분명해졌다.
 *  ⓑ **`localStorage` 라 영원히 산다.** 화면 4 선택(`sitePick`)·화면 5-A 대화
 *     (`sim_*`)는 전부 `sessionStorage` 다. 수명이 다르면 탭을 닫았다 열었을 때
 *     **위치는 초기화됐는데 페르소나만 남는다.**
 *  ⓒ **버전이 없다.** 모양을 바꾸면 옛 값이 그대로 읽힌다.
 *  ⓓ **읽을 때 모양을 안 본다.** `parsedCache.length > 0` 만 보고 바로 그렸다 —
 *     배열이 아니면 `.length` 는 `undefined` 라 조용히 넘어가고, 배열이기만 하면
 *     내용이 뭐든 화면으로 간다.
 *
 * 그래서 `sitePick.ts` 와 **같은 규약**으로 맞춘다: 버전 붙인 키 · sessionStorage ·
 * 읽을 때 모양 검사 · 안 맞으면 없는 셈. 여기에 **범위(scope)** 를 더 얹는다 —
 * 저장할 때의 (도메인 · 적재 run · PNU · 주제 · 목적)이 지금과 다르면 남의 값이다.
 */
const KEY = "omnisite.personas.v1";

/**
 * 화면이 그리는 페르소나 1건. `/generate` 응답을 화면 모양으로 접은 것이다.
 *
 * 🔴 **필드 이름을 마음대로 짓지 않는다.** 이 다섯은 `/dynamic/discuss/stream` 이
 *    되읽는 이름이다(`stakeholders.py:64-72`): `name→display_name` ·
 *    `role→stakeholder_type` · `description→relationship_to_topic` ·
 *    `importance_grade` · `keywords→interests`. 그래서 `description` 에는
 *    `relationship_to_topic`(주제와의 이해관계)이 들어가야 왕복이 맞는다 —
 *    보기 좋다고 `recommendation_reason` 을 넣으면 토론 프롬프트의
 *    「이해관계」 자리에 「추천 사유」가 들어간다.
 *
 * `reason` 은 왕복하지 않는다. 사람이 고를 때 보라고 화면에만 남긴다.
 * 응답의 나머지(`evidence_confidence`·`related_candidate_ids`·`evidence_ids`)는
 * 쓰는 곳이 없어 **버린다** — 안 쓰는 값을 들고 다니면 쓰이는 줄 알게 된다.
 */
export interface Persona {
  role: string;
  name: string;
  description: string;
  importance_grade: string;
  keywords: string[];
  /** 추천 근거. 화면 표시 전용 — 백엔드로 되돌려 보내지 않는다. */
  reason: string;
}

/**
 * 이 페르소나들이 **무엇으로 뽑힌 것인지**. 하나라도 다르면 재사용하지 않는다.
 * 위치를 통째로 넣지 않고 `pnu` 만 넣는 이유: 좌표·지번은 PNU 를 따라오므로
 * PNU 가 같으면 같은 땅이다(`sitePick.ts` 와 같은 판단).
 */
export interface PersonaScope {
  domain: string;
  runId: string | null;
  pnu: string;
  topic: string;
  purpose: string;
}

interface StoredPersonas {
  scope: PersonaScope;
  personas: Persona[];
}

function sameScope(a: PersonaScope, b: PersonaScope): boolean {
  return (
    a.domain === b.domain &&
    a.runId === b.runId &&
    a.pnu === b.pnu &&
    a.topic === b.topic &&
    a.purpose === b.purpose
  );
}

function isPersona(v: unknown): v is Persona {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Persona;
  return (
    typeof p.role === "string" &&
    typeof p.name === "string" &&
    typeof p.description === "string" &&
    typeof p.importance_grade === "string" &&
    typeof p.reason === "string" &&
    Array.isArray(p.keywords)
  );
}

/** 범위가 지금과 같을 때만 돌려준다. 아니면 `null` — 「없음」과 「남의 것」을 같게 취급한다. */
export function readPersonas(scope: PersonaScope): Persona[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return null;
    const s = v as StoredPersonas;
    if (typeof s.scope !== "object" || s.scope === null) return null;
    if (!sameScope(s.scope, scope)) return null;
    // 저장소 값은 주장일 뿐이다(수기 편집·옛 버전). 한 건이라도 모양이 안 맞으면 통째로 버린다.
    if (!Array.isArray(s.personas) || s.personas.length === 0) return null;
    if (!s.personas.every(isPersona)) return null;
    return s.personas;
  } catch {
    return null;
  }
}

export function writePersonas(scope: PersonaScope, personas: Persona[]): void {
  if (typeof window === "undefined") return;
  const payload: StoredPersonas = { scope, personas };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /**
     * 용량 초과(QuotaExceededError). **던지지 않는다** — 캐시는 부가 기능이고,
     * 여기서 던지면 이미 받아 놓은 페르소나까지 화면에서 사라진다. 대신
     * 다음 읽기가 `null` 이 되어 다시 발굴할 뿐이다(느려질 뿐 틀리지 않는다).
     */
  }
}

export function clearPersonas(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
