import React from "react";

export type ChatRole = "찬성측" | "반대측" | "정부";

export interface ChatMessage {
  id: string;
  type: "user" | "system";
  role?: ChatRole;
  name?: string;
  time?: string;
  text: string;
}

interface ChatBubbleProps {
  message: ChatMessage;
  engine?: "A" | "B";
}

// 에셋(이미지) 추가 시 이곳의 아이콘 렌더링 부분을 <img> 태그 등으로 교체해주시면 됩니다.
// 예: <img src="/assets/avatars/pro.png" alt="찬성측" className="h-full w-full object-cover" />
function AvatarPlaceholder({ role }: { role?: string }) {
  let bgColor = "bg-gray-200";
  let textColor = "text-gray-600";
  let initial = "?";

  if (role?.includes("찬성")) {
    bgColor = "bg-blue-100";
    textColor = "text-blue-700";
    initial = "찬";
  } else if (role?.includes("반대")) {
    bgColor = "bg-red-100";
    textColor = "text-red-700";
    initial = "반";
  } else if (role?.includes("정부") || role?.includes("시스템")) {
    bgColor = "bg-emerald-100";
    textColor = "text-emerald-700";
    initial = role?.includes("정부") ? "정" : "시";
  }

  return (
    <div
      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${bgColor} ${textColor} text-[14px] font-bold`}
    >
      {initial}
    </div>
  );
}

export function ChatBubble({ message, engine }: ChatBubbleProps) {
  // 텍스트 내의 **굵게** 마크다운과 줄바꿈, 찬성/반대 키워드를 렌더링하는 함수
  const formatText = (text: string, isSystem: boolean = false) => {
    return text.split('\n').map((line, i, arr) => {
      // **굵은 글씨** 파싱
      const parts = line.split(/(\*\*.*?\*\*)/g);
      
      const formattedLine = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={j} className={`font-bold ${isSystem ? 'text-indigo-900' : 'text-ink-dark bg-black/[0.05] px-1 rounded'}`}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        
        // 시스템 메시지인 경우 찬성/반대 키워드 하이라이팅
        if (isSystem) {
          const subParts = part.split(/(찬성측?|반대측?)/g);
          return subParts.map((sub, k) => {
            if (sub.startsWith("찬성")) {
              return <span key={k} className="text-blue-700 font-bold bg-blue-100/50 px-1 rounded">{sub}</span>;
            }
            if (sub.startsWith("반대")) {
              return <span key={k} className="text-red-700 font-bold bg-red-100/50 px-1 rounded">{sub}</span>;
            }
            return sub;
          });
        }

        return part;
      });

      return (
        <React.Fragment key={i}>
          {formattedLine}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  if (message.type === "system") {
    const isFinalResult =
      engine === "B" &&
      (message.text.includes("최종 종료되었습니다") ||
        message.text.includes("정리본") ||
        message.text.includes("결과"));
    
    if (isFinalResult) {
      // 텍스트를 섹션별로 분리하여 렌더링
      const sections = message.text.split('\n\n').filter(s => s.trim() !== '');
      
      const renderSection = (section: string, idx: number) => {
        if (section.includes('🎉')) {
          return <div key={idx} className="text-center font-bold text-indigo-900 text-[15px] mb-4 bg-white/50 py-2 rounded-lg">{section}</div>;
        }
        if (section.includes('📌 [최종 시나리오 결과')) {
          return (
            <div key={idx} className="mb-4 bg-white/80 rounded-xl p-4 shadow-sm border border-indigo-50">
              <h5 className="font-bold text-indigo-800 mb-2 border-b border-indigo-100 pb-2">📌 최종 결과 및 지표</h5>
              <div className="text-[13.5px] leading-relaxed text-indigo-950">
                {formatText(section.replace(/📌 \[최종 시나리오 결과:.*?\]\n/, ''), true)}
              </div>
            </div>
          );
        }
        if (section.includes('📊 [주요 갈등 인자')) {
          // 갈등 인자 리스트 포맷팅 개선
          const lines = section.split('\n').slice(1);
          return (
            <div key={idx} className="mb-4 bg-white/80 rounded-xl p-4 shadow-sm border border-indigo-50">
              <h5 className="font-bold text-indigo-800 mb-2 border-b border-indigo-100 pb-2">📊 주요 갈등 인자 및 가중치</h5>
              <ul className="flex flex-col gap-2 mt-2">
                {lines.map((line, lIdx) => {
                  // "  • 텍스트: 12.0%" 형태 분리
                  const match = line.match(/•\s*(.*?):\s*([\d.]+%)/);
                  if (match) {
                    return (
                      <li key={lIdx} className="flex items-start gap-2 text-[13px] bg-indigo-50/30 p-2 rounded-lg">
                        <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded text-[12px] whitespace-nowrap">{match[2]}</span>
                        <span className="text-indigo-900 mt-0.5">{match[1]}</span>
                      </li>
                    );
                  }
                  return <li key={lIdx} className="text-[13px]">{formatText(line, true)}</li>;
                })}
              </ul>
            </div>
          );
        }
        if (section.includes('📝 [시나리오 요약]')) {
          return (
            <div key={idx} className="mb-4 bg-white/80 rounded-xl p-4 shadow-sm border border-indigo-50">
              <h5 className="font-bold text-indigo-800 mb-2 border-b border-indigo-100 pb-2">📝 시나리오 요약</h5>
              <div className="text-[13.5px] leading-relaxed text-indigo-950">
                {formatText(section.replace('📝 [시나리오 요약]\n', ''), true)}
              </div>
            </div>
          );
        }
        if (section.includes('💡 [도출 사유]')) {
          return (
            <div key={idx} className="mb-4 bg-white/80 rounded-xl p-4 shadow-sm border border-indigo-50">
              <h5 className="font-bold text-indigo-800 mb-2 border-b border-indigo-100 pb-2">💡 도출 사유</h5>
              <div className="text-[13.5px] leading-relaxed text-indigo-950">
                {formatText(section.replace('💡 [도출 사유]\n', ''), true)}
              </div>
            </div>
          );
        }
        return <div key={idx} className="mb-4">{formatText(section, true)}</div>;
      };

      return (
        <div className="my-6 w-full rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 p-5 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[22px]">📋</span>
            <h4 className="text-[17px] font-extrabold text-indigo-950">모의 공청회 결과 보고서</h4>
          </div>
          <div className="flex flex-col">
            {sections.map((section, idx) => renderSection(section, idx))}
          </div>
        </div>
      );
    }
    
    return (
      <div className="my-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center text-[12px] font-semibold text-slate-700 whitespace-pre-wrap">
        {formatText(message.text, true)}
      </div>
    );
  }

  // 발화자에 따른 말풍선 배경색 결정
  let bubbleBg = "bg-black/[0.04]"; // 기본 색상
  let bubbleBorder = "border border-transparent";
  if (message.role?.includes("찬성")) {
    bubbleBg = "bg-blue-50";
    bubbleBorder = "border border-blue-100";
  } else if (message.role?.includes("반대")) {
    bubbleBg = "bg-red-50";
    bubbleBorder = "border border-red-100";
  } else if (message.role?.includes("정부")) {
    bubbleBg = "bg-emerald-50";
    bubbleBorder = "border border-emerald-100";
  }

  return (
    <div className="mb-5 flex gap-3">
      {/* 아바타 이미지 영역 */}
      <div className="mt-1">
        <AvatarPlaceholder role={message.role} />
      </div>
      
      {/* 텍스트 영역 */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[13px] font-bold text-ink">{message.name || message.role}</span>
          <span className="text-[11px] text-ink-secondary">{message.time}</span>
        </div>
        <div className={`rounded-xl rounded-tl-none px-4 py-3 text-[13.5px] leading-[1.7] text-ink ${bubbleBg} ${bubbleBorder}`}>
          {formatText(message.text, false)}
        </div>
      </div>
    </div>
  );
}
