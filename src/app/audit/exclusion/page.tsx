"use client";

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

export interface Layer {
  id: string;
  name: string;
  role: ReviewedRole;
  rowsAfter: number | null;
  rowsBefore: number | null;
  verdict: ExclusionProps | null;
}

export function ExclusionContent() {
  const reviewed = useArtifact<ReviewedDoc>("reviewed", loadReviewed);
  const clean = useArtifact<CleanReportDoc>("clean_report", loadCleanReport);
  const report = useArtifact<ReportDoc>("report", loadReport);
  const exclusion = useArtifact<ExclusionDoc>("exclusion", loadExclusion);

  return (
    <div className="w-full">
      <ArtifactView2 a={reviewed} b={clean} what="배제 근거">
          {(rev, cln) => {
            const labels = buildDatasetLabels(rev, cln);
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
              <div>
                <Rationale layers={layers} />
              </div>
            );
          }}
      </ArtifactView2>
    </div>
  );
}

export default function Screen2bPage() {
  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="설치가 법적으로 금지된 구역과, AI가 해당 결정을 내린 법적 근거 조문을 상세히 확인합니다."
        right={
          <Link href={SCREEN_2.path} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            감리 확인 단계로 돌아가기
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pr-2">
        <ExclusionContent />
      </div>
    </PageBody>
  );
}

function ContractNote() {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm flex gap-4 animate-in fade-in">
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </div>
      <div>
        <h3 className="text-sm font-bold text-blue-900 mb-1">배제 면적 측정 기준 안내</h3>
        <p className="text-xs text-blue-800/80 leading-relaxed">
          배제 면적은 <b>실제 측정된 합집합(Union) 면적</b>을 사용합니다. 계약서에는 &quot;산출물에 없다&quot;고 기재되어 있으나, 응답 데이터에 포함된 실측값을 우선하여 표기합니다.
        </p>
      </div>
    </div>
  );
}

function Summary({ report, nLayers }: { report: ReportDoc | null; nLayers: number }) {
  const sp = report?.spatial ?? null;
  const w = sp?.width_m ?? null;
  
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <Stat
        icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500"><path d="M21 3H3v18h18V3z"/><path d="M21 8H3"/><path d="M21 16H3"/><path d="M8 21V3"/><path d="M16 21V3"/></svg>}
        label="배제 통폐합 면적"
        value={km2(sp?.exclusion_union_km2)}
        note={sp ? (sp.shape_lift ? "지목 배수 판정(S9) 적용됨 — 점 데이터가 면으로 승격된 몫 포함" : "지목 배수 판정(S9) 미적용") : "report.json 대기중"}
      />
      <Stat 
        icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
        label="적용된 배제 레이어" 
        value={`${nLayers}개`} 
        note="감리 결과 설치가 원천 금지된(hard_exclusion) 데이터셋 개수" 
      />
      <Stat
        icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        label="최소 내접폭 통과"
        value={w ? `${int(w.pass_min_width)} / ${int(w.n)}` : "—"}
        note={w ? `기준 ${fixed(w.min_width, 1)}m · 중앙값 ${fixed(w.median, 2)}m · p95 ${fixed(w.p95, 2)}m` : (sp ? "내접폭 계측 불가 (지적도 데이터 한계)" : "필지 규격 검사")}
      />
    </section>
  );
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode, label: string; value: string; note: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden group hover:border-gray-300 transition-colors">
      <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{icon}</svg>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">{icon}</div>
        <div className="text-sm font-bold text-gray-600">{label}</div>
      </div>
      <div className="text-3xl font-black text-gray-900 tracking-tight mb-2">{value}</div>
      <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-3">{note}</p>
    </div>
  );
}

function isFlipped(p: ExclusionProps): boolean {
  const norm = (v: string) => (v === "radius" ? "point" : v);
  return norm(p.type_llm) !== norm(p.type);
}

const VERDICT_LABEL: Record<string, string> = {
  point: "점",
  polygon: "면",
  mixed: "혼합",
};

