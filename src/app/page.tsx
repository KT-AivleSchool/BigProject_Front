"use client";

import { useEffect, useRef, useState } from "react";
import { PageBody, PageHeader } from "@/components/ui/Page";
import { UploadPanel } from "@/components/upload/UploadPanel";
import { MODE_FIXTURE, MODE_HITL } from "@/lib/omnisite/pipeline";
import { useRun } from "@/lib/omnisite/RunProvider";
import { SCREENS } from "@/lib/omnisite/screens";

const SCREEN = SCREENS[0]!;

export default function Screen1Page() {
  const { run, starting, error, start } = useRun();

  const [typedDomain, setTypedDomain] = useState<string | null>(null);
  const domain = typedDomain ?? run?.domain ?? "";
  const setDomain = setTypedDomain;
  const [region, setRegion] = useState("");
  const [facility, setFacility] = useState("");
  const [intent, setIntent] = useState("");
  const [mode, setMode] = useState<string>(MODE_HITL);
  const [inputError, setInputError] = useState<string | null>(null);

  const domainRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = domainRef.current;
    if (el && typedDomain === null && el.value.trim()) setTypedDomain(el.value);
  }, [typedDomain]);

  async function onRun() {
    const fromDom = domainRef.current?.value ?? "";
    const value = (fromDom || domain).trim();
    if (!value) {
      setInputError("분석 도메인이 비어 있습니다. 분석 대상을 입력해주세요. (예: 흡연)");
      domainRef.current?.focus();
      return;
    }
    setInputError(null);
    if (fromDom.trim() && fromDom !== typedDomain) setTypedDomain(fromDom);
    await start(value, mode);
  }

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="분석할 지역과 시설을 정의하고, 필요한 데이터를 업로드하여 AI 최적화 파이프라인을 시작합니다."
      />

      <div className="mt-8 max-w-5xl mx-auto flex flex-col gap-8 pb-12">
        {/* Step 1: 분석 기본 정보
            🔴 업로드보다 **앞**에 둔다. 업로드 API 7개가 전부 `domain` 을 요구하므로
               도메인 없이 열리는 업로드 상자는 누를 수 없는 버튼과 같다. */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">1</div>
              <h2 className="text-lg font-bold text-gray-800">분석 기본 정보</h2>
            </div>
            <p className="mt-1 ml-11 text-sm text-gray-500">어떤 지역의 어떤 시설을 분석할지 정의합니다.</p>
          </div>
          <div className="p-8 grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                분석 도메인 <span className="text-blue-500">(필수)</span>
              </label>
              <input
                ref={domainRef}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="예) 흡연, 전기차, 따릉이"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-gray-50 hover:bg-white"
              />
              {inputError && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  {inputError}
                </p>
              )}
            </div>
            <Field
              label="시설 유형 (조례 업로드에 쓰입니다)"
              placeholder="예) 흡연부스"
              value={facility}
              onChange={setFacility}
              note="조례를 벡터 DB에 넣을 때 이 값으로 태깅합니다. 비워두면 서버가 STEP1 감리 확정본에서 읽고, 그것도 없으면 400을 돌려줍니다 — 프런트가 임의로 채우지 않습니다."
            />
            <Field
              label="분석 지역 (선택)"
              placeholder="예) 서울특별시 용산구"
              value={region}
              onChange={setRegion}
              note="⚠ 실행 API 는 아직 이 값을 받지 않습니다 (POST /runs 는 {domain, mode} 뿐)."
            />
            <div className="sm:col-span-2">
              <Field
                label="사용자 의도 (선택)"
                placeholder="분석 시 특별히 고려해야 할 사항을 자유롭게 입력하세요"
                value={intent}
                onChange={setIntent}
                note="⚠ 실행 API 는 아직 이 값을 받지 않습니다 (POST /runs 는 {domain, mode} 뿐)."
              />
            </div>
          </div>
        </section>

        {/* Step 2: 데이터 업로드 — 실제 배선 (`UploadPanel`) */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">2</div>
              <h2 className="text-lg font-bold text-gray-800">데이터 및 문서 업로드</h2>
            </div>
            <p className="mt-1 ml-11 text-sm text-gray-500">
              조례는 <code className="font-mono text-xs">data_임시/&lt;도메인&gt;/law/</code>, 데이터는{" "}
              <code className="font-mono text-xs">.../data/</code> 로 갑니다 — 파이프라인이 실제로 읽는 폴더입니다.
            </p>
          </div>
          <UploadPanel domain={domain} facilityType={facility} />
        </section>

        {/* Step 3: 실행 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">3</div>
              <h2 className="text-lg font-bold text-gray-800">AI 분석 모드 선택 및 실행</h2>
            </div>
            <p className="mt-1 ml-11 text-sm text-gray-500">파이프라인을 실행할 방식을 선택합니다.</p>
          </div>
          
          <div className="p-8">
            <PremiumModePicker mode={mode} onChange={setMode} />
            
            {error && (
              <div className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800 flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <div className="whitespace-pre-wrap break-all font-mono text-xs">{error}</div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={onRun}
                disabled={starting}
                className="w-full sm:w-auto min-w-[320px] px-8 py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {starting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    파이프라인 가동 중...
                  </>
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    분석 시작하기
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

    </PageBody>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  note,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  /**
   * 이 값이 **어디로 가는지**. 안 적으면 사용자는 입력한 값이 서버로 간다고
   * 읽는다 — `분석 지역`·`사용자 의도` 는 실제로는 아무 데도 안 간다.
   * 화면이 말하지 않으면 화면이 거짓말한 것이다(원칙 4).
   */
  note?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-gray-50 hover:bg-white text-sm"
      />
      {note && <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{note}</p>}
    </div>
  );
}

