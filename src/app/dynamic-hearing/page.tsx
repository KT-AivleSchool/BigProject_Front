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

  useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [messages]);

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
      const res = await fetch("http://localhost:8000/api/v1/stakeholders/generate", {
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
      const response = await fetch("http://localhost:8000/api/v1/stakeholders/dynamic/discuss/stream", {
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
                    
                    const match = rawText.match(/^(.+? \(.+?\)):\s*(.*)$/s);
                    if (match) {
                        displaySpeaker = match[1];
                        displayText = match[2];
                    } else if (rawText.startsWith("[팩트체커 (System)]:")) {
                        displaySpeaker = "팩트체커 (System)";
                        displayText = rawText.replace("[팩트체커 (System)]:", "").trim();
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
    } catch (e) {
      console.error(e);
      setMessages([
        { speaker: "SYSTEM", text: "해당 엔드포인트가 백엔드에 아직 구현되지 않았거나, 연결이 지연되었습니다.\n가상의 스트리밍 세션으로 대체합니다." },
        { speaker: "상인대표", text: "스마트 흡연부스가 생기면 상점 주변에 담배꽁초가 크게 줄어들 것으로 기대합니다. 반드시 도입되어야 합니다." },
        { speaker: "주민대표", text: "상인들 입장에서는 좋겠지만, 부스 근처를 지나가야 하는 아이들과 주민들은 간접흡연 피해를 고스란히 받게 됩니다. 환기구 방향은 어떻게 하실 건가요?" },
        { speaker: "보건소 담당자", text: "환기구에는 3중 정화 필터를 달 예정이며, 보행로와 반대 방향으로 배기구를 설계하여 주민 피해를 최소화할 계획입니다." }
      ]);
    }
    setIsDiscussing(false);
  };

  return (
    <PageBody>
      <PageHeader screen={SCREEN} lead="AI가 주변 환경과 조례를 분석해 다자간 페르소나를 도출하고, 사용자 승인(HITL)을 거쳐 공청회를 시뮬레이션합니다." />
      
      <div className="flex items-center justify-center mb-10 mt-4 space-x-2 md:space-x-4">
        {[
          { num: 1, title: "안건 설정", icon: <Info size={18} /> },
          { num: 2, title: "페르소나 확정", icon: <Users size={18} /> },
          { num: 3, title: "공청회 진행", icon: <MessageSquare size={18} /> }
        ].map((s) => (
          <div key={s.num} className="flex items-center">
            <div className={`flex items-center justify-center px-4 py-2 rounded-full text-sm font-semibold transition-all duration-500 ${
              step >= s.num ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "bg-slate-100 text-slate-400"
            }`}>
              {s.icon}
              <span className="ml-2 hidden sm:inline">{s.num}. {s.title}</span>
            </div>
            {s.num < 3 && (
              <div className={`w-8 md:w-12 h-1 mx-2 rounded-full transition-all duration-500 ${
                step > s.num ? "bg-blue-600" : "bg-slate-200"
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
        />
      </div>
    </PageBody>
  );
}