function VerdictCell({ layer, state }: { layer: Layer; state: ArtifactState<ExclusionDoc>; }) {
  const v = layer.verdict;
  if (!v) {
    return <span className="text-gray-400 font-bold">—</span>;
  }
  const flipped = isFlipped(v);
  return (
    <div className="flex justify-center">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${flipped ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
        <span className="text-xs font-bold">{VERDICT_LABEL[v.type] ?? "?"}</span>
        <code className="text-[10px] opacity-60 uppercase tracking-widest">{v.type}</code>
        {flipped && (
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse ml-1" title="감리 제안과 최종 판정이 다름 (뒤집힘)"></span>
        )}
      </div>
    </div>
  );
}

function VerdictNote({ layers, state }: { layers: Layer[]; state: ArtifactState<ExclusionDoc>; }) {
  const withVerdict = layers.filter((l) => l.verdict !== null);
  const flipped = withVerdict.filter((l) => isFlipped(l.verdict!));

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-base font-bold text-gray-800">최종 판정 분석 (S9)</h2>
      </div>
      <div className="p-6">
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          백엔드는 점 데이터가 실제 면(Polygon)을 가지는지를 <b>지목 배수</b>를 통해 재판정합니다. 
          따라서 AI의 &apos;감리 제안&apos;과 데이터에 기반한 &apos;최종 판정&apos;이 다를 수 있으며, 최종 판정이 적용됩니다.
        </p>

        {withVerdict.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
            <span className="text-gray-500 text-sm">이 실행에서는 판정 데이터가 비어 있습니다.</span>
          </div>
        ) : flipped.length === 0 ? (
          <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
            <div>
              <h4 className="text-sm font-bold text-green-900 mb-1">모두 일치함</h4>
              <p className="text-xs text-green-800/80">이 실행에서는 제안과 최종 판정이 모두 일치합니다 ({withVerdict.length}건).</p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-600 shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div className="w-full">
              <h4 className="text-sm font-bold text-orange-900 mb-2">뒤집힌 판정 발생 ({flipped.length}건)</h4>
              <ul className="space-y-2">
                {flipped.map((l) => (
                  <li key={l.id} className="text-xs bg-white/60 p-2 rounded border border-orange-100 flex justify-between items-center">
                    <span className="font-semibold text-orange-900"><code>{l.id}</code> {l.name}</span>
                    <span className="text-orange-700 font-mono bg-orange-100/50 px-2 py-0.5 rounded">{l.verdict!.type_llm} → {l.verdict!.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Rationale({ layers }: { layers: Layer[] }) {
  const withReason = layers.filter((l) => l.role.rationale);
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5 bg-gray-50/30">
        {withReason.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-10">
            사유(rationale)가 기록된 배제 레이어가 없습니다.
          </div>
        ) : (
          <div className="space-y-2.5">
            {withReason.map((l, i) => (
              <div key={`${l.id}-${i}`} className="bg-white py-3 px-4 rounded-xl border border-gray-100 shadow-sm relative">
                <svg className="absolute top-3 left-3.5 w-5 h-5 text-gray-100" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
                <div className="relative z-10 pl-[26px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="tnum rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                      {l.id}
                    </span>
                    <span className="text-[13px] font-bold text-gray-800">{l.name}</span>
                  </div>
                  <p className="text-[13px] text-gray-600 leading-relaxed font-serif">
                    &quot;{l.role.rationale}&quot;
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ExclusionStepContent() {
  const reviewed = useArtifact<ReviewedDoc>("reviewed", loadReviewed);
  const clean = useArtifact<CleanReportDoc>("clean_report", loadCleanReport);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 px-1">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <h2 className="text-xl font-bold text-gray-900">AI 배제 사유 상세보기</h2>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6">
        <ArtifactView2 a={reviewed} b={clean} what="배제 근거">
          {(rev, cln) => {
            const labels = buildDatasetLabels(rev, cln);
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
                  verdict: null,
                });
              }
            }
            layers.sort((a, b) => a.id.localeCompare(b.id));

            return <Rationale layers={layers} />;
          }}
        </ArtifactView2>
      </div>
    </div>
  );
}
