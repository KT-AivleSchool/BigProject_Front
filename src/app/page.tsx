"use client";
// Trigger HMR

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageBody, PageHeader } from "@/components/ui/Page";
import { UploadPanel } from "@/components/upload/UploadPanel";
import {
  MODE_FIXTURE,
  MODE_FULL,
  MODE_HITL,
  TOPN_DEFAULT,
  TOPN_MAX,
} from "@/lib/omnisite/pipeline";
import { useRun } from "@/lib/omnisite/RunProvider";
import { SCREENS } from "@/lib/omnisite/screens";
import { fetchDomains, type DomainItem } from "@/lib/omnisite/upload";

const SCREEN = SCREENS[0]!;

/**
 * 데이터 출처. 이 선택이 **쓸 수 있는 mode 를 정한다** — 둘은 독립이 아니다.
 *
 *   upload → `full` 만.  `user_input` 필수 · `topn` 선택(기본 20)
 *   preset → `fixture` · `hitl`.  둘 다 `data_임시/<도메인>_FIX/` 를 요구하고,
 *            `user_input`·`topn` 을 같이 보내면 **400** 이다(계약 8-2).
 *
 * 실측 근거: `app/services/pipeline_runner.py:803-818`.
 */
type DataSource = "upload" | "preset";

export default function Screen1Page() {
  const router = useRouter();
  const { run, starting, error, start } = useRun();

  const [dataSource, setDataSource] = useState<DataSource | null>(null);

  // 업로드 갈래에서 사람이 치는 도메인. 프리셋 갈래에서는 카드가 정한다.
  const [typedDomain, setTypedDomain] = useState<string | null>(null);
  const [presetDomain, setPresetDomain] = useState<string | null>(null);
  const domain =
    dataSource === "preset"
      ? (presetDomain ?? "")
      : (typedDomain ?? run?.domain ?? "");

  const [facility, setFacility] = useState("");
  const [region, setRegion] = useState("");
  const [intent, setIntent] = useState("");
  // 🔴 문자열로 들고 있는다. 숫자로 두면 지울 때 0 이 되고, 0 은 서버가 400 으로
  //    막는 **다른 값**이다. 빈 칸은 "안 정했다"이고 그때만 기본값 20 이 쓰인다.
  const [topnText, setTopnText] = useState(String(TOPN_DEFAULT));

  const [mode, setMode] = useState<string>(MODE_HITL);
  const [inputError, setInputError] = useState<string | null>(null);

  const [activeStep, setActiveStep] = useState(1);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  const domainRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = domainRef.current;
    if (el && typedDomain === null && el.value.trim()) setTypedDomain(el.value);
  }, [typedDomain]);

  // 업로드 갈래는 `full` 고정이다 — 그 경로에 자동 완주 모드가 **없다.**
  const effectiveMode = dataSource === "upload" ? MODE_FULL : mode;
  const isFull = effectiveMode === MODE_FULL;

  const topnParsed = parseTopn(topnText);

  function handleStep1Confirm() {
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

    const id = await start(
      value,
      effectiveMode,
      isFull
        ? {
            user_input: intent.trim(),
            // 빈 칸이거나 유효하지 않으면 아예 안 보낸다(기본값 20 사용). "invalid"는 이미 Step 2에서 막힌다.
            ...(topnParsed === "empty" || topnParsed === "invalid" ? {} : { topn: topnParsed as number }),
          }
        : undefined,
    );
    if (id) router.push("/audit");
  }

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="분석할 지역과 시설을 정의하고, 필요한 데이터를 업로드하여 AI 최적화 파이프라인을 시작합니다."
      />

      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 mt-6 overflow-hidden min-h-0">
        
        {/* 전체 컨텐츠 스크롤 영역 */}
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

          {/* ── Step 1 ── */}
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
                      분석 도메인 <span className="text-blue-500">(필수)</span>
                    </label>
                    <input
                      ref={domainRef}
                      value={typedDomain ?? run?.domain ?? ""}
                      onChange={(e) => setTypedDomain(e.target.value)}
                      placeholder="예) 흡연, 전기차, 따릉이"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-gray-50 hover:bg-white"
                    />
                    <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                      업로드 API 7개가 전부 <code className="font-mono">domain</code> 을 요구합니다.
                      먼저 정해야 아래 상자가 열립니다 — 기본값을 두면 다른 지자체 파일이 엉뚱한 폴더로 조용히 들어갑니다.
                    </p>
                  </div>
                  <p className="mb-4 text-sm text-gray-500">
                    조례는 <code className="font-mono text-xs">data_임시/&lt;도메인&gt;/law/</code>,
                    데이터는 <code className="font-mono text-xs">.../data/</code> 로 갑니다 —
                    파이프라인이 실제로 읽는 폴더입니다.
                  </p>
                  <div className="-mx-2 -mb-2">
                    <UploadPanel domain={domain} facilityType={facility} />
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

          {/* ── Step 2 ── */}
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
                      ? "⚠ 이 칸은 서버로 안 갑니다. full 모드에서 지역을 정하는 것은 아래 「사용자 의도」 문장입니다 — STEP0.5 가 거기서 읽습니다."
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
                        ? "STEP0.5 가 이 문장에서 시설·지역을 확정합니다. 200자까지, '--' 로 시작할 수 없습니다."
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
                        ? `STEP4 가 뽑을 후보 개수입니다 — 화면4 목록의 길이이자 화면5 가 고를 수 있는 후보의 수입니다. 비우면 서버 기본값 ${TOPN_DEFAULT} 이 쓰입니다. 범위 1~${TOPN_MAX}.`
                        : undefined
                    }
                  />
                  {isFull && topnParsed === "invalid" && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">
                      정수 1~{TOPN_MAX} 만 됩니다. 지금 값은 서버가 400 으로 막습니다.
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

          {/* ── Step 3 ── */}
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

              {dataSource === "upload" ? (
                <FullModeNotice />
              ) : (
                <PremiumModePicker mode={mode} onChange={setMode} />
              )}

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

        {/* 바닥 내비게이션 바 */}
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
               onClick={activeStep === 1 ? handleStep1Confirm : handleStep2Confirm}
               className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
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

/**
 * `topnText` 를 서버에 보낼 값으로 바꾼다.
 *
 * 셋으로 갈리는 이유 — `""` 와 `"0"` 은 **다른 뜻**이다. 빈 칸은 "안 정했다"라
 * 서버 기본값에 맡기면 되고, `0` 은 서버가 400 으로 막는 틀린 값이다. 하나로
 * 뭉개면 사용자가 지운 것과 잘못 친 것이 같아진다.
 */
function parseTopn(text: string): number | "empty" | "invalid" {
  const t = text.trim();
  if (!t) return "empty";
  if (!/^\d+$/.test(t)) return "invalid";
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > TOPN_MAX) return "invalid";
  return n;
}

