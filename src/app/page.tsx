"use client";

/**
 * OmniSite 메인 시작 페이지 컴포넌트 (Screen 1)
 * ===========================================================
 * 구조:
 *  1. Imports (상단)
 *  2. Types & File-scoped Helper Functions (중단)
 *  3. Screen1Page 메인 컴포넌트 (상태, 훅, 핸들러, return JSX)
 *  4. 서브 프레젠터 컴포넌트 (하단)
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageBody, PageHeader } from "@/components/ui/Page";
import { UploadPanel, type UploadPanelHandle } from "@/components/upload/UploadPanel";
import {
  MODE_FULL,
  MODE_HITL,
  TOPN_DEFAULT,
  TOPN_MAX,
} from "@/lib/omnisite/pipeline";
import { useRun } from "@/lib/omnisite/RunProvider";
import { SCREENS } from "@/lib/omnisite/screens";
import { fetchDomains, type DomainItem } from "@/lib/omnisite/upload";

// ─────────────────────────────────────────────────────────────
// 1. Types & Helper Functions
// ─────────────────────────────────────────────────────────────

const SCREEN = SCREENS[0]!;

type DataSource = "upload" | "preset";

function parseTopn(raw: string): number | "empty" | "invalid" {
  const t = raw.trim();
  if (!t) return "empty";
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > TOPN_MAX) return "invalid";
  return n;
}

// ─────────────────────────────────────────────────────────────
// 2. Screen1Page Main Component
// ─────────────────────────────────────────────────────────────

export default function Screen1Page() {
  // ── Router & Global State ──
  const router = useRouter();
  const { run, starting, error, start } = useRun();

  // ── Component State & Refs ──
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [typedDomain, setTypedDomain] = useState<string | null>(null);
  const [presetDomain, setPresetDomain] = useState<string | null>(null);

  const domain =
    dataSource === "preset"
      ? (presetDomain ?? "")
      : (typedDomain ?? run?.domain ?? "");

  const [facility, setFacility] = useState("");
  const [region, setRegion] = useState("");
  const [intent, setIntent] = useState("");
  const [topnText, setTopnText] = useState(String(TOPN_DEFAULT));

  const [autoApprove, setAutoApprove] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const [activeStep, setActiveStep] = useState(1);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1Busy, setStep1Busy] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  const domainRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<UploadPanelHandle>(null);
  const [uploadedDomain, setUploadedDomain] = useState<{
    base: string;
    actual: string;
  } | null>(null);

  const runDomain = uploadedDomain?.base === domain ? uploadedDomain.actual : domain;

  useEffect(() => {
    const el = domainRef.current;
    if (el && typedDomain === null && el.value.trim()) setTypedDomain(el.value);
  }, [typedDomain]);

  const effectiveMode = dataSource === "upload" ? MODE_FULL : MODE_HITL;
  const isFull = effectiveMode === MODE_FULL;
  const topnParsed = parseTopn(topnText);

  // ── Event Handlers & Business Logic ──
  async function handleStep1Confirm() {
    const fromDom = domainRef.current?.value ?? "";
    const value = (dataSource === "preset" ? domain : fromDom || domain).trim();
    if (!dataSource) {
      setStep1Error("데이터 출처를 먼저 선택해주세요.");
      return;
    }
    if (!value) {
      setStep1Error(
        dataSource === "preset"
          ? "프리셋 도메인을 하나 고르세요."
          : "분석 도메인이 비어 있습니다. 분석 대상을 입력해주세요. (예: 흡연)",
      );
      if (dataSource !== "preset") domainRef.current?.focus();
      return;
    }
    if (dataSource !== "preset" && fromDom.trim() && fromDom !== typedDomain) {
      setTypedDomain(fromDom);
    }
    setStep1Error(null);

    if (dataSource === "upload" && uploadRef.current) {
      setStep1Busy(true);
      try {
        const actual = await uploadRef.current.commit();
        if (actual === null) return;
        setUploadedDomain({ base: value, actual });
      } finally {
        setStep1Busy(false);
      }
    }

    setActiveStep(2);
  }

  function handleStep2Confirm() {
    if (isFull && !intent.trim()) {
      setStep2Error("full 모드는 사용자 의도가 필수입니다. STEP0.5 가 이 문장에서 시설·지역을 확정합니다.");
      return;
    }
    if (topnParsed === "invalid") {
      setStep2Error(`입지 선정 개수는 1~${TOPN_MAX} 사이의 정수여야 합니다.`);
      return;
    }
    setStep2Error(null);
    setActiveStep(3);
  }

  async function onRun() {
    const fromDom = domainRef.current?.value ?? "";
    const value = (dataSource === "preset" ? domain : fromDom || domain).trim();
    setInputError(null);

    const target = uploadedDomain?.base === value ? uploadedDomain.actual : value;

    const id = await start(
      target,
      effectiveMode,
      isFull
        ? {
            user_input: intent.trim(),
            ...(topnParsed === "empty" || topnParsed === "invalid" ? {} : { topn: topnParsed as number }),
          }
        : undefined,
      autoApprove,
    );
    if (id) router.push("/audit");
  }

  // ── 3. JSX Return Statement ──
  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="분석할 지역과 시설을 정의하고, 필요한 데이터를 업로드하여 AI 최적화 파이프라인을 시작합니다."
      />

      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 mt-6 overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-8">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-4 flex-1 pr-8">
              <StepIcon current={activeStep} stepNum={1} label="데이터 및 문서 업로드" />
              <div className="h-px flex-1 bg-gray-200" />
              <StepIcon current={activeStep} stepNum={2} label="분석 정보 설정" />
              <div className="h-px flex-1 bg-gray-200" />
              <StepIcon current={activeStep} stepNum={3} label="AI 분석 모드 선택" />
            </div>
            <div className="shrink-0 text-[11px] font-bold text-gray-500 uppercase tracking-widest px-4 py-1.5 bg-gray-50 rounded-full border border-gray-200">
              Step {activeStep} of 3
            </div>
          </div>

          {/* Step 1 */}
          {activeStep === 1 && (
            <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-[1.25rem] font-bold text-gray-900 tracking-tight">데이터 및 문서 업로드</h2>
                </div>
              </div>

              {dataSource === null && <SourcePicker onPick={setDataSource} />}

              {dataSource === "upload" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <BackLink onClick={() => setDataSource(null)} />
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      분석 주제 <span className="text-blue-500">(필수)</span>
                    </label>
                    <input
                      ref={domainRef}
                      value={typedDomain ?? run?.domain ?? ""}
                      onChange={(e) => setTypedDomain(e.target.value)}
                      placeholder="예) 흡연, 전기차, 따릉이"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-gray-50 hover:bg-white"
                    />
                  </div>

                  <div className="-mx-2 -mb-2">
                    <UploadPanel ref={uploadRef} domain={domain} facilityType={facility} />
                  </div>
                </div>
              )}

              {dataSource === "preset" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <BackLink onClick={() => setDataSource(null)} />
                  <PresetPicker selected={presetDomain} onSelect={setPresetDomain} />
                </div>
              )}

              {step1Error && (
                <div className="mt-2 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">
                  {step1Error}
                </div>
              )}
            </div>
          )}

          {/* Step 2 */}
          {activeStep === 2 && (
            <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-[1.25rem] font-bold text-gray-900 tracking-tight">분석 정보 설정</h2>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">분석 주제</label>
                  <div className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-sm">
                    {domain ? (
                      <b className="font-mono text-gray-900">{domain}</b>
                    ) : (
                      <span className="text-gray-400">— Step 1 에서 먼저 정합니다</span>
                    )}
                  </div>
                  {runDomain !== domain && (
                    <p className="mt-1.5 text-xs text-gray-400">
                      같은 이름이 이미 있어 저장 폴더는 <code className="font-mono text-gray-500">{runDomain}</code> 입니다.
                    </p>
                  )}
                </div>

                <Field
                  label="시설 유형 (선택)"
                  placeholder="예) 흡연부스"
                  value={facility}
                  onChange={setFacility}
                />
                <Field
                  label="분석 지역 (선택)"
                  placeholder="예) 서울특별시 용산구"
                  value={region}
                  onChange={setRegion}
                  note={
                    isFull
                      ? "⚠ 이 칸은 서버로 안 갑니다. full 모드에서 지역을 정하는 것은 아래 「사용자 의도」 문장입니다."
                      : undefined
                  }
                />

                <div className="sm:col-span-2">
                  <Field
                    label={
                      isFull ? "사용자 의도 (필수)" : "사용자 의도 (이 모드에서는 전송되지 않음)"
                    }
                    placeholder="예) 용산구 흡연부스 부지 선정"
                    value={intent}
                    onChange={setIntent}
                    disabled={!isFull}
                    note={
                      isFull
                        ? "STEP0.5 가 이 문장에서 시설·지역을 확정합니다. 200자까지 작성할 수 있습니다."
                        : undefined
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <Field
                    label={
                      isFull
                        ? "입지 선정 개수 (Top-N)"
                        : "입지 선정 개수 (이 모드에서는 전송되지 않음)"
                    }
                    placeholder={String(TOPN_DEFAULT)}
                    value={topnText}
                    onChange={setTopnText}
                    disabled={!isFull}
                    inputMode="numeric"
                    note={
                      isFull
                        ? `STEP4 가 뽑을 후보 개수입니다. 비우면 기본값 ${TOPN_DEFAULT} 이 쓰입니다. 범위 1~${TOPN_MAX}.`
                        : undefined
                    }
                  />
                  {isFull && topnParsed === "invalid" && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">
                      정수 1~{TOPN_MAX} 만 됩니다.
                    </p>
                  )}
                </div>

                {step2Error && (
                  <div className="sm:col-span-2 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800">
                    {step2Error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3 */}
          {activeStep === 3 && (
            <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-[1.25rem] font-bold text-gray-900 tracking-tight">AI 분석 모드 선택</h2>
                </div>
              </div>

              <PremiumModePicker autoApprove={autoApprove} onChange={setAutoApprove} />

              {inputError && (
                <div className="mt-2 p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900">
                  {inputError}
                </div>
              )}

              {error && (
                <div className="mt-2 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-800 flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  <div className="whitespace-pre-wrap break-all font-mono text-xs">{error}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 바 */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-gray-100 bg-white shrink-0">
          <button
             onClick={() => setActiveStep(activeStep - 1)}
             disabled={activeStep === 1 || starting}
             className="px-6 py-2.5 rounded-xl font-bold text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              이전 단계
            </div>
          </button>

          {activeStep === 3 ? (
            <button
               onClick={onRun}
               disabled={starting || dataSource === null}
               className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md shadow-blue-200 disabled:bg-gray-300 disabled:shadow-none"
            >
              <div className="flex items-center gap-2 text-sm">
                {starting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    파이프라인 가동 중...
                  </>
                ) : (
                  <>
                    분석 시작하기
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </>
                )}
              </div>
            </button>
          ) : (
            <button
               onClick={() => {
                 if (activeStep === 1) void handleStep1Confirm();
                 else handleStep2Confirm();
               }}
               disabled={step1Busy}
               className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 disabled:opacity-60"
            >
              <div className="flex items-center gap-2 text-sm">
                다음 단계
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          )}
        </div>
      </div>
    </PageBody>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Sub Presenter Components
// ─────────────────────────────────────────────────────────────

function StepIcon({ current, stepNum, label }: { current: number; stepNum: number; label: string }) {
  const isDone = current > stepNum;
  const isCurrent = current === stepNum;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
        isDone ? 'bg-blue-600 text-white' : isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm' : 'bg-gray-100 text-gray-400'
      }`}>
        {isDone ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : stepNum}
      </div>
      <span className={`text-sm font-semibold transition-colors duration-300 ${isCurrent ? 'text-gray-900 font-bold' : isDone ? 'text-gray-700' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
      출처 다시 선택
    </button>
  );
}

function SourcePicker({ onPick }: { onPick: (s: DataSource) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onPick("upload")}
        className="group text-left rounded-2xl border-2 border-gray-200 bg-white p-6 transition-all hover:border-blue-400 hover:shadow-md"
      >
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
          직접 데이터를 갖고 계신가요?
        </h3>
        <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
          분석 데이터(.csv·.shp)와 조례 문서(.pdf·.hwpx)를 올려 나만의 파이프라인을 띄웁니다.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onPick("preset")}
        className="group text-left rounded-2xl border-2 border-gray-200 bg-white p-6 transition-all hover:border-blue-400 hover:shadow-md"
      >
        <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
          준비된 데이터셋을 쓰시겠어요?
        </h3>
        <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
          서버에 이미 준비된 픽스처 도메인(흡연·따릉이·전기차 등)을 골라 빠르게 시작합니다.
        </p>
      </button>
    </div>
  );
}

function PresetPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  const [list, setList] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDomains()
      .then((res) => {
        setList(res.filter((d) => d.has_fixture));
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-sm text-gray-400">프리셋 목록을 불러오는 중...</p>;
  if (error) return <p className="text-sm text-red-600 font-mono">불러오기 실패: {error}</p>;

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-3">사용할 프리셋을 선택하세요</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {list.map((d) => (
          <button
            key={d.domain}
            type="button"
            onClick={() => onSelect(d.domain)}
            className={`rounded-xl border p-4 text-left transition-all ${
              selected === d.domain
                ? "border-purple-600 bg-purple-50 ring-2 ring-purple-600/20"
                : "border-gray-200 bg-white hover:border-purple-300"
            }`}
          >
            <b className="font-mono text-sm text-gray-900 block">{d.domain}</b>
            <span className="mt-1 block text-xs text-gray-400">
              조례 {d.law_files}개 · 데이터 {d.data_files}개
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  note,
  disabled,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  note?: string;
  disabled?: boolean;
  inputMode?: "numeric";
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-gray-50 hover:bg-white text-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100"
      />
      {note && <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{note}</p>}
    </div>
  );
}

function PremiumModePicker({
  autoApprove,
  onChange,
}: {
  autoApprove: boolean;
  onChange: (v: boolean) => void;
}) {
  const options = [
    {
      value: false,
      title: "맞춤형 대화 분석 모드",
      badge: "추천",
      badgeColor: "bg-blue-100 text-blue-700",
      note: "분석 중간에 결과와 중요도에 대해 확인하고 수정할 수 있습니다.",
      pros: ["사용자가 직접 설정이 가능해 상세 설정이 가능합니다.", "정교한 맞춤형 최적화로 결과 도출이 가능합니다."],
      cons: ["시간이 조금 더 걸립니다."],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      )
    },
    {
      value: true,
      title: "고속 자동 분석 모드",
      note: "게이트에 서긴 하지만, 그 자리를 AI 제안값으로 자동 승인하고 지나갑니다.",
      pros: ["중간개입없이 빠르고 편리하게 분석을 할 수 있습니다.", "무엇을 자동 승인했는지 산출물에 남습니다."],
      cons: ["사람이 값을 확인하지 않습니다 — 결과에 「AI 제안값 자동승인」으로 표시됩니다."],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 2-2 2.5-3-1v4.5l-3 1.5 2.5 2-1 3 4.5-1 1.5 3 2-2.5 3 1v-4.5l3-1.5-2.5-2 1-3-4.5 1-1.5-3z"></path></svg>
      )
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {options.map((o) => {
        const isSelected = autoApprove === o.value;
        return (
          <div
            key={String(o.value)}
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
              {o.badge && (
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide ${o.badgeColor}`}>
                  {o.badge}
                </span>
              )}
            </div>

            <h3 className={`text-lg font-bold mb-2 transition-colors duration-300 ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
              {o.title}
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
          </div>
        );
      })}
    </div>
  );
}
