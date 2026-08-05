# OmniSite 프런트엔드

B2G 공간의사결정지원(SDSS) — 갈등시설 입지 선정 파이프라인의 화면.
백엔드(`BigProject_Back`)가 만든 산출물을 **읽어서 보여주는 것**이 이 앱의 전부다.

> 이 README 는 **실행 방법**만 적는다.
> 왜 이렇게 만들었는지(설계 결정·되돌린 판단·틀릴 수 있는 지점)는
> `D:\obsidian_claude\10_OmniSite\01_설계결정\프런트_설계.md` 에 있다.

---

## 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

백엔드가 떠 있어야 화면에 값이 나온다. 없으면 각 화면이 **비어 있다고 말한다** —
가짜 값으로 채우지 않는다.

```bash
# 백엔드 (다른 터미널, BigProject_Back 에서)
python -m uvicorn app.main:app --port 8000
```

빌드·검사:

```bash
npm run build        # 타입 검사 포함
npx tsc --noEmit
npm run lint
```

🔴 `npm run dev` 가 떠 있는 채로 `npm run build` 를 돌리면 **둘이 같은 `.next/` 를 쓴다.**
빌드가 dev 산출물을 덮어써서 그 뒤로 dev 서버가 500(`Unexpected token ':'`)을 낸다 —
코드 오류처럼 보이지만 아니다. `.next` 를 지우고 dev 를 다시 띄우면 된다.

🔴 **더 조용한 변종이 있다(실측 2026-08-05).** 서버 컴포넌트/클라이언트 컴포넌트의
**렌더가 한 번 던지면**(예: 지운 변수를 그대로 참조) 소스를 고쳐도 dev 서버가
**클라이언트 부트스트랩을 회복 못 할 수 있다.** 이때 `GET / 200` 이고 화면도
정상으로 보이는데 **하이드레이션이 안 붙어 모든 버튼이 죽어 있다.**
콘솔에는 `[Fast Refresh] performing full reload` 만 반복되고 **에러는 없다**
(SSR 에서 던졌으니 에러는 터미널에만 있다).

진단은 이 한 줄이다 — 버튼을 의심하기 전에 먼저 본다.

```js
Object.keys($0).filter(k => k.startsWith("__react"))   // [] 면 하이드레이션 실패
```

`[]` 라면 그 페이지에서 관찰한 UI 근거는 **전부 무효**다. 다른 라우트를 하나 열어
국소/전역을 가르고, 전역이면 `.next` 삭제 + dev 재시작.

요구 버전: Node 24 / npm 11 에서 실측 확인. Next 16.2.10 · React 19.2.4 · Tailwind 4.

---

## 백엔드 주소 설정

`.env.local` (없으면 `.env.example` 을 복사):

```
OMNISITE_API_ORIGIN=http://127.0.0.1:8000
```

- `NEXT_PUBLIC_` 접두사를 **쓰지 않는다.** 이 값은 브라우저 번들에 들어가면 안 된다.
- 브라우저는 항상 같은 출처(`/api/v1/pipeline/...`)로만 부르고,
  실제 백엔드 주소는 `next.config.ts` 의 rewrite 안에서만 안다.
  백엔드가 다른 호스트로 가도 **프런트 코드는 안 바뀐다.**

---

## 화면

라우트 이름에 **백엔드 STEP 번호(2 · 3-1 · 4-2 …)를 쓰지 않는다.**
화면 번호와 STEP 번호는 다른 체계다 — 섞으면 서로를 가리키는 문서가 전부 틀어진다.

| 화면 | 경로 | 읽는 산출물 | 상태 |
|---|---|---|---|
| 1 데이터 입력 | `/` | (없음) | UI 만. 업로드·감리 API 가 계약에 없다 |
| 진행 현황 | `/progress` | `status.json` · `run.log` | 실동작 (폴링 + 로그) |
| 2 감리 확인 | `/audit` | `reviewed` | 읽기 전용 (게이트A 답변 UI 미구현) |
| 2b 배제 근거 | `/audit/exclusion` | `reviewed` · `clean_report` · `report` · `exclusion` | 실동작 |
| 3 가중치 | `/weights` | `weight_set` · `report` | 읽기 전용 (게이트B 답변 UI 미구현) |
| 4 위치 선정 | `/sites` | `score_grid` · `topN` · `report` | **완료** — 명세 v7 8쪽 항목별 대조 |
| 5 갈등 예측 | `/hearing` | (없음) | 스텁. 서버 미연결 · **담당 인계** |
| 6 보고서 | `/report` | `report` · `topN` · `clean_report` | 실동작 · **담당 인계** |