function PremiumModePicker({ mode, onChange }: { mode: string; onChange: (v: string) => void }) {
  const options = [
    {
      value: MODE_HITL,
      title: "맞춤형 대화 분석 모드",
      badge: "추천",
      badgeColor: "bg-blue-100 text-blue-700",
      note: "분석 중간에 멈추어 AI의 감리 결과와 가중치 제안을 직접 확인하고 수정할 수 있습니다.",
      pros: ["전문가의 도메인 지식 실시간 반영 가능", "가장 정교한 맞춤형 최적화 결과 도출"],
      cons: ["중간 개입 시 사용자의 피드백 대기 시간 발생"],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      )
    },
    {
      value: MODE_FIXTURE,
      title: "고속 자동 분석 모드",
      badge: "고정밀",
      badgeColor: "bg-gray-100 text-gray-600 border border-gray-200",
      note: "AI가 사전에 학습된 최적의 가중치를 자동으로 적용하여 중간 개입 없이 끝까지 빠르게 분석합니다.",
      pros: ["중간 개입이 필요 없어 가장 빠르고 편리함", "검증된 최적의 기본 가중치 자동 적용"],
      cons: ["예외적이거나 특수한 도메인 특성 반영이 어려움"],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 2-2 2.5-3-1v4.5l-3 1.5 2.5 2-1 3 4.5-1 1.5 3 2-2.5 3 1v-4.5l3-1.5-2.5-2 1-3-4.5 1-1.5-3z"></path></svg>
      )
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {options.map((o) => {
        const isSelected = mode === o.value;
        return (
          <div
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 flex flex-col h-full ${
              isSelected 
                ? "border-blue-500 bg-blue-50/40 shadow-md ring-4 ring-blue-500/10" 
                : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl transition-colors duration-300 ${isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}>
                {o.icon}
              </div>
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide ${o.badgeColor}`}>
                {o.badge}
              </span>
            </div>
            
            <h3 className={`text-lg font-bold mb-2 transition-colors duration-300 ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
              {o.title}
              {/* 백엔드가 식별할 수 있도록 실제 서버 값 표시 */}
              <span className="ml-2 inline-flex items-center text-[10px] font-mono font-medium text-gray-500 bg-black/5 px-2 py-0.5 rounded-md align-middle">
                mode={o.value}
              </span>
            </h3>
            
            <p className="text-sm text-gray-500 leading-relaxed">
              {o.note}
            </p>

            <div className="mt-4 space-y-2">
              <div className="text-[13px]">
                <strong className="text-green-600 font-bold mr-1">장점:</strong>
                <ul className="list-disc pl-5 text-gray-600 mt-1 space-y-0.5">
                  {o.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                </ul>
              </div>
              <div className="text-[13px]">
                <strong className="text-orange-500 font-bold mr-1">단점:</strong>
                <ul className="list-disc pl-5 text-gray-600 mt-1 space-y-0.5">
                  {o.cons.map((con, i) => <li key={i}>{con}</li>)}
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200/60 flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-300 ${
                isSelected ? 'border-blue-600 bg-white' : 'border-gray-300 bg-gray-50'
              }`}>
                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>}
              </div>
              <span className={`text-sm font-bold transition-colors duration-300 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                {isSelected ? '이 모드로 실행' : '선택하기'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
