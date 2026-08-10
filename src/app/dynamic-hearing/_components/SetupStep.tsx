import { Info, ChevronRight, Loader2 } from "lucide-react";

interface SetupStepProps {
  step: number;
  topic: string;
  setTopic: (val: string) => void;
  purpose: string;
  setPurpose: (val: string) => void;
  isLoading: boolean;
  generatePersonas: () => void;
}

export function SetupStep({ step, topic, setTopic, purpose, setPurpose, isLoading, generatePersonas }: SetupStepProps) {
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
            disabled={isLoading} 
            className="btn-primary w-full mt-4 py-3.5 text-[15px] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" /> 대상지 주변 이해관계자 맵핑 중...</>
            ) : (
              <>페르소나 자동 발굴 시작 <ChevronRight size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
