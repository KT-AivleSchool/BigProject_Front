import { Users, Loader2, Check } from "lucide-react";
import type { Persona } from "@/lib/omnisite/personaCache";

interface PersonaStepProps {
  step: number;
  personas: Persona[];
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
      <div className="glass-panel p-8 rounded-2xl">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-semibold text-[20px] mb-2 text-ink flex items-center tracking-tight">
              <span className="bg-primary/10 text-primary p-2.5 rounded-lg mr-3"><Users size={20} /></span>
              이해관계자 페르소나 확정 (HITL)
            </h2>
            <p className="text-[13px] text-ink-secondary ml-[52px]">자동 발굴된 페르소나 중 공청회 시뮬레이션에 참여할 대상을 직접 선택해주세요.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetchMorePersonas()} 
              disabled={isLoading}
              className="btn-utility text-[13px] gap-1.5"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : "✨"} AI 인물 추가
            </button>
            <div className="text-[13px] font-medium bg-black/[0.04] text-ink-secondary px-3 py-1.5 rounded-md tnum border border-hairline">
              선택됨 {selectedPersonaIds.size} / 전체 {personas.length}
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
                className={`cursor-pointer border p-5 rounded-xl transition-all duration-300 relative group overflow-hidden ${
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'border-hairline bg-white hover:border-primary/40 hover:shadow-sm'
                }`}
              >
                <div className={`absolute top-4 right-4 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-primary border-primary text-white' : 'border-hairline text-transparent bg-slate-50 group-hover:border-primary/40'
                }`}>
                  <Check size={14} strokeWidth={3} />
                </div>
                
                <div className="pr-8">
                  <div className="inline-block px-2.5 py-1 rounded bg-black/[0.04] text-[11px] font-semibold mb-3 text-ink-secondary border border-hairline">
                    중요도: {p.importance_grade || 'C'}
                  </div>
                  <h3 className="font-semibold text-[16px] text-ink mb-1.5">[{p.role}] {p.name}</h3>
                  <div className="text-[12px] font-medium text-ink-secondary mb-3 line-clamp-3 leading-relaxed">{p.description}</div>

                  {/*
                    추천 사유. 🔴 `description`(주제와의 이해관계)과 **다른 값**이라 자리도 나눈다 —
                    합쳐 놓으면 토론 프롬프트로 되돌아가는 값(`description`)에 사유가 섞여 들어간다.
                    이 값은 고를 때 보라고 화면에만 남는다(`personaCache.ts` 의 `reason`).
                  */}
                  {p.reason && (
                    <div className="mb-3 text-[11px] leading-relaxed text-ink-secondary/80 border-l-2 border-hairline pl-2 line-clamp-3">
                      <span className="font-semibold">추천 사유 </span>
                      {p.reason}
                    </div>
                  )}

                  <div className="flex gap-1.5 flex-wrap">
                    {p.keywords?.slice(0, 3).map((kw: string, kIdx: number) => (
                      <span key={kIdx} className="bg-black/[0.03] border border-hairline/60 px-2 py-0.5 rounded-md text-[11px] text-ink-secondary font-medium">#{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 pt-5 border-t border-hairline flex justify-end gap-3">
          <button 
            onClick={() => setStep(1)} 
            className="btn-secondary text-[13px]"
          >
            다시 설정하기
          </button>
          <button 
            onClick={startDiscussion} 
            disabled={selectedPersonaIds.size < 2}
            className="btn-primary text-[13px]"
          >
            선택된 {selectedPersonaIds.size}명으로 공청회 시작
          </button>
        </div>
      </div>
    </div>
  );
}
