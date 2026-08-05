"use client";

/**
 * 화면 2 · 감리 확인
 * ==================
 * 명세: 「감리 AI 가 잠정 판정한 것을 사람이 뒤집는 자리.」
 *
 * 🔴 **읽기 전용이다. 사유가 2026-08-05 에 바뀌었다** — 예전엔 "쓰기 API 가 계약에
 *    없다" 였는데 이제 있다(`POST /runs/{id}/hitl/audit`). 지금 읽기 전용인 이유는
 *    두 개고, 둘 다 API 유무와 관계가 없다:
 *
 *    1. **이 화면이 읽는 것은 답할 대상이 아니다.** 여기 그리는 `reviewed.json` 은
 *       실행이 **끝나고 나온 산출물**이다. 게이트A 가 묻는 질문은 `status.json` 의
 *       `gate.questions[]` 에 있고, 그건 **`awaiting_hitl` 일 때만 존재한다.**
 *       두 데이터는 출처도 시점도 다르다 — 산출물에 확정 버튼을 다는 것은
 *       **이미 지나간 실행의 결과를 고치는 것처럼 보이게** 만드는 일이다.
 *    2. 프런트는 `mode: fixture` 로만 실행을 만든다. **픽스처는 게이트가 안 선다.**
 *       그래서 지금 화면에 떠 있는 run 에는 답할 질문이 애초에 0건이다.
 *
 *    쓰기 화면으로 만들려면 세 가지가 같이 와야 한다 —
 *    `mode: hitl` 실행 생성 · `run.gate.questions[]` 렌더 · 게이트 단위 배치 POST.
 *    셋 중 하나만 하면 화면이 거짓말한다.
 *
 * 🔴 픽스처의 `reviewed.json` 은 **이미 HITL 이 끝난 상태**다(실측).
 *    `need_review` 가 true 인 role 은 0건이고, `hitl_flags` 3건은 전부
 *    `confirmed_by_human: true` 다. 그래서 이 화면은 "대기 N건"이 아니라
 *    "사람이 확정한 3건"을 보여준다. 대기 건수를 지어내지 않는다.
 *
 * 화면 6 의 `data_gap` 과 섞지 않는다 — 출처가 다르다.
 *   여기: reviewed.json 의 hitl_flags · roles[].need_review
 *   화면 6: report.json 의 data_gap
 */
import Link from "next/link";
import { ArtifactView } from "@/components/ui/ArtifactView";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { loadReviewed } from "@/lib/omnisite/pipeline";
import { SCREENS } from "@/lib/omnisite/screens";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import { meters } from "@/lib/omnisite/format";
import type { ReviewedDoc, ReviewedFlag, ReviewedResult, ReviewedRole } from "@/lib/omnisite/types";

const SCREEN = SCREENS.find((s) => s.no === "2")!;
const SCREEN_2B = SCREENS.find((s) => s.no === "2b")!;

const ROLE_LABEL: Record<string, string> = {
  positive_factor: "가점 요인",
  negative_factor: "감점 요인",
  hard_exclusion: "설치 금지(배제)",
  reference_only: "참조만",
};

const COORD_LABEL: Record<string, string> = {
  has_coords: "좌표 있음",
  needs_geocoding: "지오코딩 필요",
  stat_join: "통계 — 조인 필요",
  spatial: "폴리곤(공간정보)",
};

export default function Screen2Page() {
  const state = useArtifact("reviewed", loadReviewed);

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="감리 AI 가 잠정 판정한 것을 사람이 뒤집는 자리. 확정 전에도 다음으로 넘어갈 수 있다."
        right={
          <Link href={SCREEN_2B.path} className="btn-utility text-[12px]">
            배제 근거 보기 (2b) →
          </Link>
        }
      />

      <ReadOnlyNotice />

      <ArtifactView state={state} what="감리 결과">
        {(doc) => <Body doc={doc} />}
      </ArtifactView>

      <PageFooter
        screen={SCREEN}
        action={
          <button
            type="button"
            disabled
            title="지금 보고 있는 것은 게이트 질문이 아니라 실행이 끝나고 나온 산출물입니다. 확정할 대상이 없습니다."
            className="btn-secondary cursor-not-allowed text-[13px] opacity-40"
          >
            데이터 확정 (게이트 대기 아님)
          </button>
        }
      />
      <SourceNote files={["<도메인>_audit_result_reviewed.json"]} />
    </PageBody>
  );
}