✅ **화면 1 → 진행 현황 → 2 · 2b · 3 · 4 완주 확인** (2026-08-05, 사람 확인).
`r_20260805_005` 약 82초 · `r_20260805_006` 산출물 8/8. 실행은 전부 HTTP API 로 만들었다.

🔴 **1차 목표는 화면 4 까지다** (2026-08-05). 화면 5·6 은 백엔드·프런트 양쪽 다
팀원 담당이다. 이 저장소는 두 화면의 **자리와 배선점만 만들어 두었다** —
화면 4 하단 「갈등 예측 실행 (미배선)」 버튼의 `disabled` 를 떼고 `onClick` 을 달면
된다(넘길 `PNU`·좌표는 이미 `selected` 상태에 있다). 인계 내용은
[[프런트_설계]] §17.4.

---

## API

`pipeline_run_contract.md` 가 유일한 기준이다. 계약에 없는 경로를 프런트가 먼저 부르지 않는다.

**지금 부르는 것 — 네 개.**

| 메서드 | 경로 | 용도 |
|---|---|---|
| POST | `/api/v1/pipeline/runs` | 실행 생성 → `202 {run_id}` |
| GET | `/api/v1/pipeline/runs/{run_id}` | 상태 조회. `failed` 도 **HTTP 200** 이다 |
| GET | `/api/v1/pipeline/runs/{run_id}/artifacts/{name}` | 산출물 |
| GET | `/api/v1/pipeline/runs/{run_id}/log[?tail=N]` | 실행 로그 (백엔드 `836455e`) |

**있는데 아직 안 부르는 것 — 두 개** (백엔드 구현·검증 완료 2026-08-05, 계약 7절).

| 메서드 | 경로 | 용도 |
|---|---|---|
| POST | `/api/v1/pipeline/runs/{run_id}/hitl/audit` | 게이트A 답변 |
| POST | `/api/v1/pipeline/runs/{run_id}/hitl/weight` | 게이트B 답변 |

부를 화면이 없어서 **클라이언트 함수도 만들지 않았다**(`pipeline.ts` 에 사유와 주의점).
안 쓰이는 함수를 미리 두면 다음 사람이 "배선이 끝났다"고 읽는다.

산출물 화이트리스트 8종 — `reviewed` · `clean_report` · `candidates` · `weight_set` ·
`report` · `topN` · `exclusion` · `score_grid`.

🔴 `exclusion` 은 나중에 올라갔다(백엔드 커밋 `ea4bef3`, 2026-08-04). **그 이전에 만든
run 의 `status.json` 에는 이 키가 없다** — 산출물 목록은 run 생성 시점에 굳는다.
그래서 옛 run 을 열면 화면 2b 의 「최종 판정」 열이 `—` 로 남고, 화면이 그 사유를 적는다.
감리값(`exclusion_type`)으로 대신 채우지 않는다 — 그건 제안이지 판정이 아니다.

🔴 **`/log` 응답만 "가공하지 않고 그대로" 의 예외다.** 절대경로·계정명·API 키가
`<repo>` · `<home>` · `<마스킹:이름>` 으로 **마스킹**돼 나온다. 로그가 없으면
404 가 아니라 **200 + 빈 본문**(빈 문자열을 오류로 읽지 않는다), `tail=0` 은 **422**
(전체가 아니다 — 전체를 원하면 생략), 락을 안 걸어 **마지막 줄이 잘릴 수 있다.**

**없는 것:** 업로드 · 감리 실행 · 실행 목록 · 시뮬레이션.
그래서 해당 화면은 비워 두고 **왜 비었는지 화면에 적는다.**

🔴 **`/api/v1/audit/*` 는 화면 2 의 감리가 아니다 — 이름만 같다.** 실제로 서버에
등록돼 있고(`app/main.py:92-94`) 살아 있지만, 내용은 **준공 공문 PDF OCR + RAG
실사례 분류**(`POST /verify`)와 **검증 판례 저장**(`POST /save`)이다. 작성자도
다르고(`audit.py` docstring), `Depends(get_db)` 로 DB 가 필요하며,
`next.config.ts` 의 rewrite 가 `/api/v1/pipeline/*` 하나뿐이라 **브라우저에서
닿지도 않는다.** 경로 이름만 보고 "감리 API 가 있네" 라고 읽으면 안 된다.
화면 2 의 감리(STEP1)를 도는 HTTP 경로는 **여전히 없다.**

