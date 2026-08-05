"use client";

/**
 * 화면 1 · 데이터 입력
 * ====================
 * 명세는 「업로드하고 감리를 돌린다」인데, **현재 API 에 업로드도 감리 실행도
 * 없다.** 계약에 있는 것은 `POST /runs` 하나뿐이고 그건 픽스처 재실행(STEP2~4)
 * 이다. 그래서 이 화면은 이렇게 나눈다.
 *
 *   · 지역/시설/의도 입력 · 파일 업로드 → **UI 만.** 눌러도 아무 일이 안 일어난다는
 *     사실을 버튼 옆에 적는다. 되는 척하는 버튼이 제일 나쁘다.
 *   · 「파이프라인 실행」          → 진짜로 동작한다. `POST /runs`.
 *
 * 🔴 `domain` 을 사용자가 고르게 두지 않고 텍스트로 받는 이유 — 도메인 목록
 *    API 가 없다. 목록을 프런트에 박으면 그게 곧 하드코딩이다(절대원칙 2).
 *    최근 성공한 실행의 domain 을 기본값으로 되살려 준다.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { MODE_FIXTURE, MODE_HITL } from "@/lib/omnisite/pipeline";
import { useRun } from "@/lib/omnisite/RunProvider";
import { PROGRESS_PATH, SCREENS } from "@/lib/omnisite/screens";

const SCREEN = SCREENS[0]!;

export default function Screen1Page() {
  const router = useRouter();
  const { run, starting, error, start } = useRun();
  /**
   * 🔴 `useState(run?.domain ?? "")` 였다. **프리필이 조용히 실패한다** —
   *    `run` 은 localStorage 의 id 를 서버에 되물어 복원하므로 첫 렌더엔 항상
   *    `null` 이고, `useState` 초깃값은 그 한 번만 읽힌다. 나중에 `run` 이 와도
   *    칸은 빈 채로 남고, 실행 버튼이 계속 비활성이다(직접 타이핑해야 풀린다).
   *    의도는 코드에 적혀 있는데 동작은 안 하던 자리다.
   *
   *    effect 로 동기화하면 렌더가 한 번 더 돌고 사람이 입력하던 값을 덮어쓸 수
   *    있다. 그래서 `GridMap` 의 `userView ?? fitView(...)` 와 같은 형태로 둔다 —
   *    **사람이 친 것만 상태**고, 안 쳤으면 현재 실행에서 파생한다.
   */
  const [typedDomain, setTypedDomain] = useState<string | null>(null);
  const domain = typedDomain ?? run?.domain ?? "";
  const setDomain = setTypedDomain;
  const [region, setRegion] = useState("");
  const [facility, setFacility] = useState("");
  const [intent, setIntent] = useState("");
  const [tab, setTab] = useState<"data" | "law">("data");
  /**
   * 🔴 기본값이 `fixture` 인 이유는 "안전해서" 가 아니라 **회귀 기준선이기 때문**이다.
   *    픽스처는 사람 입력 없이 끝까지 가고 값이 고정돼 있다. `hitl` 은 두 번 멈춰
   *    사람을 기다리므로, 모르고 고르면 진행현황에서 멈춘 채로 방치된다.
   *    그래서 고를 수 있게 하되 **각각이 무엇인지 옆에 적는다.**
   */
  const [mode, setMode] = useState<string>(MODE_FIXTURE);

  /**
   * 🔴 **칸에 글자가 보이는데 버튼이 꺼져 있었다.** 실측 2026-08-05, 사람이 신고.
   *    화면은 「위 칸이 비어 있어 버튼이 꺼져 있습니다」 라고 적고 있었는데
   *    칸에는 `흡연` 이 또렷이 보였다 — **화면이 거짓말을 했다**(절대원칙 4).
   *
   *    원인은 `input` 의 **DOM 값과 React 상태가 갈라진 것**이다. 브라우저 자동완성은
   *    사용자가 예전에 친 값을 `input.value` 에 직접 써 넣는데, 그때 React 의
   *    `onChange` 가 안 불릴 수 있다. 개발 서버의 Fast Refresh 도 같은 결과를 만든다.
   *    그러면 눈에는 값이 있고 `typedDomain` 은 `null` 이라 `canRun` 이 false 다.
   *
   *    재현 확인 — `input.value` 만 바꾸고 이벤트를 안 보내면 신고된 화면이 그대로 나온다.
   *
   *    그래서 **DOM 을 한 번 확인한다.** 마운트 시점에 칸에 값이 있는데 상태가 비어
   *    있으면 상태를 그 값으로 맞춘다. 사람이 친 값은 이미 상태에 있으므로 덮어쓰지
   *    않는다(`typedDomain === null` 일 때만).
   *
   *    ⚠ 이걸로 **전부 막지는 못한다.** 마운트 후에 자동완성이 걸리면 이 effect 는
   *      다시 안 돈다. 다만 크롬은 그 경우 `input` 이벤트를 쏘므로 `onChange` 가 잡는다.
   *      남는 틈이 있다는 걸 알고 두는 것이지, 다 막았다고 보지 않는다(원칙 5).
   */
  const domainRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = domainRef.current;
    if (el && typedDomain === null && el.value.trim()) setTypedDomain(el.value);
  }, [typedDomain]);

  /**
   * 🔴 **버튼을 조건부로 끄는 방식을 버렸다.** 실측 2026-08-05 — 위 effect 를 넣고도
   *    사람 브라우저에서는 여전히 안 눌렸다. 두 번 고쳤는데 두 번 다 빗나갔다.
   *
   *    문제는 개별 원인이 아니라 **구조**다. 버튼이 꺼져 있으면 눌러도 아무 일이
   *    안 일어나고, 그러면 **왜 안 되는지 알아낼 방법이 화면에 없다.** 원인이
   *    자동완성이든 IME 조합 중이든 내가 아직 모르는 무엇이든, 증상이 전부
   *    「무반응」 하나로 뭉개진다. 조용한 실패다(절대원칙 1).
   *
   *    그래서 **버튼은 항상 눌린다.** 값이 없으면 그 사실을 말한다. 못 하는 일을
   *    막는 것보다 **왜 못 하는지 말하는 쪽**이 낫다 — 사람이 다음 행동을 고를 수 있다.
   */
  const [inputError, setInputError] = useState<string | null>(null);

  async function onRun() {
    // 상태가 아니라 **칸에 실제로 있는 값**을 읽는다. 둘이 갈라졌을 때
    // 사람이 보고 있는 쪽이 옳다.
    const fromDom = domainRef.current?.value ?? "";
    const value = (fromDom || domain).trim();
    if (!value) {
      setInputError("도메인이 비어 있습니다. 「도메인」 칸에 실행할 도메인을 입력해 주세요. (예: 흡연)");
      domainRef.current?.focus();
      return;
    }
    setInputError(null);
    // 칸의 값으로 상태를 맞춰 둔다 — 다음 렌더에서 글자가 사라지지 않게.
    if (fromDom.trim() && fromDom !== typedDomain) setTypedDomain(fromDom);
    const id = await start(value, mode);
    if (id) router.push(PROGRESS_PATH);
  }

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="지역·시설을 먼저 정하고 업로드한다. 지도는 아직 필요 없다."
      />

      <OutOfScope />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── 업로드 (UI 만) ─────────────────────────────── */}
        <section className="glass-panel rounded-xl p-5 opacity-70">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold">데이터 업로드</h2>
            <NotConnected />
          </div>

          <div className="mt-4 flex gap-1 rounded-lg bg-black/[0.04] p-1 text-[13px]">
            {(
              [
                ["data", "① 분석 데이터", "SHP · CSV · XLSX"],
                ["law", "② 조례 · 법규", "PDF · HWP"],
              ] as const
            ).map(([k, label, hint]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex-1 rounded-md px-3 py-2 text-left transition-colors ${
                  tab === k ? "bg-white shadow-sm" : "text-ink-secondary"
                }`}
              >
                <div className="font-medium">{label}</div>
                <div className="text-[11px] text-ink-secondary">{hint}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid place-items-center rounded-lg border-2 border-dashed border-hairline py-12 text-center">
            <div className="text-[28px]">📁</div>
            <p className="mt-2 text-[13px] font-medium">파일 업로드</p>
            <p className="text-[12px] text-ink-secondary">폴더째 드래그 가능</p>
            <button type="button" disabled className="btn-secondary mt-3 cursor-not-allowed text-[12px]">
              파일 선택 (업로드 API 없음)
            </button>
          </div>

          <p className="mt-3 text-[11px] text-ink-secondary">
            업로드된 파일은 STEP0 프로파일링을 거쳐 <code>profiles.json</code> 이
            됩니다. 그 산출물도 현재 화이트리스트에 없어 화면 1 은 읽을 수 없습니다.
          </p>
        </section>

        {/* ── 대상 정의 (UI 만) + 실행 (진짜) ──────────────── */}
        <div className="flex flex-col gap-6">
          <section className="glass-panel rounded-xl p-5 opacity-70">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-semibold">분석 대상</h2>
              <NotConnected />
            </div>
            <p className="mt-1 text-[11px] text-ink-secondary">
              도메인 무관 엔진이므로 지역·시설은 사람이 반드시 지정해야 한다.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Field label="분석 지역" placeholder="예) 서울특별시 용산구" value={region} onChange={setRegion} />
              <Field label="시설 유형" placeholder="예) 흡연부스" value={facility} onChange={setFacility} />
              <Field label="사용자 의도 (선택)" placeholder="한 줄 입력 — 없어도 됨" value={intent} onChange={setIntent} />
            </div>
          </section>

          <section className="glass-panel rounded-xl border-primary/30 p-5">
            <h2 className="text-[14px] font-semibold">파이프라인 실행</h2>
            <p className="mt-1 text-[11px] text-ink-secondary">
              고정된 감리 결과(픽스처)를 기점으로 돌립니다. 위의 입력값은 쓰지
              않습니다 — 계약에 그런 필드가 없습니다.
            </p>

            <label className="mt-4 block text-[12px] font-medium">
              도메인
              <input
                ref={domainRef}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="예) 흡연"
                className="text-input-notion mt-1 w-full"
              />
            </label>

            <ModePicker mode={mode} onChange={setMode} />

            {/*
             * 🔴 `disabled={!canRun}` 이었다. **두 번 고쳤는데 두 번 다 못 잡았다.**
             *    이제 실행 중에만 끈다 — 값이 없어서 끄지 않는다. 눌러 보면
             *    **무슨 일이 일어나든 화면이 말을 한다.**
             */}
            <button
              type="button"
              onClick={onRun}
              disabled={starting}
              className="btn-primary mt-4 w-full text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {starting ? "실행 요청 중…" : "파이프라인 실행"}
            </button>

            {inputError && (
              <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                {inputError}
              </p>
            )}

            {error && (
              <pre className="mt-3 whitespace-pre-wrap break-all rounded border border-red-200 bg-red-50 p-2 font-mono text-[11px] text-red-800">
                {error}
              </pre>
            )}

            {run && (
              <p className="mt-3 text-[11px] text-ink-secondary">
                현재 실행 <span className="tnum font-medium text-ink">{run.run_id}</span> ·{" "}
                {run.domain} · {run.mode}
              </p>
            )}
          </section>
        </div>
      </div>

      <PageFooter screen={SCREEN} />
      <SourceNote files={["profiles.json (STEP0) — 현재 API 미노출"]} />
    </PageBody>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[12px] font-medium">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-input-notion mt-1 w-full"
      />
    </label>
  );
}

/**
 * 실행 방식 고르기.
 *
 * 🔴 이름을 「빠름/느림」 같은 걸로 바꾸지 않는다. 서버가 받는 값 그대로
 *    (`fixture` · `hitl`) 보여준다 — 400 이 났을 때 사유(`지원하지 않는 mode 입니다:
 *    '…'`)와 화면의 낱말이 맞아야 사람이 잇는다.
 */
function ModePicker({ mode, onChange }: { mode: string; onChange: (v: string) => void }) {
  const options: { value: string; title: string; note: string }[] = [
    {
      value: MODE_FIXTURE,
      title: "fixture — 사람에게 안 묻고 끝까지",
      note: "게이트가 서지 않습니다. 회귀 기준선이라 값이 고정돼 있습니다.",
    },
    {
      value: MODE_HITL,
      title: "hitl — 두 번 멈추고 사람에게 묻습니다",
      note: "게이트A(화면 2 · 감리 확인) · 게이트B(화면 3 · 집계반경 + 가중치)에서 멈춥니다. 답하기 전까지 진행되지 않습니다.",
    },
  ];

  return (
    <fieldset className="mt-4">
      <legend className="text-[12px] font-medium">실행 방식</legend>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2 text-[12px] ${
              mode === o.value ? "border-primary/40 bg-primary/[0.05]" : "border-hairline bg-white"
            }`}
          >
            <input
              type="radio"
              name="run-mode"
              className="mt-0.5"
              checked={mode === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>
              <span className="font-medium">{o.title}</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-secondary">
                {o.note}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function NotConnected() {
  return (
    <span className="rounded border border-hairline bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-ink-secondary">
      API 미연결
    </span>
  );
}

function OutOfScope() {
  return (
    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
      <p className="font-semibold">이 화면의 업로드·감리는 아직 서버에 연결돼 있지 않습니다.</p>
      <p className="mt-1">
        계약(<code>pipeline_run_contract.md</code>)에 있는 엔드포인트는 <b>여섯 개</b>입니다 —
        실행 생성 · 상태 조회 · 산출물 내려받기 · 실행 로그 · 게이트A 답변 · 게이트B 답변.
        <b>업로드와 감리 실행은 그중에 없습니다.</b> 업로드 라우터는 서버에 등록조차
        돼 있지 않고(<code>app/main.py:95-99</code>), 사유는 기능이 아니라 구조입니다 —
        모듈 최상단에서 벡터DB 에 접속해 import 가 525.7초 걸립니다.
      </p>
      <p className="mt-1">
        입력칸과 업로드 영역은 화면 구조를 확정해 두기 위한 것이고, 눌러도 아무 일도
        일어나지 않습니다. <b>되는 것처럼 보이게 만들지 않았습니다.</b>
      </p>
      <p className="mt-1">
        🔴 여기 「HITL 확정 API 도 없다」고 적혀 있었습니다. <b>2026-08-05 부터 틀린
        말입니다</b> — 게이트 답변 API 는 서버에 있고, 아래 「실행 방식」에서
        <code> hitl</code> 을 고르면 화면 2 · 화면 3 에서 실제로 답할 수 있습니다.
        업로드·감리 실행이 없다는 위 문단과는 <b>별개의 이야기</b>입니다.
      </p>
    </div>
  );
}