function Body({ doc }: { doc: ReviewedDoc }) {
  const fi = doc.facility_inference;
  const flags = doc.results.flatMap((r) =>
    r.hitl_flags.map((f) => ({ result: r, flag: f })),
  );
  const pending = doc.results.flatMap((r) =>
    r.roles.filter((x) => x.need_review).map((role) => ({ result: r, role })),
  );

  return (
    <>
      {/* ── 선정 대상 ─────────────────────────────────── */}
      <section className="glass-panel mt-6 rounded-xl p-5">
        <h2 className="text-[14px] font-semibold">선정 대상</h2>
        <div className="mt-3 flex flex-wrap gap-x-10 gap-y-3 text-[13px]">
          <KV k="시설" v={fi.facility} />
          <KV k="지역" v={fi.region} />
          <KV k="입력" v={fi.source_input} />
          <KV
            k="확정"
            v={fi.confirmed ? "사람이 확정함" : "미확정 (감리 AI 추론값)"}
            tone={fi.confirmed ? "ok" : "warn"}
          />
        </div>
        <p className="mt-3 text-[12px] text-ink-secondary">근거 · {fi.근거}</p>
        {fi.mismatch && (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            입력과 데이터가 어긋납니다 — {fi.mismatch_reason}
          </p>
        )}
      </section>

      {/* ── 확인 요청 ─────────────────────────────────── */}
      <section className="mt-6">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[14px] font-semibold">확인 요청</h2>
          <span className="text-[12px] text-ink-secondary">
            검토 대기 {pending.length}건 · 사람이 이미 확정한 건 {flags.filter((x) => x.flag.confirmed_by_human).length}건
          </span>
        </div>

        {pending.length === 0 && flags.length === 0 ? (
          <p className="mt-3 rounded-lg border border-hairline bg-white px-4 py-5 text-[13px] text-ink-secondary">
            확인 요청이 없습니다. (0건이라는 뜻이지, 확인을 건너뛴 것이 아닙니다.)
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {pending.map(({ result, role }, i) => (
              <PendingCard key={`p${i}`} result={result} role={role} />
            ))}
            {flags.map(({ result, flag }, i) => (
              <FlagCard key={`f${i}`} result={result} flag={flag} />
            ))}
          </ul>
        )}
      </section>

      {/* ── 데이터셋 판정 ─────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">데이터셋별 감리 판정</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-hairline bg-white">
          <table className="w-full text-[13px]">
            <thead className="border-b border-hairline bg-black/[0.02] text-left text-[12px] text-ink-secondary">
              <tr>
                <th className="px-4 py-2.5 font-medium">ID</th>
                <th className="px-4 py-2.5 font-medium">역할</th>
                <th className="px-4 py-2.5 font-medium">좌표 상태</th>
                <th className="px-4 py-2.5 font-medium">정제 지시</th>
                <th className="px-4 py-2.5 font-medium">요약</th>
              </tr>
            </thead>
            <tbody>
              {doc.results.map((r) => (
                <tr key={r.dataset_id} className="border-b border-hairline last:border-0 align-top">
                  <td className="tnum px-4 py-3 font-medium">{r.dataset_id}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.roles.map((role, i) => (
                        <RoleChip key={i} role={role} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {COORD_LABEL[r.coord_status] ?? r.coord_status}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-ink-secondary">
                    {r.cleaning_ops.map((o) => o.op_id).join(" → ") || "—"}
                  </td>
                  <td className="max-w-[380px] px-4 py-3 text-[12px] text-ink-secondary">
                    {r.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function RoleChip({ role }: { role: ReviewedRole }) {
  const excl = role.role === "hard_exclusion";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        excl ? "bg-red-50 text-red-700" : "bg-black/[0.05] text-ink-secondary"
      }`}
      title={role.rationale}
    >
      {ROLE_LABEL[role.role] ?? role.role}
      {excl && role.배제반경_m != null && ` ${meters(role.배제반경_m)}`}
      {!excl && typeof role.weight === "number" && ` ${role.weight}`}
    </span>
  );
}

function PendingCard({ result, role }: { result: ReviewedResult; role: ReviewedRole }) {
  return (
    <li className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="tnum rounded bg-amber-200/60 px-1.5 text-[11px] font-medium">
          {result.dataset_id}
        </span>
        <span className="text-[13px] font-medium">{ROLE_LABEL[role.role] ?? role.role}</span>
        <span className="text-[11px] text-amber-800">사람 확인 필요</span>
      </div>
      <p className="mt-1 text-[12px] text-amber-900">{role.rationale}</p>
      <Actions />
    </li>
  );
}

function FlagCard({ result, flag }: { result: ReviewedResult; flag: ReviewedFlag }) {
  // 근거_시설_일치 false = 다른 시설 규정을 긁었을 수 있다. 승인됐어도 눈에 띄게 둔다.
  const suspect = flag.근거_시설_일치 === false;
  const done = flag.confirmed_by_human === true;
  return (
    <li
      className={`rounded-lg border px-4 py-3 ${
        suspect ? "border-amber-300 bg-amber-50" : "border-hairline bg-white"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="tnum rounded bg-black/[0.06] px-1.5 text-[11px] font-medium">
          {result.dataset_id}
        </span>
        <span className="text-[13px] font-medium">{flag.type}</span>
        {done && (
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">
            ✓ 사람이 확정함
          </span>
        )}
        {suspect && (
          <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[11px] text-amber-900">
            ⚠ 근거-시설 불일치
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">{flag.message}</p>

      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-[12px]">
        {flag.제안값 != null && <KV k="확정값" v={meters(flag.제안값)} />}
        {flag.출처 && <KV k="출처" v={flag.출처} />}
        {flag.source_type && <KV k="출처 종류" v={flag.source_type} />}
      </dl>

      {flag.근거문장 && (
        <blockquote className="mt-2 border-l-2 border-hairline pl-3 text-[12px] italic text-ink-secondary">
          {flag.근거문장}
        </blockquote>
      )}
      <Actions />
    </li>
  );
}

/**
 * 🔴 버튼이 항목마다 붙어 있지만 **확정은 항목 단위가 아니다.** 백엔드는 게이트A
 *    한 번에 `{exclusions[], intents[], code_prefixes[]}` 를 통째로 받는다. 1건씩
 *    보내면 검증이 전체를 못 본다 — 가중치 쪽에서 실제로 전 후보 점수가 0 이 된
 *    사고가 그렇게 났다. 배선할 때 이 버튼은 **모아서 한 번 보내는** 쪽에 연결한다.
 *
 * 🔴 그리고 배선 지점은 **이 카드가 아니다.** 이 카드는 `reviewed.json`(산출물)의
 *    한 줄이고, 게이트A 가 묻는 질문은 `run.gate.questions[]` 의 한 줄이다.
 *    둘은 같은 사실을 다른 시점에서 본 것이라 **키가 맞지 않는다** — 게이트는
 *    `(dataset_id, role_index)` 로 대상을 지목하고, 계약이 "`results[]` 배열
 *    인덱스는 쓰지 말라"고 명시한다(순서가 바뀌면 조용히 다른 걸 가리킨다).
 */
function Actions() {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button type="button" disabled className="btn-utility cursor-not-allowed text-[12px] opacity-35">
        수정
      </button>
      <button type="button" disabled className="btn-utility cursor-not-allowed text-[12px] opacity-35">
        확정
      </button>
      <span className="text-[11px] text-ink-secondary">
        이 항목은 실행이 끝나고 나온 기록입니다 — 되돌려 보낼 게이트가 열려 있지 않습니다.
      </span>
    </div>
  );
}

function KV({ k, v, tone }: { k: string; v: string; tone?: "ok" | "warn" }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-secondary">{k}</dt>
      <dd
        className={`font-medium ${
          tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : ""
        }`}
      >
        {v}
      </dd>
    </div>
  );
}

function ReadOnlyNotice() {
  return (
    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
      <p className="font-semibold">이 화면은 읽기 전용입니다.</p>
      <p className="mt-1">
        확정을 되돌려 보낼 API 는 <b>있습니다</b>(게이트A). 다만 여기 보이는 것은
        <b> 실행이 끝나고 나온 기록</b>(<code>reviewed.json</code>)이고, 답을 받는 것은
        실행이 <b>게이트에서 멈춰 있는 동안</b>의 질문 목록입니다. 지나간 실행의
        기록에 「확정」을 달면, 사람은 값을 바꿨다고 믿지만 그 실행은 이미 그 값으로
        끝나 있습니다.
      </p>
      <p className="mt-1">
        게이트에서 답하려면 실행을 <code>mode: hitl</code> 로 만들어야 하는데, 지금
        화면 1 은 <code>fixture</code> 로만 만듭니다 — <b>픽스처는 게이트가 서지
        않습니다</b>(회귀 기준선이 사람 입력으로 흔들리면 안 되기 때문입니다).
        게이트 답변 화면은 아직 만들지 않았습니다.
      </p>
    </div>
  );
}
