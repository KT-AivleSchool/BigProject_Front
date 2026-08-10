"use client";

/**
 * 화면 5 · 갈등 예측 — **스텁이다.**
 * ==================================
 * 명세는 다중에이전트 공청회 시뮬레이션을 스트리밍으로 보여주라고 한다.
 * 이번 주에 못 붙이는 이유를 **화면에 적는다.** 껍데기만 그럴듯하게 만들어
 * 두면 다음 사람이 "되는 화면"으로 착각한다.
 *
 * 못 붙이는 이유(실측 2026-08-04) — **미등록이다. 폐기도 미구현도 아니다.**
 *   1. `GET /api/v1/simulation` → 404. 라우터가 서버에 **등록돼 있지 않다.**
 *   2. 등록을 못 하는 사유는 기능이 아니라 구조다 — `app/core/sim_ai/graph.py:57`
 *      이 **모듈 최상단**에서 `RagVectorStorage()` 를 만들고, 그게 import 도중
 *      Postgres 에 접속해 **528초**가 걸린다(백엔드 실측, rc=0). 등록하면
 *      서버 기동이 9분이다. 화면 1 `/upload` 가 막힌 것과 **같은 한 건**이다.
 *   3. 계약(`pipeline_run_contract.md`)에 아직 경로·이벤트 스키마가 없다.
 *      계약에 없는 경로를 프런트가 먼저 호출하면 그건 프런트가 계약을 지어내는 것이다.
 *
 * 🔴 **이 주석은 두 번 틀렸다. 둘 다 남겨 둔다.**
 *
 *    (1) 처음엔 「되살리려면」 절차를 적었다 — `pip install langgraph langchain_openai`
 *        → `main.py` 주석 해제. **틀렸다.** 그렇게 하면 안 켜진다.
 *    (2) 그다음엔 "폐기된 초안이라 재작성 대상"이라고 적었다. **이것도 틀렸다.**
 *        백엔드가 스스로 정정했다 — `simulations.py` 는 **512행 라우터**이고
 *        `app/core/sim_ai/graph.py` **335행 엔진**이 붙어 있다. 이 프로젝트의
 *        두 축 중 하나(다중에이전트 공청회)다. `pdf_service` 도 살아 있는
 *        42행 `PdfReportBuilder`(화면 6 PDF 전용)다. 지운 것은 `lands.py`·`ahp.py` 뿐.
 *        원인: `dummy/` 라는 **위치와 이름만 보고** 분류하고 파일을 안 열었다.
 *
 *    (2) 가 (1) 보다 나쁘다. "폐기"라고 적혀 있으면 다음 사람이 **살아 있는
 *    512행을 다시 짠다.** 안 되는 이유를 적는 화면이 사유를 틀리게 적으면
 *    양쪽으로 손해다 — 되살리려다 시간을 쓰거나, 멀쩡한 걸 다시 짜거나.
 *    그래서 지금은 **"미등록"** 이라고만 적는다. 사유는 하나(import 시점 외부 접속)다.
 *
 * 🔴 **EventSource 는 못 쓴다.** 붙일 때도 그렇다. 스트림 시작이 POST(본문 필요)
 *    인데 `EventSource` 는 GET 만 한다. 그래서 `@microsoft/fetch-event-source`
 *    가 package.json 에 이미 들어 있다 — 지금은 **호출하지 않는다.**
 *    (안 쓰는 코드를 미리 써 두면 언젠가 아무도 모르게 켜진다)
 */
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { useRun } from "@/lib/omnisite/RunProvider";
import { SCREENS } from "@/lib/omnisite/screens";
import { useRouter } from "next/navigation";

const SCREEN = SCREENS.find((s) => s.no === "5")!;