function StepIcon({ current, stepNum, label }: { current: number; stepNum: number; label: string }) {
  const isActive = current === stepNum;
  const isPast = current > stepNum;
  
  return (
    <div className={`flex items-center gap-3 transition-opacity ${isActive ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[13px] font-bold shadow-sm ${
        isActive ? 'bg-blue-600 text-white' : isPast ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'
      }`}>
        {isPast ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : stepNum}
      </div>
      <span className={`text-[14px] font-bold ${isActive ? 'text-blue-900' : 'text-gray-500'}`}>
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
      className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      다른 방식 선택하기
    </button>
  );
}

function SourcePicker({ onPick }: { onPick: (s: DataSource) => void }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onPick("upload")}
        className="flex flex-col items-center justify-center p-8 border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-300 group"
      >
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">실제 데이터 업로드</h3>
        <p className="text-sm text-gray-500 text-center">
          분석하고 싶은 새로운 지역의 공간 데이터와 규정 문서를
          <br />
          직접 등록하여 처음부터 꼼꼼하게 분석을 시작합니다.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onPick("preset")}
        className="flex flex-col items-center justify-center p-8 border-2 border-gray-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-all duration-300 group"
      >
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">프리셋 모드 (DB 데이터)</h3>
        <p className="text-sm text-gray-500 text-center">
          시스템에 이미 잘 정제되어 저장된 지역 데이터를 골라
          <br />
          즉시 분석을 실행하고 결과를 빠르게 확인합니다.
        </p>
      </button>
    </div>
  );
}

