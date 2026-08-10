"use client";

import Link from "next/link";
import { AuditGate } from "@/components/gate/AuditGate";
import { ArtifactView } from "@/components/ui/ArtifactView";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { GATE_AUDIT, openGate, gateScreen } from "@/lib/omnisite/gate";
import { loadReviewed } from "@/lib/omnisite/pipeline";
import { useRun } from "@/lib/omnisite/RunProvider";
import { SCREENS } from "@/lib/omnisite/screens";
import { useArtifact } from "@/lib/omnisite/useArtifact";
import { meters } from "@/lib/omnisite/format";
import type { ReviewedDoc, ReviewedFlag, ReviewedResult, ReviewedRole, RunDoc } from "@/lib/omnisite/types";

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
  const { run } = useRun();
  const state = useArtifact("reviewed", loadReviewed);
  const gate = openGate(run, GATE_AUDIT);

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="AI가 1차적으로 판정한 데이터 분석 계획을 검토합니다. 내용을 확인하고 다음 단계로 진행해주세요."
        right={
          <Link href={SCREEN_2B.path} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            AI 배제 사유 상세보기
          </Link>
        }
      />

      {/* 내부 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pr-2 mt-4">
        {gate ? (
          <div className="mt-4">
            <AuditGate gate={gate} runId={run!.run_id} />
          </div>
        ) : (
          <div className="mt-4">
            <NoGateNotice run={run ?? null} />
          </div>
        )}

        <div className="mt-8">
          <ArtifactView state={state} what="감리 결과">
            {(doc) => <Body doc={doc} />}
          </ArtifactView>
        </div>
      </div>

      {!gate && (
        <div className="shrink-0 mt-4">
          <NoGateCTA run={run ?? null} />
        </div>
      )}
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
    <div className="flex flex-col gap-8 pb-12">
      {/* ── 선정 대상 ── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <h2 className="text-base font-bold text-gray-800">선정 대상 분석</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KV icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>} k="시설" v={fi.facility} />
            <KV icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>} k="지역" v={fi.region} />
            <KV icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} k="입력" v={fi.source_input} />
            <KV 
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              k="분석 주체" 
              v={fi.confirmed ? "사람이 직접 확정함" : "AI 자동 추론됨"} 
              tone={fi.confirmed ? "ok" : "info"} 
            />
          </div>
          
          {!fi.confirmed && (
            <div className="mt-4 flex flex-col gap-3 p-4 rounded-xl border border-blue-100 bg-blue-50/50 text-blue-800">
              <div className="flex gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-blue-500 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div className="text-xs leading-relaxed w-full">
                  <strong className="block mb-1 text-sm">💡 이 데이터는 어떻게 결정되었나요?</strong>
                  AI가 사용자의 원래 입력 문장(<i>"{fi.source_input}"</i>)을 바탕으로 대상 시설과 지역을 <strong>자동으로 유추해낸 결과</strong>입니다. 
                </div>
              </div>
              <div className="mt-2 ml-8">
                <p className="text-xs text-blue-800/80 mb-2">단, AI가 원하시는 시설이나 지역을 잘못 짚어냈다면 아래 버튼을 눌러 처음으로 돌아가 문장을 명확하게 고쳐주세요.</p>
                <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-xs font-semibold shadow-sm w-fit">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  첫 단계(데이터 입력)로 돌아가서 수정하기
                </Link>
              </div>
            </div>
          )}

          {fi.mismatch && (
            <div className="mt-4 flex gap-3 p-4 rounded-xl border border-orange-200 bg-orange-50 text-orange-800">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div className="text-sm">
                <span className="font-bold">입력과 데이터 불일치:</span> {fi.mismatch_reason}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 확인 요청 ── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            <h2 className="text-base font-bold text-gray-800">확인 요청</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">검토 대기 {pending.length}건</span>
            <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">확정 완료 {flags.filter((x) => x.flag.confirmed_by_human).length}건</span>
          </div>
        </div>

        <div className="p-6">
          {pending.length === 0 && flags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">확인 요청 없음</h3>
              <p className="text-sm text-gray-500 max-w-sm">현재 사람의 확인이 필요한 건이 없습니다. 모든 항목이 자동으로 처리되었거나 감리가 건너뛰어졌습니다.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pending.map(({ result, role }, i) => (
                <PendingCard key={`p${i}`} result={result} role={role} />
              ))}
              {flags.map(({ result, flag }, i) => (
                <FlagCard key={`f${i}`} result={result} flag={flag} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 데이터셋 판정 ── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          <h2 className="text-base font-bold text-gray-800">데이터셋별 감리 판정</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">역할</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider">요약</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {doc.results.map((r) => (
                <tr key={r.dataset_id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-gray-900 whitespace-nowrap w-16 text-center">{r.dataset_id}</td>
                  <td className="px-6 py-4 w-48">
                    <div className="flex flex-wrap gap-1.5">
                      {r.roles.map((role, i) => (
                        <RoleChip key={i} role={role} />
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 min-w-[280px] leading-relaxed">
                    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-[13px]">
                      {r.summary}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RoleChip({ role }: { role: ReviewedRole }) {
  const excl = role.role === "hard_exclusion";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border shadow-sm ${
        excl 
          ? "bg-red-50 text-red-700 border-red-200" 
          : "bg-white text-gray-700 border-gray-200"
      }`}
      title={role.rationale}
    >
      {ROLE_LABEL[role.role] ?? role.role}
      {excl && role.배제반경_m != null && <span className="opacity-70 font-mono ml-0.5">· {meters(role.배제반경_m)}</span>}
      {!excl && typeof role.weight === "number" && <span className="opacity-70 font-mono ml-0.5">· W:{role.weight}</span>}
    </span>
  );
}

function PendingCard({ result, role }: { result: ReviewedResult; role: ReviewedRole }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/30 p-5 shadow-sm transition-all hover:shadow-md">
      <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 border border-orange-200 font-mono text-xs font-bold text-orange-800">
            {result.dataset_id}
          </span>
          <span className="text-sm font-bold text-gray-900">{ROLE_LABEL[role.role] ?? role.role}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold shadow-sm">
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span></span>
          사람 확인 필요
        </span>
      </div>
      <div className="ml-11 p-3 bg-white/60 rounded-lg border border-orange-100">
        <p className="text-sm text-gray-700 leading-relaxed">{role.rationale}</p>
      </div>
    </div>
  );
}

function FlagCard({ result, flag }: { result: ReviewedResult; flag: ReviewedFlag }) {
  const suspect = flag.근거_시설_일치 === false;
  const done = flag.confirmed_by_human === true;
  
  return (
    <div className={`relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${
      suspect ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white"
    }`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${suspect ? 'bg-orange-400' : done ? 'bg-green-400' : 'bg-gray-300'}`}></div>
      
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 font-mono text-xs font-bold text-gray-700">
          {result.dataset_id}
        </span>
        <span className="text-sm font-bold text-gray-900">{flag.type}</span>
        <div className="flex gap-2">
          {done && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-50 border border-green-200 text-green-700 text-xs font-bold">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              사람이 확정함
            </span>
          )}
          {suspect && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              근거-시설 불일치
            </span>
          )}
        </div>
      </div>

      <div className="ml-11">
        <p className="text-sm text-gray-700 leading-relaxed mb-4">{flag.message}</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {flag.제안값 != null && <InfoChip label="확정값" value={meters(flag.제안값)} />}
          {flag.출처 && <InfoChip label="출처" value={flag.출처} />}
          {flag.source_type && <InfoChip label="출처 종류" value={flag.source_type} />}
        </div>

        {flag.근거문장 && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 relative">
            <svg className="absolute top-2 left-2 w-6 h-6 text-gray-200" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
            <p className="text-sm text-gray-600 italic leading-relaxed pl-6 relative z-10">"{flag.근거문장}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex flex-col justify-center">
      <span className="text-[10px] uppercase font-bold text-gray-400 mb-0.5 tracking-wider">{label}</span>
      <span className="text-xs font-semibold text-gray-800">{value}</span>
    </div>
  );
}

function KV({ icon, k, v, tone }: { icon: React.ReactNode, k: string; v: string; tone?: "ok" | "warn" | "info" }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 border border-gray-100">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div className="flex flex-col">
        <dt className="text-xs font-semibold text-gray-500 mb-1">{k}</dt>
        <dd className={`text-sm font-bold ${tone === "warn" ? "text-orange-600" : tone === "ok" ? "text-green-600" : tone === "info" ? "text-blue-600" : "text-gray-900"}`}>
          {v}
        </dd>
      </div>
    </div>
  );
}

function NoGateCTA({ run }: { run: RunDoc | null }) {
  const status = run?.status;

  if (status === "succeeded") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-emerald-200 bg-emerald-50/30 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-pulse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-bold text-emerald-900">
              감리 확인이 완료되었습니다!
            </span>
            <span className="text-[13px] text-emerald-700/80">
              다음 단계에서 지표별 가중치를 확인하고 조정할 수 있습니다.
            </span>
          </div>
        </div>
        <Link
          href="/weights"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95"
        >
          가중치 단계로 이동하기
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </Link>
      </div>
    );
  }

  if (status === "awaiting_hitl" && run?.gate) {
    const target = gateScreen(run.gate.id);
    if (target && target.no !== "2") {
      return (
        <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-emerald-200 bg-emerald-50/30 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-pulse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-emerald-900">
                다음 단계({target.name}) 분석이 완료되었습니다!
              </span>
              <span className="text-[13px] text-emerald-700/80">
                AI가 다음 단계를 위한 제안을 준비했습니다. 확인을 위해 이동해주세요.
              </span>
            </div>
          </div>
          <Link
            href={target.path}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95"
          >
            {target.name} 단계로 바로 이동하기
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      );
    }
  }

  return null;
}

function NoGateNotice({ run }: { run: RunDoc | null }) {
  const status = run?.status;

  if (status === "succeeded") {
    return null;
  }
  
  if (status === "running") {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-blue-50/50 rounded-2xl border border-blue-100 text-center shadow-sm animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4" />
        <h3 className="text-base font-bold text-blue-900 mb-1">AI가 다음 분석을 위해 열심히 데이터를 처리하고 있습니다...</h3>
        <p className="text-sm text-blue-700/80">우측의 실시간 분석 모니터링 창을 통해 진행 상황을 확인하실 수 있습니다.</p>
      </div>
    );
  }

  if (status === "awaiting_hitl" && run?.gate) {
    const target = gateScreen(run.gate.id);
    if (target && target.no !== "2") {
      return null;
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-4 py-3 rounded-xl w-fit border border-gray-200">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>현재 감리 대기 중인 항목이 없습니다. {status && `(상태: ${status})`}</span>
    </div>
  );
}