export default function Screen5Page() {
  const { run } = useRun();
  const router = useRouter();

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="놓기 전에 반대를 미리 듣는다. 사람 대신 에이전트가 공청회를 연다."
      />

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => router.push("/dynamic-hearing")}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          동적 페르소나 토론 모드 (새 브랜치) 테스트하기
        </button>
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-[12px] leading-relaxed text-amber-900">
        <p className="text-[13px] font-semibold">
          이 화면은 아직 서버에 연결돼 있지 않습니다 — <b>코드가 없어서가 아니라 라우터가
          등록돼 있지 않아서입니다.</b>
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          <li>
            <code>GET /api/v1/simulation</code> → <b>404</b> (2026-08-04 실측).
          </li>
          <li>
            등록을 못 하는 이유는 기능이 아니라 구조입니다 —{" "}
            <code>app/core/sim_ai/graph.py:57</code> 이 모듈 최상단에서 벡터DB 객체를
            만들고, 그게 <b>import 도중</b> Postgres 에 접속해 <b>528초</b>가 걸립니다.
            등록하면 서버 기동이 9분입니다. 화면 1 의 업로드가 막힌 것과{" "}
            <b>같은 한 건</b>입니다.
          </li>
          <li>
            계약서(<code>pipeline_run_contract.md</code>)에 경로·이벤트 스키마가 아직
            없습니다. 계약에 없는 경로를 프런트가 먼저 부르지 않습니다.
          </li>
          <li>
            <b>담당이 인계됐습니다.</b> 배선은 다른 팀원이 맡습니다 — 프런트가 지금 할 일은
            없습니다.
          </li>
        </ul>
        <p className="mt-2">
          <b>그래서 가짜 발언을 만들어 채우지 않았습니다.</b> 공청회 발언은 그럴듯할수록
          위험합니다 — 누가 그걸 근거로 보고서를 씁니다.
        </p>
      </div>

      <section className="mt-6">
        <h2 className="text-[14px] font-semibold">붙일 자리 (구조만 확정)</h2>
        <p className="mt-1 text-[12px] text-ink-secondary">
          서버가 스트림을 열면 아래 세 칸이 채워집니다. 지금은 전부 비어 있습니다.
        </p>

        <div className="mt-3 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
          <Slot title="참여자">
            에이전트 구성(주민 · 상인 · 지자체 …)은 <b>서버가 정합니다</b>.
            프런트에 명단을 박으면 그게 곧 하드코딩입니다. 목록 API 가 열리면 채웁니다.
          </Slot>
          <Slot title="공청회 진행">
            발언이 한 줄씩 스트리밍됩니다. <code>POST</code> + 스트리밍이라{" "}
            <code>EventSource</code> 대신 <code>@microsoft/fetch-event-source</code> 를
            씁니다(이미 설치돼 있고, 지금은 호출하지 않습니다).
          </Slot>
          <Slot title="합의·쟁점 요약">
            쟁점별 찬반과 미해결 항목. 화면 6 보고서의 「갈등 예측」 절로 넘어갑니다.
          </Slot>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-hairline bg-white p-5">
        <h2 className="text-[14px] font-semibold">붙는 순서 — 프런트가 먼저 하는 일은 없습니다</h2>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[12px] leading-relaxed text-ink-secondary">
          <li>
            <code>graph.py</code> 의 벡터DB 생성을 <b>요청 시점으로</b> 옮깁니다. 그래야
            라우터를 등록해도 서버가 9분 만에 뜨지 않습니다.
          </li>
          <li>라우터를 등록하고, 경로와 이벤트 스키마가 계약서에 올라갑니다.</li>
          <li>그다음에 이 화면이 그 계약을 읽습니다.</li>
        </ol>

        <div className="mt-4 rounded-lg border border-hairline bg-canvas-soft px-4 py-3 text-[12px] leading-relaxed text-ink-secondary">
          <p className="font-semibold text-ink">🔴 이 자리에 틀린 안내가 두 번 적혔습니다</p>
          <p className="mt-2">
            처음엔 <b>「되살리려면」 절차</b>(패키지 설치 → 라우터 주석 해제)를 적었습니다.
            그렇게 해도 안 켜집니다. 그다음엔 <b>「폐기된 초안이라 재작성 대상」</b>이라고
            적었습니다. 이것도 틀렸습니다 — <code>simulations.py</code> 는 512행 라우터이고
            엔진 335행이 붙어 있는, <b>살아 있는 코드</b>입니다.
          </p>
          <p className="mt-2">
            두 번째가 더 나쁩니다. 「폐기」라고 적혀 있으면 다음 사람이 <b>멀쩡한 512행을
            다시 짭니다.</b> 그래서 지금은 사유를 하나만 적습니다 —{" "}
            <b>미등록(import 시점 외부 접속)</b>. 지운 기록을 남기는 이유는, 이 화면을 다시
            고칠 사람이 같은 자리에서 세 번째로 틀리지 않게 하기 위해서입니다.
          </p>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary">
          화면 6 의 서버측 PDF 도 <b>재작성이 아니라 복구 + 환경</b>입니다 —{" "}
          <code>pdf_service.py</code> · <code>report_template.html</code> 은 커밋에 남아
          있고 <code>weasyprint</code>(GTK3)만 환경 문제입니다. 다만 화면 6 은 지금도{" "}
          <code>window.print()</code> 로 동작하므로 <b>기다리지 않습니다.</b>
        </p>
      </section>

      <p className="mt-4 text-[12px] text-ink-secondary">
        현재 실행:{" "}
        {run ? (
          <span className="tnum font-medium text-ink">
            {run.run_id} · {run.domain} · {run.status}
          </span>
        ) : (
          "없음"
        )}{" "}
        — 시뮬레이션은 이 실행의 결과(화면 4 후보지)를 입력으로 받게 됩니다.
      </p>

      <PageFooter screen={SCREEN} />
      <SourceNote files={["(없음) — 시뮬레이션 엔드포인트가 계약에 없습니다"]} />
    </PageBody>
  );
}

function Slot({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-white/50 p-4">
      <h3 className="text-[13px] font-semibold text-ink-secondary">{title}</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">{children}</p>
      <div className="mt-3 grid h-24 place-items-center rounded border border-dashed border-hairline text-[11px] text-ink-secondary/70">
        비어 있음 — 서버 미연결
      </div>
    </div>
  );
}