## HITL 은 게이트다 — 고쳐서 재실행하는 게 아니다

`queued → running → awaiting_hitl → running → … → succeeded | failed`

게이트는 **두 곳뿐**이다 — **게이트A**(감리 확정) · **게이트B**(집계반경 · 가중치).
`gate` 키는 `awaiting_hitl` 일 때만 붙고 그 외엔 **키 자체가 없다**(`null` 이 아니다).

실행 계획(계약 7-1):

```
mode: fixture   2 · 3-1 · 3-2 · 4                              게이트 없음 — 무입력 완주
mode: hitl      ⏸audit · 2 · 3-1 · propose · ⏸weight · 3-2 · 4
```

- 🔴 **게이트A 는 실행의 맨 앞이다.** 확정 대상은 STEP1(감리) 결과지만 STEP1 자체는
  이 run 이 돌리지 않는다. 그래서 게이트A 에서 멈춘 run 은 **단계가 하나도 시작되지
  않은 상태**로 보인다 — 고장이 아니다.
- 🔴 **프런트는 `fixture` 만 만든다.** `hitl` 로 시작하면 곧바로 게이트A 에서 멈추는데
  답을 보낼 화면이 아직 없어 그 run 은 영영 안 끝난다.
- 🔴 **`awaiting_hitl` 에서 폴링을 멈춘다.** 서버는 사람이 답할 때까지 **영영** 안 움직인다.
  `isLive()` 를 `!isFinished` 로 고쳐 쓰면 그 즉시 무한 폴링이다.
- 🔴 **확정은 게이트 단위 배치**다. 1건씩 보내면 전 슬라이더 합계 검증이 불가능해지고,
  검증이 빠지면 전 후보 점수가 0 이 된다(백엔드 실제 사고).
- 🔴 **화면 2b 에 「뒤집기」 버튼을 붙이지 않는다.** 점·면 판정은 **STEP4** 에서 계산돼
  두 게이트를 다 지난 뒤에 생긴다 — 되돌려 보낼 게이트가 없다. 표가 다 그려져 있어
  "버튼만 붙이면 된다"고 읽히는 자리라 코드에도 주석을 박아 뒀다.
- `gate.questions[]` 는 평평한 배열이고 원소마다 `kind` 가 있다(게이트A `exclusion` ·
  `intent` · `code_prefix`, 게이트B `weight`). 흡연 픽스처 실측 A 4건 · B 6건.
  타입은 **일부러** `unknown[]` 로 뒀다 — 읽는 코드가 한 줄도 없어서다. 답변 화면을
  만들 때 계약 7-4 · 7-5 를 보고 필요한 만큼만 적을 것.

답변을 보낼 때의 함정은 `src/lib/omnisite/pipeline.ts` 헤더에 모아 뒀다
(본문 `run_id` 필수 · `radius_m: null` ≠ 키 생략 · 슬라이더는 `-1~+1` 그대로 · 409 = 점유).

---

## api-samples/

실제 응답 실물(run `r_20260804_003`)을 그대로 보관한 폴더다. 타입은 여기서 뽑았다.

🔴 **`src/` 밖에 둔다. import 가 불가능해야 한다** — API 가 죽었을 때 조용히
샘플로 떨어지는 코드를 애초에 못 쓰게 만든다.

---

## 지도

외부 지도 라이브러리를 쓰지 않는다. `src/components/map/GridMap.tsx` 가 canvas 로 직접 그린다.
배경 타일은 **꺼도 되고**, 타일을 못 받으면 그 사실을 화면에 표시한다 —
격자와 후보지는 타일 없이도 정확하다(좌표는 산출물에서 온다).

---

## 설치돼 있지만 안 쓰는 패키지

지우지 않은 이유를 적어 둔다. 이유가 사라지면 지울 것.

- `@microsoft/fetch-event-source` — 화면 5 용. 시뮬레이션이 POST + 스트림이라
  `EventSource`(GET 전용)로는 안 된다. 서버가 열리면 쓴다.
- `jspdf` — 화면 6 은 `window.print()` 를 쓴다. canvas PDF 는 글자를 이미지로 만들고
  한글 폰트를 따로 실어야 한다.
- `driver.js` · `lightningcss` — 이전 구현의 잔재. 참조하는 코드가 없다.
