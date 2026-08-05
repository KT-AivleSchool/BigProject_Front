"use client";

/**
 * 화면 2b · 배제 근거
 * ===================
 * 화면 2 의 보조 화면이다. 내비 6단계에 넣지 않는다(명세: 2 의 하위).
 *
 * 네 산출물을 합쳐 만든다 — 한 곳에 다 있는 게 아니다(실측).
 *
 *   시설 · 역할 · 반경   reviewed.json      results[].roles[] (role=hard_exclusion)
 *   정제 후 건수         clean_report.json  results[].rows_after
 *   배제 union 면적      report.json        spatial.exclusion_union_km2
 *   최종 판정(S9)        exclusion.geojson  features[].properties.type
 *
 * 🔴 **계약서가 틀렸다.** `pipeline_run_contract.md` 는 "배제 union 면적은 어느
 *    산출물에도 없다 → 화면에 0.0000 을 쓴다" 고 적혀 있는데, 실제 응답에는
 *    `report.spatial.exclusion_union_km2 = 1.1107` 이 **있다**(2026-08-04 S5(A)
 *    계측으로 추가됨). 문서를 따라 0 을 찍으면 화면이 거짓말을 한다(절대원칙 4·5).
 *    백엔드가 이 지적을 받아 계약서를 고치기로 했다(2026-08-04 회신). 문서가
 *    고쳐져도 이 주석은 남긴다 — **문서와 응답이 갈릴 수 있다는 사실 자체**가
 *    이 화면의 판단 근거이기 때문이다.
 *
 * 🔴 **「최종 판정」 열은 한동안 비어 있었다.** S9 지목배수 판정 결과가
 *    `exclusion.geojson` 에만 있는데 그 파일이 화이트리스트에 없었다. 백엔드
 *    커밋 `ea4bef3` 으로 올라가서 지금은 채운다. 다만 **두 경우엔 여전히 빈다**:
 *      · 커밋 이전에 만들어진 run — `status.json` 이 생성 시점 화이트리스트로 굳는다
 *      · 서버가 옛 코드로 떠 있는 동안 — 404
 *    그럴 때 감리값(`exclusion_type`)을 판정인 척 채우지 않는다. 실측 예:
 *    `01 금연구역` 은 감리 `polygon` → S9 `mixed`. 둘은 다른 값이다.
 *
 * 🔴 **감리 제안과 최종 판정을 같은 열에 합치지 않는다.** 최종값만 보이면
 *    코드가 감리 제안의 무엇을 뒤집었는지 화면에서 알 수 없다(절대원칙 3).
 *
 * 🔴 **이 화면은 읽기 전용이다. 뒤집기 버튼을 붙이지 않는다** (백엔드 정정, 2026-08-05).
 *    HITL 은 게이트 구조이고 게이트는 두 곳뿐이다 — 감리(STEP1 뒤) · 가중치(STEP3-1 뒤).
 *    점·면 판정은 **STEP4 에서** 계산되므로 두 게이트가 다 지나간 다음에 생긴다.
 *    되돌려 보낼 게이트가 없다는 뜻이다. 표가 이미 다 그려져 있어서 "버튼만 붙이면
 *    된다"고 읽히지만 그 자리가 아니다 — 눌러도 그 실행은 안 바뀐다.
 */
import Link from "next/link";
import { ArtifactView2 } from "@/components/ui/ArtifactView";
import { PageBody, PageHeader, SourceNote } from "@/components/ui/Page";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import {
  loadCleanReport,
  loadExclusion,
  loadReport,
  loadReviewed,
} from "@/lib/omnisite/pipeline";
import { buildDatasetLabels } from "@/lib/omnisite/labels";
import { fixed, int, km2, meters } from "@/lib/omnisite/format";
import { SCREENS } from "@/lib/omnisite/screens";
import type {
  CleanReportDoc,
  ExclusionDoc,
  ExclusionProps,
  ReportDoc,
  ReviewedDoc,
  ReviewedRole,
} from "@/lib/omnisite/types";
import type { ArtifactState } from "@/lib/omnisite/useArtifact";

