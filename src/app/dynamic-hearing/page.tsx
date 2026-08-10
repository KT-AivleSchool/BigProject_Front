"use client";

import { useState, useRef, useEffect } from "react";
import { PageBody, PageHeader } from "@/components/ui/Page";
import { SCREENS } from "@/lib/omnisite/screens";
import { Info, Users, MessageSquare } from "lucide-react";
import { SetupStep } from "./_components/SetupStep";
import { PersonaStep } from "./_components/PersonaStep";
import { DiscussionStep } from "./_components/DiscussionStep";

const SCREEN = SCREENS.find((s) => s.no === "5")!;

export default function DynamicHearingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  const [topic, setTopic] = useState("스마트 흡연부스 설치");
  const [purpose, setPurpose] = useState("지역상권 활성화 및 담배꽁초 무단투기 방지");
  
  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [isDiscussing, setIsDiscussing] = useState(false);
  const [discussionStatus, setDiscussionStatus] = useState<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const generatePersonas = async () => {
    const cacheKey = `personas_${topic}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        if (parsedCache.length > 0) {
          setPersonas(parsedCache);
          setSelectedPersonaIds(new Set(parsedCache.map((_: any, i: number) => i)));
          setStep(2);
          return;
        }
      } catch (e) {
        console.error("Cache parsing error", e);
      }
    }
    
    setPersonas([]);
    setStep(2);
    await fetchMorePersonas(cacheKey);
  };

  const fetchMorePersonas = async (cacheKey?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/stakeholders/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          purpose,
          gis_data: { lat: 37.5665, lng: 126.9780, region: "테스트 지역" },
          ordinance_data: { "relevant_laws": ["서울특별시 간접흡연 피해방지조례 제5조"] }
        })
      });
      const data = await res.json();
      const mappedPersonas = data.map((p: any) => ({
        role: p.stakeholder_type || p.role || "이해관계자",
        name: p.display_name || p.name || "이름 없음",
        description: p.relationship_to_topic || p.recommendation_reason || p.description || "",
        importance_grade: p.importance_grade || "C",
        keywords: p.keywords || []
      }));
      
      setPersonas(prev => {
        const updated = [...prev, ...mappedPersonas];
        const key = cacheKey || `personas_${topic}`;
        localStorage.setItem(key, JSON.stringify(updated));
        
        setSelectedPersonaIds(oldSet => {
            const newSet = new Set(oldSet);
            for(let i = prev.length; i < updated.length; i++) {
                newSet.add(i);
            }
            return newSet;
        });
        
        return updated;
      });
    } catch (e) {
      console.error(e);
      alert("페르소나 생성 실패");
    }
    setIsLoading(false);
  };

  const togglePersona = (idx: number) => {
    const newSet = new Set(selectedPersonaIds);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setSelectedPersonaIds(newSet);
  };

  const startDiscussion = async () => {
    setStep(3);
    setIsDiscussing(true);
    setMessages([]);
    setDiscussionStatus(null);
    try {
      const activePersonas = personas.filter((_, idx) => selectedPersonaIds.has(idx));
      const response = await fetch(`/api/v1/stakeholders/dynamic/discuss/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personas: activePersonas,
          topic,
          gis_data: { lat: 37.5665, lng: 126.9780, region: "테스트 지역" },
          ordinance_contexts: ["서울특별시 간접흡연 피해방지조례 제5조"]
        })
      });
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");
      
      const decoder = new TextDecoder("utf-8");
      
      let buffer = "";
      while (true) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (let line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.replace("data: ", "").trim();
              if (data === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(data);
                for (const [nodeName, stateUpdateRaw] of Object.entries(parsed)) {
                  const stateUpdate: any = stateUpdateRaw;
                  // @ts-ignore
                  if (stateUpdate.messages && stateUpdate.messages.length > 0) {
                    const rawText = stateUpdate.messages[0];
                    let displaySpeaker = nodeName;
                    let displayText = rawText;
                    
                    const colonIndex = rawText.indexOf("): ");
                    if (colonIndex > 0) {
                        displaySpeaker = rawText.substring(0, colonIndex + 1).trim();
                        displayText = rawText.substring(colonIndex + 3).trim();
                    } else if (rawText.startsWith("[팩트체커")) {
                        const idx = rawText.indexOf("]: ");
                        displaySpeaker = "팩트체커 (System)";
                        displayText = idx > 0 ? rawText.substring(idx + 3).trim() : rawText.replace("[팩트체커 (System)]:", "").trim();
                    } else if (rawText.includes(":")) {
                        const idx = rawText.indexOf(":");
                        displaySpeaker = rawText.substring(0, idx).trim();
                        displayText = rawText.substring(idx + 1).trim();
                    }

                    // @ts-ignore
                    setMessages(prev => [...prev, { speaker: displaySpeaker, text: displayText }]);
                  }
                  
                  // @ts-ignore
                  if (nodeName === "evaluator" && stateUpdate.round_count) {
                    setDiscussionStatus(stateUpdate);
                  }
                  // @ts-ignore
                  if (nodeName === "reporter" && stateUpdate.final_scenarios) {
                    setDiscussionStatus((prev: any) => ({...prev, reporter: stateUpdate.final_scenarios}));
                  }
                }
              } catch (e) {
                // Ignore incomplete chunks
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      setMessages(prev => [
        ...prev,
        { speaker: "SYSTEM (오류)", text: `백엔드 실시간 토론 연결 실패: ${e?.message || "서버 통신 중 오류가 발생했습니다."}` }
      ]);
    }
    setIsDiscussing(false);
  };

  return (
    <PageBody>
      <PageHeader screen={SCREEN} lead="AI가 주변 환경과 조례를 분석해 다자간 페르소나를 도출하고, 사용자 승인(HITL)을 거쳐 공청회를 시뮬레이션합니다." />
      
      <div className="flex justify-center mb-8">
        {[
          { num: 1, title: "안건 설정", icon: <Info size={16} /> },
          { num: 2, title: "페르소나 확정", icon: <Users size={16} /> },
          { num: 3, title: "공청회 진행", icon: <MessageSquare size={16} /> }
        ].map((s) => (
          <div key={s.num} className="flex items-center">
            <div className={`flex items-center justify-center px-4 py-2 rounded-md text-[13px] font-semibold transition-all duration-300 border ${
              step >= s.num ? "bg-primary text-white border-primary" : "bg-black/[0.02] text-ink-secondary border-hairline"
            }`}>
              {s.icon}
              <span className="ml-2 hidden sm:inline">{s.num}. {s.title}</span>
            </div>
            {s.num < 3 && (
              <div className={`w-6 md:w-10 h-[2px] mx-2 transition-all duration-300 ${
                step > s.num ? "bg-primary" : "bg-hairline"
              }`} />
            )}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden min-h-[600px]">
        <SetupStep 
          step={step} 
          topic={topic} setTopic={setTopic} 
          purpose={purpose} setPurpose={setPurpose} 
          isLoading={isLoading} 
          generatePersonas={generatePersonas} 
        />
        
        <PersonaStep 
          step={step}
          personas={personas}
          selectedPersonaIds={selectedPersonaIds}
          togglePersona={togglePersona}
          fetchMorePersonas={() => fetchMorePersonas()}
          isLoading={isLoading}
          startDiscussion={startDiscussion}
          setStep={setStep}
        />
        
        <DiscussionStep 
          step={step}
          messages={messages}
          isDiscussing={isDiscussing}
          discussionStatus={discussionStatus}
          chatContainerRef={chatContainerRef}
          setStep={setStep}
          activePersonas={personas.filter((_, idx) => selectedPersonaIds.has(idx))}
          topic={topic}
        />
      </div>
    </PageBody>
  );
}
