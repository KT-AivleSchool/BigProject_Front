import { Users, Loader2, Check, Play } from "lucide-react";

interface PersonaStepProps {
  step: number;
  personas: any[];
  selectedPersonaIds: Set<number>;
  togglePersona: (idx: number) => void;
  fetchMorePersonas: () => void;
  isLoading: boolean;
  startDiscussion: () => void;
  setStep: (step: 1 | 2 | 3) => void;
}

export function PersonaStep({ 
  step, 
  personas, 
  selectedPersonaIds, 
  togglePersona, 
  fetchMorePersonas, 
  isLoading, 
  startDiscussion,
  setStep
}: PersonaStepProps) {
  return (
    <div className={`transition-all duration-700 ease-in-out transform ${step === 2 ? 'translate-x-0 opacity-100 relative' : (step < 2 ? 'translate-x-full opacity-0 absolute top-0 w-full pointer-events-none' : '-translate-x-full opacity-0 absolute top-0 w-full pointer-events-none')}`}>
      <div className="p-8 border border-white/40 rounded-3xl bg-white/60 backdrop-blur-2xl shadow-xl shadow-slate-200/50">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-bold text-2xl mb-2 text-slate-800 flex items-center">
              <span className="bg-indigo-100 text-indigo-600 p-2.5 rounded-xl mr-3 shadow-sm"><Users size={22} /></span>
              이해관계자 페르소나 확정 (HITL)
            </h2>
            <p className="text-slate-500 ml-14 font-medium">자동 발굴된 페르소나 중 공청회 시뮬레이션에 참여할 대상을 직접 선택해주세요.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => fetchMorePersonas()} 
              disabled={isLoading}
              className="text-sm font-bold bg-white text-indigo-600 px-4 py-2 rounded-full border border-indigo-200 shadow-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : "✨"} AI 새로운 인물 추가 발굴
            </button>
            <div className="text-sm font-bold bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full border border-indigo-100">
              선택됨: {selectedPersonaIds.size}명 / 전체 {personas.length}명
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes staggerFadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}} />

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 mb-8 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-indigo-500 space-y-4">
            <Loader2 size={36} className="animate-spin" />
            <p className="font-bold text-lg animate-pulse">AI가 조례와 지역 데이터를 분석하여 새로운 페르소나를 발굴 중입니다...</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {personas.map((p, idx) => {
            const isSelected = selectedPersonaIds.has(idx);
            return (
              <div 
                key={idx} 
                onClick={() => togglePersona(idx)}
                style={{ animation: `staggerFadeIn 0.5s ease-out ${idx * 0.15}s both` }}
                className={`cursor-pointer border-2 p-6 rounded-3xl transition-all duration-300 relative group overflow-hidden ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-50/60 shadow-lg shadow-indigo-100/50 scale-[1.02]' 
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className={`absolute top-5 right-5 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 text-transparent bg-slate-50 group-hover:border-indigo-200'
                }`}>
                  <Check size={16} strokeWidth={3} />
                </div>
                
                <div className="pr-10">
                  <div className="inline-block px-3.5 py-1.5 rounded-full text-xs font-bold mb-4 shadow-sm bg-slate-200 text-slate-700">
                    중요도: {p.importance_grade || 'C'}
                  </div>
                  <h3 className="font-extrabold text-lg text-slate-800 mb-1.5">[{p.role}] {p.name}</h3>
                  <p className="text-sm text-slate-600 mb-5 line-clamp-3 leading-relaxed">{p.description}</p>
                  
                  <div className="flex gap-2 flex-wrap">
                    {p.keywords?.slice(0, 3).map((kw: string, kIdx: number) => (
                      <span key={kIdx} className="bg-white/80 border border-slate-200 px-2.5 py-1 rounded-lg text-xs text-slate-500 font-semibold shadow-sm">#{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-10 flex gap-4">
          <button 
            onClick={() => setStep(1)} 
            className="flex-1 bg-white border-2 border-slate-200 text-slate-600 px-6 py-4.5 rounded-2xl text-lg font-bold hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            다시 설정하기
          </button>
          <button 
            onClick={startDiscussion} 
            disabled={selectedPersonaIds.size === 0} 
            className="flex-[2] bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-4.5 rounded-2xl text-lg font-bold hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all flex items-center justify-center gap-3"
          >
            선택된 {selectedPersonaIds.size}명과 공청회 시작 <Play size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
