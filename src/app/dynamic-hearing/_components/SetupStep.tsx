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
      <div className="p-8 border border-white/40 rounded-3xl bg-white/60 backdrop-blur-2xl shadow-xl shadow-slate-200/50 max-w-3xl mx-auto">
        <h2 className="font-bold text-2xl mb-6 text-slate-800 flex items-center">
          <span className="bg-blue-100 text-blue-600 p-2.5 rounded-xl mr-3 shadow-sm"><Info size={22} /></span>
          다자간 공청회 안건 셋업
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">공청회 핵심 주제</label>
            <input 
              className="w-full border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-4 rounded-2xl text-lg text-slate-800 transition-all outline-none bg-white/90 shadow-inner" 
              value={topic} 
              onChange={e => setTopic(e.target.value)} 
              placeholder="예: 스마트 흡연부스 설치" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">설치 목적 및 기대 효과</label>
            <input 
              className="w-full border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-4 rounded-2xl text-lg text-slate-800 transition-all outline-none bg-white/90 shadow-inner" 
              value={purpose} 
              onChange={e => setPurpose(e.target.value)} 
              placeholder="예: 지역상권 활성화 및 담배꽁초 무단투기 방지" 
            />
          </div>
          <button 
            onClick={generatePersonas} 
            disabled={isLoading} 
            className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4.5 rounded-2xl text-lg font-bold hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all flex items-center justify-center gap-2 group"
          >
            {isLoading ? (
              <><Loader2 className="animate-spin" /> 대상지 주변 이해관계자 맵핑 중...</>
            ) : (
              <>페르소나 자동 발굴 시작 <ChevronRight className="group-hover:translate-x-1 transition-transform" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
