import { MessageSquare, Loader2, Info } from "lucide-react";
import { RefObject } from "react";

interface DiscussionStepProps {
  step: number;
  messages: any[];
  isDiscussing: boolean;
  discussionStatus: any;
  chatContainerRef: RefObject<HTMLDivElement | null>;
  setStep: (step: 1 | 2 | 3) => void;
}

export function DiscussionStep({
  step,
  messages,
  isDiscussing,
  discussionStatus,
  chatContainerRef,
  setStep
}: DiscussionStepProps) {
  return (
    <div className={`transition-all duration-700 ease-in-out transform ${step === 3 ? 'translate-x-0 opacity-100 relative' : 'translate-x-full opacity-0 absolute top-0 w-full pointer-events-none'}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* 왼쪽 채팅 영역 */}
        <div className="lg:col-span-2 p-6 md:p-8 border border-white/40 rounded-3xl bg-white/60 backdrop-blur-2xl shadow-xl shadow-slate-200/50 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 pb-5 border-b-2 border-slate-100">
            <h2 className="font-bold text-2xl text-slate-800 flex items-center">
              <span className="bg-violet-100 text-violet-600 p-2.5 rounded-xl mr-3 shadow-sm"><MessageSquare size={22} /></span>
              실시간 다자간 공청회 스트리밍
            </h2>
            <div className="flex items-center gap-2.5 text-sm font-bold bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full border border-emerald-100 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              LIVE
            </div>
          </div>
          
          <div 
            ref={chatContainerRef as React.RefObject<HTMLDivElement>}
            className="flex-1 overflow-y-auto pr-4 space-y-6 scroll-smooth scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent pb-4"
          >
          {messages.length === 0 && isDiscussing && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-5">
              <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
              <p className="font-medium text-lg">AI 페르소나들이 입장을 정리하여 토론을 준비하고 있습니다...</p>
            </div>
          )}
          
          <div className="space-y-6">
            {messages.map((msg, idx) => {
              const isSystem = msg.speaker.toLowerCase().includes('system') || msg.speaker.toLowerCase().includes('fact_checker') || msg.speaker.toLowerCase().includes('supervisor');
              
              const getAvatarColor = (name: string) => {
                const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-cyan-500", "bg-pink-500"];
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                return colors[Math.abs(hash) % colors.length];
              };

              if (isSystem) {
                return (
                  <div key={idx} className="flex w-full justify-center my-4">
                    <div className="bg-slate-800 text-slate-100 border border-slate-700 w-full max-w-[80%] rounded-2xl px-5 py-4 text-sm shadow-md text-left whitespace-pre-wrap break-words leading-relaxed">
                      <div className="font-bold text-violet-300 mb-1.5 flex items-center">
                        <span className="text-lg mr-1.5">🤖</span> {msg.speaker}
                      </div>
                      <div className="opacity-95">{msg.text}</div>
                    </div>
                  </div>
                );
              }

              const avatarColor = getAvatarColor(msg.speaker);
              const isConsecutive = idx > 0 && messages[idx-1].speaker === msg.speaker && !isSystem;

              return (
                <div key={idx} className={`flex w-full justify-start ${isConsecutive ? 'mt-1' : 'mt-6'}`}>
                  <div className="flex items-start max-w-[85%] md:max-w-[75%]">
                    {!isConsecutive ? (
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm ${avatarColor} mr-3 mt-1`}>
                        {msg.speaker.substring(0, 1)}
                      </div>
                    ) : (
                      <div className="w-10 mr-3 flex-shrink-0"></div>
                    )}
                    
                    <div className="flex flex-col flex-1 min-w-0">
                      {!isConsecutive && (
                        <span className="text-sm font-bold text-slate-700 mb-1 ml-1">{msg.speaker}</span>
                      )}
                      <div className="bg-white/80 border border-slate-200/50 rounded-2xl rounded-tl-none px-5 py-3.5 shadow-sm text-slate-700 leading-relaxed min-w-[200px] whitespace-pre-wrap break-words">
                        {msg.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isDiscussing && messages.length > 0 && (
              <div className="flex w-full justify-start mt-6">
                <div className="flex items-start max-w-[85%]">
                  <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse mr-3 mt-1"></div>
                  <div className="flex flex-col">
                    <div className="h-4 bg-slate-200 rounded w-20 mb-2 ml-1 animate-pulse"></div>
                    <div className="bg-white/50 border border-slate-200/50 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm min-w-[200px]">
                       <div className="flex space-x-1.5 mt-2 mb-1">
                         <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                         <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                         <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
          {/* 하단 패널 */}
          {!isDiscussing && messages.length > 0 && (
            <div className="mt-6 pt-5 border-t-2 border-slate-100 flex justify-end">
              <button 
                onClick={() => setStep(1)} 
                className="bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-700 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                새 안건으로 다시 시작하기
              </button>
            </div>
          )}
        </div>

        {/* 오른쪽 현황 대시보드 */}
        <div className="p-6 md:p-8 border border-white/40 rounded-3xl bg-slate-50/90 backdrop-blur-2xl shadow-xl shadow-slate-200/50 flex flex-col h-full overflow-y-auto">
          <h2 className="font-bold text-xl text-slate-800 mb-6 flex items-center">
            <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-3 shadow-sm"><Info size={18} /></span>
            실시간 토론 현황
          </h2>

          {!discussionStatus ? (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-400 space-y-4">
              <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-sm font-medium">데이터 수집 및 분석 중...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 mb-1">현재 진행 라운드</h3>
                <div className="text-3xl font-extrabold text-indigo-600">{discussionStatus.round_count} <span className="text-lg text-slate-400 font-medium">Round</span></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">페르소나별 수용도 분석</h3>
                {Object.entries(discussionStatus.evaluations || {}).map(([key, val]: any, idx) => (
                  <div key={idx} className="flex flex-col">
                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                      <span>{key.replace('_acceptance', '')}</span>
                      <span>{Math.round(val * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${val >= 0.7 ? 'bg-emerald-500' : val >= 0.3 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${Math.max(val * 100, 5)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>

              {discussionStatus.reporter && (
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl text-white shadow-lg">
                  <div className="text-indigo-200 text-xs font-bold mb-1 uppercase tracking-wider">최종 시나리오 도출</div>
                  <h3 className="text-xl font-extrabold mb-3">{discussionStatus.reporter.scenario_title}</h3>
                  <p className="text-sm text-indigo-100 leading-relaxed mb-4">{discussionStatus.reporter.summary}</p>
                  <div className="bg-white/10 rounded-xl p-3 text-sm">
                    <span className="font-bold text-indigo-200 block mb-1">권장 후속 조치</span>
                    {discussionStatus.reporter.next_action}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