/**
 * 프리셋 도메인 카드.
 *
 * 🔴 목록을 **화면이 들고 있지 않는다.** `GET /api/v1/upload/domains` 가 주는
 *    것만 그린다 — 도메인 이름은 도메인 값이라 프런트가 지어내면 원칙 2 위반이고,
 *    실제로 서버에 없는 도메인을 골라 400 을 맞게 된다.
 *
 * 🔴 「용산구 흡연부스」 같은 **표시명은 API 에 없다.** 응답에 있는 건
 *    `domain`·`law_files`·`data_files`·`has_audit_reviewed`·`has_fixture` 다.
 *    그래서 폴더명을 그대로 보여준다 — 예쁜 이름을 프런트에 적어두면
 *    도메인이 늘 때마다 화면이 거짓말한다.
 *    ⚠ 예전엔 「넷뿐이다(실측 2026-08-10)」라고 적혀 있었다. `has_fixture` 가
 *      나중에 생겼는데 이 주석만 안 고쳐져, **필드가 이미 있는데도 프런트가
 *      「서버가 안 준다」를 근거로 안내를 포기하고 있었다.**
 */
function PresetPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  const [items, setItems] = useState<DomainItem[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  /** 「다시 시도」용. 값 자체엔 의미가 없고 effect 를 한 번 더 돌리는 방아쇠다. */
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * 🔴 `setFailure(null)` 을 첫 await **앞**에 두면 그게 곧 effect 본문의 동기
   *    setState 라 `react-hooks/set-state-in-effect` 에 걸린다. 상태 초기화를
   *    응답이 온 뒤로 미루면 규칙도 만족하고, 재시도 중에 옛 오류가 잠깐
   *    사라졌다 다시 뜨는 깜빡임도 없다.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchDomains();
        if (cancelled) return;
        setItems(list);
        setFailure(null);
      } catch (e) {
        if (cancelled) return;
        setItems(null);
        setFailure(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (failure !== null) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">도메인 목록을 못 받았습니다.</p>
        <p className="mt-1 font-mono text-xs break-all">{failure}</p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (items === null) {
    return <p className="text-sm text-gray-500">도메인 목록을 불러오는 중…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        서버에 등록된 도메인이 없습니다. 「실제 데이터 업로드」로 먼저 올리세요.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => {
          const on = d.domain === selected;
          return (
            <button
              key={d.domain}
              type="button"
              onClick={() => onSelect(d.domain)}
              className={`text-left rounded-2xl border-2 p-5 transition-all duration-200 ${
                on
                  ? "border-indigo-500 bg-indigo-50/40 shadow-md ring-4 ring-indigo-500/10"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-gray-900 break-all">{d.domain}</h3>
                <span
                  className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 ${
                    on ? "border-indigo-600 bg-indigo-600" : "border-gray-300 bg-white"
                  }`}
                />
              </div>
              <dl className="mt-3 space-y-1 text-[12px] text-gray-600">
                <div className="flex justify-between">
                  <dt>조례 문서</dt>
                  <dd className="tnum font-medium">{d.law_files}건</dd>
                </div>
                <div className="flex justify-between">
                  <dt>분석 데이터</dt>
                  <dd className="tnum font-medium">{d.data_files}건</dd>
                </div>
                <div className="flex justify-between">
                  <dt>감리 확정본</dt>
                  <dd className="font-medium">{d.has_audit_reviewed ? "있음" : "없음"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>재실행 기준선</dt>
                  <dd className="font-medium">{d.has_fixture ? "있음" : "없음"}</dd>
                </div>
              </dl>
              {d.data_files === 0 && (
                <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
                  분석 데이터가 0건입니다 — STEP0 을 도는 모드로는 서버가 400 을 돌려줍니다.
                </p>
              )}
              {/**
                * 🔴 이 도메인은 **아래 두 모드 중 하나도 못 고른다.** 그 말을 카드에서
                *    안 하면, 모드를 고르고 「분석 시작」을 누른 **뒤에야** 400 을 만난다
                *    — 화면이 되는 것처럼 그려놓고 실행에서 죽는 건 조용한 실패다(원칙 1).
                * ⚠ **사유는 안 적는다.** 서버가 `has_fixture` 만 주고 막힌 이유는
                *   일부러 뺐다(저장소 절대경로가 새기 때문). 프런트가 「_FIX 폴더가
                *   없어서」 같은 말을 지어내면 그건 실측이 아니라 추측이다(원칙 4·5).
                */}
              {!d.has_fixture && (
                <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
                  재실행 기준선이 없습니다 — 이 도메인은 <b>맞춤형 대화 분석</b>·
                  <b>고속 자동 분석</b> 두 모드 다 서버가 400 을 돌려줍니다. (사유는
                  서버가 알려주지 않습니다.)
                </p>
              )}
            </button>
          );
        })}
      </div>

    </>
  );
}