const SCREEN = SCREENS.find((s) => s.no === "2b")!;
const SCREEN_2 = SCREENS.find((s) => s.no === "2")!;

interface Layer {
  id: string;
  name: string;
  role: ReviewedRole;
  rowsAfter: number | null;
  rowsBefore: number | null;
  /** S9 최종 판정. 산출물이 없으면 null 이고, 열은 `—` 로 남는다. */
  verdict: ExclusionProps | null;
}

export default function Screen2bPage() {
  const reviewed = useArtifact<ReviewedDoc>("reviewed", loadReviewed);
  const clean = useArtifact<CleanReportDoc>("clean_report", loadCleanReport);
  // report 는 union 면적 하나 때문에 읽는다. 없으면 그 칸만 비운다 —
  // 이것 때문에 표 전체를 막지 않는다.
  const report = useArtifact<ReportDoc>("report", loadReport);
  // 최종 판정도 마찬가지다. 옛 run 이나 옛 서버에서는 없다 —
  // 그때 표가 통째로 막히면 배제 레이어 목록조차 못 본다.
  const exclusion = useArtifact<ExclusionDoc>("exclusion", loadExclusion);

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="법으로 못 놓는 곳. 왜 배제됐는지 근거를 조문까지 되짚는다."
        right={
          <Link href={SCREEN_2.path} className="btn-secondary text-[12px]">
            ◀ 화면 2 · 감리 확인
          </Link>
        }
      />

      <ArtifactView2 a={reviewed} b={clean} what="배제 근거">
        {(rev, cln) => {
          const labels = buildDatasetLabels(rev, cln);
          // dataset_id → S9 판정. 없으면 빈 Map 이고 판정 열은 전부 `—` 다.
          const verdicts = new Map<string, ExclusionProps>();
          for (const f of exclusion.data?.features ?? []) {
            verdicts.set(f.properties.dataset_id, f.properties);
          }

          const layers: Layer[] = [];
          for (const r of rev.results) {
            const c = cln.results.find((x) => x.dataset_id === r.dataset_id) ?? null;
            for (const role of r.roles) {
              if (role.role !== "hard_exclusion") continue;
              layers.push({
                id: r.dataset_id,
                name: labels.get(r.dataset_id)?.name ?? r.dataset_id,
                role,
                rowsAfter: c?.rows_after ?? null,
                rowsBefore: c?.rows_before ?? null,
                verdict: verdicts.get(r.dataset_id) ?? null,
              });
            }
          }
          layers.sort((a, b) => a.id.localeCompare(b.id));

          const noRadius = layers.filter(
            (l) => l.role.배제반경_m === null || l.role.배제반경_m === undefined,
          );

          return (
            <>
              <ContractNote />

              <Summary report={report.data} nLayers={layers.length} />

              <section className="mt-6">
                <h2 className="text-[14px] font-semibold">배제 레이어</h2>
                <p className="mt-1 text-[11px] text-ink-secondary">
                  감리에서 <code>hard_exclusion</code> 으로 판정된 데이터셋만 나옵니다.
                  건수는 <b>정제 후</b> 행 수입니다 — 배제 계산에 실제로 들어간 수.
                </p>

                <div className="mt-3 overflow-x-auto rounded-xl border border-hairline bg-white">
                  <table className="w-full min-w-[860px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-hairline bg-black/[0.02] text-left text-[12px] text-ink-secondary">
                        <th className="px-3 py-2 font-medium">ID</th>
                        <th className="px-3 py-2 font-medium">시설</th>
                        <th className="px-3 py-2 font-medium">감리 제안 유형</th>
                        <th className="px-3 py-2 font-medium">최종 판정</th>
                        <th className="px-3 py-2 text-right font-medium">배제 반경</th>
                        <th className="px-3 py-2 text-right font-medium">건수(정제 후)</th>
                        <th className="px-3 py-2 font-medium">반경 출처</th>
                      </tr>
                    </thead>
                    <tbody>
                      {layers.map((l, i) => (
                        <tr key={`${l.id}-${i}`} className="border-b border-hairline last:border-0">
                          <td className="tnum px-3 py-2 font-medium">{l.id}</td>
                          <td className="px-3 py-2">
                            {l.name}
                            {l.role.facility_type && l.role.facility_type !== l.name && (
                              <span className="ml-1 text-[11px] text-ink-secondary">
                                ({l.role.facility_type})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <code className="text-[12px] text-ink-secondary">
                              {l.role.exclusion_type ?? "—"}
                            </code>
                          </td>
                          <td className="px-3 py-2">
                            <VerdictCell layer={l} state={exclusion} />
                          </td>
                          <td className="tnum px-3 py-2 text-right">
                            {typeof l.role.배제반경_m === "number" ? (
                              meters(l.role.배제반경_m)
                            ) : (
                              <span
                                className="text-amber-700"
                                title="반경이 정해지지 않았습니다. 면(polygon) 자체로만 배제됩니다."
                              >
                                반경 없음
                              </span>
                            )}
                          </td>
                          <td className="tnum px-3 py-2 text-right">
                            {int(l.rowsAfter)}
                            {l.rowsBefore !== null && l.rowsBefore !== l.rowsAfter && (
                              <span className="ml-1 text-[11px] text-ink-secondary">
                                / {int(l.rowsBefore)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[12px] text-ink-secondary">
                            {l.role.source ?? "—"}
                            {l.role.confirmed && (
                              <span className="ml-1 text-[11px] text-ink-secondary">· 확정</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {layers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-ink-secondary">
                            이 실행의 감리 결과에 <code>hard_exclusion</code> 역할이 한 건도
                            없습니다. 배제 레이어가 0개라는 뜻입니다 — 로딩 실패가 아닙니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {noRadius.length > 0 && (
                  <p className="mt-2 text-[11px] text-ink-secondary">
                    반경이 없는 레이어 {noRadius.length}건(
                    {noRadius.map((l) => l.id).join(" · ")})은 시설 주변 이격 없이 면 자체만
                    배제됩니다. 이 사실은 화면 6 의 <code>data_gap</code> 에도 기록됩니다.
                  </p>
                )}
              </section>

              <VerdictNote layers={layers} state={exclusion} />

              <Rationale layers={layers} />
            </>
          );
        }}
      </ArtifactView2>

      <SourceNote
        files={[
          "reviewed.json (roles[].role=hard_exclusion)",
          "clean_report.json (rows_after)",
          "report.json (spatial)",
          "exclusion.geojson (features[].properties — 좌표는 읽지 않습니다)",
        ]}
      />
    </PageBody>
  );
}

/** 계약 문서와 실측이 갈린 지점. 화면에 남긴다 — 다음 사람이 또 0 을 찍지 않도록. */
function ContractNote() {
  return (
    <div className="mt-5 rounded-lg border border-hairline bg-black/[0.02] px-4 py-3 text-[12px] leading-relaxed text-ink-secondary">
      <b className="text-ink">배제 면적은 실값입니다.</b> 계약서(
      <code>pipeline_run_contract.md</code>)에는 &ldquo;배제 union 면적은 산출물에 없다&rdquo;고
      적혀 있으나, 실제 응답의 <code>report.json → spatial.exclusion_union_km2</code> 에
      값이 들어 있습니다(2026-08-04 계측 추가분). 문서를 따라 0 을 찍지 않고 응답 실물을
      씁니다. <b className="text-ink">백엔드가 이 지적을 확인해 계약서를 고치기로 했습니다</b>{" "}
      (2026-08-04 회신). 문서가 고쳐져도 이 문구는 남깁니다 — 이 화면이 무엇을 근거로
      값을 골랐는지가 기록으로 남아야 다음 사람이 같은 자리에서 문서를 믿고 0 을 찍지
      않습니다.
    </div>
  );
}

function Summary({ report, nLayers }: { report: ReportDoc | null; nLayers: number }) {
  const sp = report?.spatial ?? null;
  const w = sp?.width_m ?? null;
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-3">
      <Stat
        label="배제 union 면적"
        value={km2(sp?.exclusion_union_km2)}
        note={
          sp
            ? sp.shape_lift
              ? "지목 배수 판정(S9) 적용됨 — 점 데이터가 면으로 승격된 몫이 포함됩니다."
              : "지목 배수 판정(S9) 미적용."
            : "report.json 을 아직 읽지 못했습니다."
        }
      />
      <Stat label="배제 레이어" value={`${nLayers}개`} note="감리에서 hard_exclusion 으로 판정된 데이터셋 수." />
      {/* 🔴 `sp` 가 있어도 `sp.width_m` 은 **키가 통째로 없을 수 있다**(백엔드 지적,
          2026-08-05 — 내접폭 컬럼이 없는 지적도). `spatial === null` 만 막고 있었는데
          그건 옛 run 얘기고, 진짜 터지는 자리는 여기였다. 타입을 `?` 로 바꾸니
          컴파일러가 바로 잡아냈다 — 값을 안 보고도 잡히는 종류의 결함이었다. */}
      <Stat
        label="최소 내접폭 통과"
        value={w ? `${int(w.pass_min_width)} / ${int(w.n)}` : "—"}
        note={
          w
            ? `기준 ${fixed(w.min_width, 1)}m · 중앙값 ${fixed(w.median, 2)}m · p95 ${fixed(w.p95, 2)}m`
            : sp
              ? "이 실행에는 내접폭 계측이 없습니다(지적도에 내접폭 컬럼이 없으면 계산되지 않습니다)."
              : "필지가 시설을 담을 폭이 되는지 — report.json 에서 읽습니다."
        }
      />
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="text-[12px] text-ink-secondary">{label}</div>
      <div className="tnum mt-1 text-[22px] font-semibold">{value}</div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary">{note}</p>
    </div>
  );
}

/**
 * 감리 제안과 S9 판정이 **같은 것을 가리키는지** 판단한다.
 *
 * 🔴 두 필드는 **어휘가 다르다.** 감리는 `radius | polygon`, S9 는
 *    `point | polygon | mixed` 다. `radius` 와 `point` 는 같은 뜻이므로
 *    글자만 비교하면 멀쩡한 레이어가 전부 "뒤집힘"으로 찍힌다.
 *    실측: `05·06·07` 은 감리 `radius` → S9 `point` (그대로),
 *          `01·11` 은 감리 `polygon` → S9 `mixed` (뒤집힘).
 */
function isFlipped(p: ExclusionProps): boolean {
  const norm = (v: string) => (v === "radius" ? "point" : v);
  return norm(p.type_llm) !== norm(p.type);
}

const VERDICT_LABEL: Record<string, string> = {
  point: "점",
  polygon: "면",
  mixed: "혼합",
};

/** 표의 「최종 판정」 칸. 산출물이 없으면 감리값으로 때우지 않고 `—` 로 둔다. */
function VerdictCell({
  layer,
  state,
}: {
  layer: Layer;
  state: ArtifactState<ExclusionDoc>;
}) {
  const v = layer.verdict;
  if (!v) {
    // 🔴 `NotExposed` 를 쓰지 않는다. 그쪽 title 은 "API 에 없습니다" 로 고정인데
    //    여기서는 로딩 중이거나 읽기 실패일 수도 있다 — 셋을 한 문장으로 뭉치면
    //    화면이 관측하지 않은 것을 단정하게 된다(절대원칙 5).
    return (
      <span
        className="text-ink-secondary/70 underline decoration-dotted underline-offset-2"
        title={verdictMissingReason(state)}
      >
        —
      </span>
    );
  }
  const flipped = isFlipped(v);
  return (
    <div className="flex items-baseline gap-1.5">
      <code className={`text-[12px] ${flipped ? "font-semibold text-ink" : "text-ink"}`}>
        {v.type}
      </code>
      <span className="text-[11px] text-ink-secondary">
        {VERDICT_LABEL[v.type] ?? "?"}
      </span>
      {flipped && (
        <span
          className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800"
          title={`감리 제안 ${v.type_llm} → 최종 ${v.type} (출처 ${v.type_source})`}
        >
          뒤집힘
        </span>
      )}
    </div>
  );
}

/** 판정이 없을 때의 사유. 추측하지 않고 지금 관측된 상태만 적는다. */
function verdictMissingReason(state: ArtifactState<ExclusionDoc>): string {
  if (state.loading) return "exclusion.geojson 을 불러오는 중입니다.";
  if (state.error) return `exclusion.geojson 을 읽지 못했습니다 — ${state.error}`;
  return (
    "이 실행에는 exclusion 산출물이 없습니다. " +
    "산출물 목록은 run 생성 시점에 고정되므로, 화이트리스트에 오르기 전 실행은 이 값을 갖지 않습니다."
  );
}

/** 「최종 판정」 열이 무엇인지 / 왜 비었는지. 표 밑에 붙여야 표를 보다 바로 읽는다. */
function VerdictNote({
  layers,
  state,
}: {
  layers: Layer[];
  state: ArtifactState<ExclusionDoc>;
}) {
  const withVerdict = layers.filter((l) => l.verdict !== null);
  const flipped = withVerdict.filter((l) => isFlipped(l.verdict!));

  if (withVerdict.length === 0) {
    return (
      <section className="mt-6 rounded-xl border border-dashed border-hairline bg-white/50 p-5">
        <h2 className="text-[14px] font-semibold text-ink-secondary">
          최종 판정(점 / 면 / 혼합) — 이 실행에서는 비어 있습니다
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
          {verdictMissingReason(state)}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
          표의 &ldquo;감리 제안 유형&rdquo;으로 대신 채우지 <b>않습니다.</b> 그건 감리 AI 의
          제안이지 판정이 아닙니다 — 실측에서 <code>01 금연구역</code> 은 감리{" "}
          <code>polygon</code> 이었으나 S9 판정은 <code>mixed</code> 였고, 그 차이 때문에
          배제 면적이 0.0245 → 0.6325 km² 로 늘었습니다. 둘을 한 열에 섞으면 화면이 하지
          않은 판정을 한 것처럼 보입니다.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-hairline bg-white p-5">
      <h2 className="text-[14px] font-semibold">최종 판정(점 / 면 / 혼합)</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
        백엔드는 점 데이터가 실제로는 면인지를 <b>지목 배수</b>로 다시 판정합니다(S9).
        표의 두 열은 <b>다른 값</b>입니다 — &ldquo;감리 제안 유형&rdquo;은 감리 AI 가
        낸 제안(<code>radius</code> · <code>polygon</code>), &ldquo;최종 판정&rdquo;은
        코드가 데이터로 확인한 결과(<code>point</code> · <code>polygon</code> ·{" "}
        <code>mixed</code>)입니다. 최종값만 보이면 코드가 감리 제안의{" "}
        <b>무엇을 뒤집었는지</b> 화면에서 알 수 없으므로 둘 다 남깁니다.
      </p>

      <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
        {flipped.length === 0 ? (
          <>
            이 실행에서는 제안과 판정이 <b>모두 일치</b>합니다({withVerdict.length}건).
          </>
        ) : (
          <>
            이 실행에서 판정이 제안을 뒤집은 것은 <b>{flipped.length}건</b>입니다 —{" "}
            {/* 🔴 구분자를 요소 사이에 넣는다. `mr-2` 만으로는 붙어 읽힌다 —
                실측에서 "…(polygon → mixed)11 어린이보호구역" 으로 나왔다.
                간격은 시각이고 쉼표는 문장이다. 둘은 대체재가 아니다. */}
            {flipped.map((l, i) => (
              <span key={l.id} className="whitespace-nowrap">
                {i > 0 && ", "}
                <code>{l.id}</code> {l.name}{" "}
                <span className="text-ink-secondary/80">
                  ({l.verdict!.type_llm} → {l.verdict!.type})
                </span>
              </span>
            ))}
            . 뒤집힌 레이어는 시설 주변 반경만이 아니라 <b>필지 전체</b>로 배제가 확장됩니다.
          </>
        )}
      </p>

      {/* 🔴 여기에 「뒤집기」 버튼을 붙이지 않는다. 예전에 "쓰기 API 가 열리면 이 열에서
          바로 바꾸게 된다"고 적어 뒀었는데 **틀렸다**(백엔드 정정, 2026-08-05).
          HITL 은 게이트 구조다 — 게이트A 는 STEP1 뒤, 게이트B 는 STEP3-1 뒤에 선다.
          이 판정은 **STEP4 에서 계산된다.** 즉 두 게이트가 다 지나간 뒤에야 생기므로
          답으로 되돌려 보낼 게이트가 없다. 버튼을 달면 눌러도 그 실행은 안 바뀐다 —
          "표는 다 그렸으니 버튼만 붙이면 된다"고 읽기 딱 좋은 자리라 여기 적어 둔다. */}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary">
        판정 출처는{" "}
        <code>{[...new Set(withVerdict.map((l) => l.verdict!.type_source))].join(" · ")}</code>{" "}
        입니다. 이 판정은 <b>HITL 게이트 밖</b>에서 정해집니다 — 게이트는 감리(STEP1
        뒤)와 가중치(STEP3-1 뒤) 두 곳뿐인데, 점·면 판정은 그보다 뒤인 STEP4 에서
        계산됩니다. 그래서 이 화면은 <b>읽기 전용</b>이고, 판정을 바꿔야 하는 건은 화면
        6 의 <code>data_gap → 배제판정_확인요청</code> 으로 나갑니다. 나중에 바꾸는
        수단이 생기더라도 그것은 <b>이 실행이 아니라 다음 실행에 반영</b>됩니다.
      </p>
    </section>
  );
}

/** 조문 근거는 hitl_flags 안에만 있다. 없는 건 없다고 쓴다. */
function Rationale({ layers }: { layers: Layer[] }) {
  const withReason = layers.filter((l) => l.role.rationale);
  return (
    <section className="mt-6">
      <h2 className="text-[14px] font-semibold">배제 근거</h2>
      <p className="mt-1 text-[11px] text-ink-secondary">
        감리 AI 가 남긴 사유 원문입니다. 요약하거나 문장을 고치지 않습니다.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {withReason.map((l, i) => (
          <li key={`${l.id}-${i}`} className="rounded-lg border border-hairline bg-white p-4">
            <div className="flex items-baseline gap-2">
              <span className="tnum rounded bg-black/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                {l.id}
              </span>
              <span className="text-[13px] font-medium">{l.name}</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
              {l.role.rationale}
            </p>
          </li>
        ))}
        {withReason.length === 0 && (
          <li className="rounded-lg border border-hairline bg-white p-4 text-[12px] text-ink-secondary">
            사유(<code>rationale</code>)가 기록된 배제 레이어가 없습니다.
          </li>
        )}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-secondary">
        조례 <b>조문 번호</b>까지 되짚는 것은 명세의 요구지만, 조문 식별자를 담은 필드가
        현재 산출물에 없습니다. 화면 2 의 확인 요청 카드에 있는 <code>근거문장</code> ·{" "}
        <code>출처</code> 가 지금 얻을 수 있는 가장 가까운 값입니다.
      </p>
    </section>
  );
}
