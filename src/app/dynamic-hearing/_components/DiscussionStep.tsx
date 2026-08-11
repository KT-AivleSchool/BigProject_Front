import { MessageSquare, Loader2, Info } from "lucide-react";
import { RefObject, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DiscussionStepProps {
  step: number;
  messages: any[];
  isDiscussing: boolean;
  discussionStatus: any;
  chatContainerRef: RefObject<HTMLDivElement | null>;
  setStep: (step: 1 | 2 | 3) => void;
  activePersonas?: any[];
  topic?: string;
}

export function DiscussionStep({
  step,
  messages,
  isDiscussing,
  discussionStatus,
  chatContainerRef,
  setStep,
  activePersonas = [],
  topic = "주제 미설정"
}: DiscussionStepProps) {
  const router = useRouter();
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);

  const getBadgeStyle = (badgeText: string) => {
    const text = badgeText.trim();
    if (text.includes("목표")) {
      return "bg-blue-600 text-white border-blue-700";
    }
    if (text.includes("기대하는 이익") || text.includes("이익")) {
      return "bg-white text-slate-900 border-slate-300 shadow-sm";
    }
    if (text.includes("우려하는") || text.includes("비용") || text.includes("위험")) {
      return "bg-orange-500 text-white border-orange-600";
    }
    if (text.includes("수용 가능한") || text.includes("수용가능")) {
      return "bg-emerald-600 text-white border-emerald-700";
    }
    if (text.includes("절대 수용") || text.includes("수용 불가능") || text.includes("불가")) {
      return "bg-rose-600 text-white border-rose-700";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const renderMessageWithBadges = (text: string) => {
    // [목표] 등 대괄호 안의 텍스트를 찾아 뱃지로 변환
    const parts = text.split(/(\[[^\]]+\])/g);
    return (
      <>
        {parts.map((part, idx) => {
          if (part.startsWith('[') && part.endsWith(']')) {
            const badgeText = part.substring(1, part.length - 1);
            const badgeStyle = getBadgeStyle(badgeText);
            return (
              <span key={idx} className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold mr-1.5 mb-1 shadow-sm border align-middle ${badgeStyle}`}>
                {badgeText}
              </span>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </>
    );
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [messages, chatContainerRef]);

  return (
    <div className={`transition-all duration-700 ease-in-out transform ${step === 3 ? 'translate-x-0 opacity-100 relative' : 'translate-x-full opacity-0 absolute top-0 w-full pointer-events-none'}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* 왼쪽 채팅 영역 */}
        <div className="lg:col-span-2 glass-panel p-6 md:p-8 rounded-2xl flex flex-col h-full min-h-0 overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-5 border-b border-hairline flex-shrink-0 gap-4">
            <div>
              <h2 className="font-semibold text-[20px] text-ink flex items-center tracking-tight mb-2">
                <span className="bg-primary/10 text-primary p-2.5 rounded-lg mr-3"><MessageSquare size={20} /></span>
                실시간 다자간 공청회 스트리밍
              </h2>
              {topic && (
                <div className="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[12px] font-bold shadow-sm">
                  🎯 {topic}
                </div>
              )}
            </div>
            {/**
              * 🔴 예전엔 `LIVE` 가 **조건 없이** 박혀 있었다. 토론이 끝나도,
              *    끊겨도, 실패해도 초록불이 깜빡였다 — 화면이 모르는 것을
              *    안다고 말하는 셈이다(원칙 4). 상태는 이미 `isDiscussing` 으로
              *    넘어와 있었고 쓰지 않았을 뿐이다.
              *    끝난 뒤를 「완료」로 단정하지도 않는다 — 중간에 끊겨도
              *    `isDiscussing` 은 false 다. 그래서 「스트리밍 종료」다.
              */}
            <div className="flex flex-col items-end gap-3">
              {isDiscussing ? (
                <div className="flex items-center gap-2.5 text-[12px] font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-md border border-emerald-100 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  LIVE
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-[12px] font-semibold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                  스트리밍 종료
                </div>
              )}
            </div>
          </div>
          
          {/* 이해관계자 필터 태그 (스티커) */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none flex-shrink-0">
            <button 
              onClick={() => setSelectedSpeaker(null)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors border shadow-sm ${selectedSpeaker === null ? 'bg-primary text-white border-primary' : 'bg-white text-ink-secondary border-hairline hover:bg-slate-50'}`}
            >
              전체 보기
            </button>
            {activePersonas?.map((p, idx) => (
              <button 
                key={idx} 
                onClick={() => setSelectedSpeaker(p.name)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors border shadow-sm ${selectedSpeaker === p.name ? 'bg-primary text-white border-primary' : 'bg-white text-ink-secondary border-hairline hover:bg-slate-50'}`}
              >
                {p.name}
              </button>
            ))}
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
            {messages.filter(msg => {
              if (!selectedSpeaker) return true;
              return msg.speaker.includes(selectedSpeaker) || msg.speaker === selectedSpeaker;
            }).map((msg, idx, filteredArray) => {
              /**
               * 🔴 **이름으로 추측하지 않는다**(2026-08-11). 예전엔
               * `speaker.toLowerCase().includes('system'|'fact_checker'|'supervisor')`
               * 였는데, 사람 이름에 우연히 걸리면 주민 발언이 시스템 말풍선이 된다.
               * 백엔드가 `speaker.kind` 를 주므로 그걸 그대로 쓴다
               * (`persona`·`moderator`·`factchecker`·`unknown`, 프런트 안내는 `frontend`).
               * `kind` 가 없는 옛 기록은 `persona` 처럼 그린다 — 모르면 사람 쪽이다.
               */
              const isSystem = ['moderator', 'factchecker', 'frontend'].includes(msg.kind ?? '');
              
              const getAvatarColor = (name: string) => {
                const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-cyan-500", "bg-pink-500"];
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                return colors[Math.abs(hash) % colors.length];
              };

              if (isSystem) {
                return (
                  <div key={idx} className="flex w-full justify-center my-4">
                    <div className="bg-ink text-white w-full max-w-[80%] rounded-xl px-4 py-3 text-[13px] shadow-sm text-left whitespace-pre-wrap break-words leading-relaxed border border-hairline">
                      <div className="font-semibold text-primary-active mb-1.5 flex items-center">
                        <span className="text-[16px] mr-1.5">🤖</span> {msg.speaker}
                      </div>
                      <div className="opacity-95">{msg.text}</div>
                    </div>
                  </div>
                );
              }

              const avatarColor = getAvatarColor(msg.speaker);
              const isConsecutive = idx > 0 && filteredArray[idx-1].speaker === msg.speaker && !isSystem;

              return (
                <div key={idx} className={`flex w-full justify-start ${isConsecutive ? 'mt-1' : 'mt-6'}`}>
                  <div className="flex items-start max-w-[85%] md:max-w-[75%]">
                    {!isConsecutive ? (
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-[12px] shadow-sm ${avatarColor} mr-3 mt-1`}>
                        {msg.speaker.substring(0, 1)}
                      </div>
                    ) : (
                      <div className="w-8 mr-3 flex-shrink-0"></div>
                    )}
                    
                    <div className="flex flex-col flex-1 min-w-0">
                      {!isConsecutive && (
                        <span className="text-[12px] font-semibold text-ink-secondary mb-1 ml-1">{msg.speaker}</span>
                      )}
                      <div className="glass-panel rounded-xl rounded-tl-none px-4 py-3 text-ink leading-relaxed min-w-[200px] whitespace-pre-wrap break-words text-[13px]">
                        {renderMessageWithBadges(msg.text)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isDiscussing && messages.length > 0 && (
              <div className="flex w-full justify-start mt-6">
                <div className="flex items-start max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse mr-3 mt-1"></div>
                  <div className="flex flex-col">
                    <div className="h-3 bg-slate-200 rounded w-16 mb-2 ml-1 animate-pulse"></div>
                    <div className="glass-panel rounded-xl rounded-tl-none px-4 py-3 min-w-[200px]">
                       <div className="flex space-x-1.5 mt-2 mb-1">
                         <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                         <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                         <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
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
            <div className="mt-6 pt-5 border-t border-hairline flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={() => setStep(1)} 
                className="btn-secondary text-[13px]"
              >
                새 안건으로 다시 시작하기
              </button>
              <button 
                onClick={() => router.push('/report')}
                className="btn-primary text-[13px]"
              >
                최종 보고서 작성하기
              </button>
            </div>
          )}
        </div>

        {/* 오른쪽 현황 대시보드 */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col h-full h-[calc(100vh-200px)] min-h-[600px] overflow-hidden">
          <h3 className="font-semibold text-[18px] text-ink mb-5 flex items-center border-b border-hairline pb-4">
            <span className="bg-primary/10 text-primary p-2 rounded-lg mr-2"><Info size={18} /></span>
            실시간 쟁점 요약
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 scroll-smooth scrollbar-thin scrollbar-thumb-slate-300">
            {!discussionStatus ? (
              <div className="flex flex-col items-center justify-center h-full text-ink-secondary/70">
                <Loader2 size={32} className="animate-spin mb-3 opacity-50" />
                <p className="text-[13px] font-medium">데이터 대기 중...</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="glass-panel-deep p-4 rounded-xl border border-hairline">
                  <h4 className="text-[12px] font-semibold text-primary mb-2">현재 진행 상태</h4>
                  {/*
                    🔴 예전엔 `discussionStatus.report?.topic` 을 읽었다 — **항상 undefined** 라
                       토론이 끝나도 「주제 수집 중...」이 박혀 있었다. `report` 이벤트의
                       `final_scenarios` 안에 `topic` 이 들어 있을 거라고 **가정**한 것인데,
                       실제 B 계약에 그런 키가 없다.

                       애초에 서버가 줄 값이 아니다. `topic` 은 이 화면의 `SetupStep` 에서
                       **사람이 직접 쓴 안건 문자열**이고, 프런트가 요청 본문으로 실어 보낸다
                       (`page.tsx` 의 `{parcel_id, topic, purpose, personas}`). 서버엔 출처가
                       없다 — `facility_type`·`region` 은 후보점 행에서 조회되는 **대상**이지
                       안건이 아니다(같은 후보점으로 다른 안건의 토론을 또 열 수 있다).

                       값은 이미 prop 으로 들어와 있고 `:93` 의 `🎯 {topic}` 은 그걸 잘 쓰고
                       있었다. 같은 파일에서 한 줄은 맞고 한 줄만 없는 키를 보고 있었다.
                  */}
                  <div className="text-[14px] font-semibold text-ink">{topic}</div>
                </div>
              
              <div className="glass-panel p-4 rounded-xl border border-hairline">
                <h3 className="text-[12px] font-semibold text-ink-secondary mb-1">현재 진행 라운드</h3>
                {/* `round_count`(옛 LangGraph 상태) → `round`(evaluation 이벤트). 없으면 `—`. */}
                <div className="text-[24px] font-bold text-primary tnum">{discussionStatus.round ?? '—'} <span className="text-[13px] text-ink-secondary font-medium">Round</span></div>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-hairline space-y-3">
                <h3 className="text-[12px] font-semibold text-ink mb-2 border-b border-hairline pb-2">페르소나별 수용도 분석</h3>
                {/* `evaluations` → `acceptance`(evaluation 이벤트). 값은 0~1 숫자만 들어온다. */}
                {Object.entries(discussionStatus.acceptance || {}).map(([key, val]: any, idx) => {
                  const personaId = key.replace('_acceptance', '');
                  const pIdx = parseInt(personaId.replace('persona_', ''));
                  const displayName = !isNaN(pIdx) && activePersonas[pIdx] ? activePersonas[pIdx].name : personaId;
                  
                  return (
                  <div key={idx} className="flex flex-col">
                    <div className="flex justify-between text-[11px] font-medium text-ink-secondary mb-1">
                      <span>{displayName}</span>
                      <span className="tnum">{Math.round(val * 100)}%</span>
                    </div>
                    <div className="w-full bg-black/5 rounded-full h-1.5 border border-hairline/50">
                      <div className={`h-1.5 rounded-full ${val >= 0.7 ? 'bg-primary' : val >= 0.3 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${Math.max(val * 100, 5)}%` }}></div>
                    </div>
                  </div>
                )})}
              </div>

              {discussionStatus.report && (
                <div className="glass-panel-deep p-5 rounded-xl border border-primary/20 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary rounded-l-xl"></div>
                  <div className="text-primary text-[11px] font-bold mb-1.5 tracking-tight">최종 시나리오 도출</div>
                  <h3 className="text-[16px] font-bold text-ink mb-2">{discussionStatus.report.scenario_title}</h3>
                  <p className="text-[12px] text-ink-secondary leading-relaxed mb-4">{discussionStatus.report.summary}</p>
                  <div className="bg-canvas-soft rounded-lg p-3 text-[12px] border border-hairline">
                    <span className="font-semibold text-ink block mb-1">권장 후속 조치</span>
                    <span className="text-ink-secondary">{discussionStatus.report.next_action}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
