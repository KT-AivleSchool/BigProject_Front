import { Info, ChevronRight, Loader2 } from "lucide-react";

interface SetupStepProps {
  step: number;
  topic: string;
  setTopic: (val: string) => void;
  purpose: string;
  setPurpose: (val: string) => void;
  isLoading: boolean;
  /**
   * 시작해도 되는가. 🔴 `isLoading` 과 **다른 것**이다 — 이건 「입력이 갖춰졌나」이고
   * `isLoading` 은 「지금 도는 중인가」다. 둘을 한 값으로 합치면 위치를 못 고른 상태와
   * 발굴 중인 상태가 같은 문구를 쓴다.
   */
  canStart: boolean;
  /**
   * 못 시작하는 사유. `null` 이면 시작할 수 있다.
   * 🔴 버튼만 끄고 사유를 안 적으면 **누른 사람은 화면이 고장 난 줄 안다.**
   *    무엇이 없어서 못 하는지는 사유를 만든 쪽(page.tsx)만 안다 — 여기서 추측하지 않는다.
   */
  blockedReason: string | null;
  generatePersonas: () => void;
}

export function SetupStep({
  step,
  topic,
  setTopic,
  purpose,
  setPurpose,
  isLoading,
  canStart,
  blockedReason,
  generatePersonas,
}: SetupStepProps) {
  return (
    <div className={`transition-all duration-700 ease-in-out transform ${step === 1 ? 'translate-x-0 opacity-100 relative' : '-translate-x-full opacity-0 absolute top-0 w-full pointer-events-none'}`}>
      <div className="glass-panel max-w-3xl mx-auto p-8 rounded-2xl">
        <h2 className="font-semibold text-[20px] mb-6 text-ink flex items-center tracking-tight">
          <span className="bg-primary/10 text-primary p-2.5 rounded-lg mr-3"><Info size={20} /></span>
          다자간 공청회 안건 셋업
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-[13px] font-semibold text-ink-secondary mb-2 ml-1">공청회 핵심 주제</label>
            <input 
              className="text-input-notion w-full p-3.5 text-[15px]" 
              value={topic} 
              onChange={e => setTopic(e.target.value)} 
              placeholder="예: 스마트 흡연부스 설치" 
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-ink-secondary mb-2 ml-1">설치 목적 및 기대 효과</label>
            <input 
              className="text-input-notion w-full p-3.5 text-[15px]" 
              value={purpose} 
              onChange={e => setPurpose(e.target.value)} 
              placeholder="예: 지역상권 활성화 및 담배꽁초 무단투기 방지" 
            />
          </div>
          <button
            onClick={generatePersonas}
            disabled={isLoading || !canStart}
            className="btn-primary w-full mt-4 py-3.5 text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" /> 대상지 주변 이해관계자 맵핑 중...</>
            ) : (
              <>페르소나 자동 발굴 시작 <ChevronRight size={18} /></>
            )}
          </button>
          {blockedReason && !isLoading && (
            <p className="text-[13px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {blockedReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