/** 업로드 갈래는 모드를 고를 게 없다. **그 사실 자체를 화면에 적는다.** */
function FullModeNotice() {
  return (
    <div className="rounded-2xl border-2 border-blue-500 bg-blue-50/40 p-6 ring-4 ring-blue-500/10">
      <h3 className="text-lg font-bold text-blue-900">
        전체 파이프라인
        <span className="ml-2 inline-flex items-center text-[10px] font-mono font-medium text-gray-500 bg-black/5 px-2 py-0.5 rounded-md align-middle">
          mode=full
        </span>
      </h3>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">
        업로드한 도메인은 STEP0(프로파일링)부터 STEP4·DB 적재까지 10칸을 돕니다.
      </p>
      <ul className="mt-4 list-disc pl-5 text-[13px] text-gray-600 space-y-1">
        <li>
          <b>게이트 2개가 섭니다</b> — 화면2(감리 확인)·화면3(가중치)에서 답해야 이어집니다.
          업로드 경로에는 <b>게이트 없는 자동 모드가 없습니다.</b>
        </li>
        <li>실행 조건(alpha·decay·scale·spacing)은 고정입니다. 사람이 정하는 건 사용자 의도와 Top-N 개수 둘뿐입니다.</li>
        <li>게이트 대기를 뺀 실행 시간은 약 5분입니다(감리·상위법 검색이 그중 대부분).</li>
      </ul>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  note,
  disabled,
  inputMode,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  /**
   * 이 값이 **어디로 가는지**. 안 적으면 사용자는 입력한 값이 서버로 간다고
   * 읽는다 — 모드에 따라 실제로는 아무 데도 안 가는 칸이 있다.
   * 화면이 말하지 않으면 화면이 거짓말한 것이다(원칙 4).
   */
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

function PremiumModePicker({ mode, onChange }: { mode: string; onChange: (v: string) => void }) {
  const options = [
    {
      value: MODE_HITL,
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
      value: MODE_FIXTURE,
      title: "고속 자동 분석 모드",
      note: "AI가 자동으로 분석을 합니다.",
      pros: ["중간개입없이 빠르고 편리하게 분석을 할 수 있습니다.", "이미 검증된 방식으로 분석합니다."],
      cons: ["커스텀이 불가능합니다."],
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
