"use client";

import { useState, useRef } from "react";
import { PageBody, PageHeader } from "@/components/ui/Page";
import { SCREENS } from "@/lib/omnisite/screens";
import { Info, Users, MessageSquare, Play, Sparkles } from "lucide-react";
import { SetupStep } from "./_components/SetupStep";
import { PersonaStep } from "./_components/PersonaStep";
import { DiscussionStep } from "./_components/DiscussionStep";

const SCREEN = SCREENS.find((s) => s.no === "5")!;

const MOCK_DEMO_PERSONAS = [
  {
    role: "주민대표",
    name: "주택가 주민대표 페르소나",
    description: "후보지 인근 주택가 주민 대표 관점. 주거 쾌적성과 어린이 안전을 최우선으로 고려하며, 주택 입구 20m 이격 및 상공 배출구 조성 조건부 찬성",
    importance_grade: "A",
    keywords: ["주거환경", "간접흡연예방", "어린이안전"]
  },
  {
    role: "상인회",
    name: "골목상권 상인 대표 페르소나",
    description: "골목상권 상인 대표 관점. 유동인구 증가와 길거리 꽁초 투기 방지 효과를 기대하나 상가 주출입구 시야 차단 저지",
    importance_grade: "A",
    keywords: ["상권활성화", "유동인구", "시야확보"]
  },
  {
    role: "담당공무원",
    name: "도시청결과 담당주무관 페르소나",
    description: "지자체 도시청결과 행정 담당자 관점. 예산 적정성 및 서울시 조례 기준(어린이집 10m 이격) 필수 준수 검토",
    importance_grade: "B",
    keywords: ["조례준수", "행정예산", "이격거리"]
  },
  {
    role: "환경단체",
    name: "환경연대 시민대표 페르소나",
    description: "지역 환경시민단체 관점. 삼중 헤파필터 및 밀폐형 음압 환기 장치 탑재 조건 제시",
    importance_grade: "B",
    keywords: ["음압환기", "유해연기차단", "대기정화"]
  },
  {
    role: "청소년보호",
    name: "학부모협의회 대표 페르소나",
    description: "청소년 보호 및 학부모 대표 관점. 통학로 시각적 차폐막 설치 및 24시간 CCTV 모니터링 연동 요구",
    importance_grade: "B",
    keywords: ["통학로안전", "차폐막설치", "CCTV"]
  },
  {
    role: "전문가",
    name: "갈등조정 위원 페르소나",
    description: "스마트도시 갈등조정위원회 전문가 관점. 수용도 정량 평가 지표 및 3대 시나리오 리포트 제시",
    importance_grade: "C",
    keywords: ["갈등조정", "수용도지표", "시나리오"]
  }
];

// 🎯 실명 제거 및 3라운드 AI 페르소나 모의 토론 전개
const MOCK_3_ROUND_DEBATE = [
  // ── Round 1: 모두발언 (Opening Statements) ──
  {
    speaker: "사회자 (Supervisor)",
    text: "[제1라운드 - AI 페르소나별 모두발언 개시]\n안건: 스마트 흡연부스 설치 (용산구 이태원동)\n참여 AI 페르소나 6종의 개별 목표 및 기본 입장을 발표해 주십시오.",
    round: 1,
    evals: { persona_0_acceptance: 0.40, persona_1_acceptance: 0.50, persona_2_acceptance: 0.60, persona_3_acceptance: 0.55, persona_4_acceptance: 0.45, persona_5_acceptance: 0.65 }
  },
  {
    speaker: "주택가 주민대표 페르소나",
    text: "[목표] 주택가 간접흡연 피해 전면 방지\n[가장 기대하는 이익] 골목길 담배꽁초 무단투기 90% 감소 및 악취 해소\n[가장 우려하는 비용/위험] 주택 창문으로의 연기 유입 및 야간 노상 소음\n[수용 가능한 조건] 주택 출입구에서 20m 이상 이격 및 차폐 정원 조성\n[절대 수용 불가능한 조건] 어린이집 반경 10m 이내 구역 설치",
    round: 1,
    evals: { persona_0_acceptance: 0.45, persona_1_acceptance: 0.52, persona_2_acceptance: 0.60, persona_3_acceptance: 0.55, persona_4_acceptance: 0.45, persona_5_acceptance: 0.65 }
  },
  {
    speaker: "골목상권 상인 대표 페르소나",
    text: "[목표] 상권 유동인구 유입 촉진 및 보도 환경 정비\n[가장 기대하는 이익] 상가 앞 무단 꽁초 투기 해소로 쾌적한 상권 환경 조성\n[가장 우려하는 비용/위험] 대형 구조물로 인한 상가 주출입구 및 간판 시야 차단\n[수용 가능한 조건] 슬림형 모던 디자인의 스마트 환기 부스 배치\n[절대 수용 불가능한 조건] 상가 주출입구 정면 전면 배치",
    round: 1,
    evals: { persona_0_acceptance: 0.48, persona_1_acceptance: 0.58, persona_2_acceptance: 0.62, persona_3_acceptance: 0.58, persona_4_acceptance: 0.48, persona_5_acceptance: 0.68 }
  },
  {
    speaker: "도시청결과 담당주무관 페르소나",
    text: "[팩트체커 (System)]: 서울특별시 금연환경 조성 조례 제5조 규정에 따라 어린이집 및 유치원 경계 10m 이내 구역은 필수 법적 금지 구역입니다.",
    round: 1,
    evals: { persona_0_acceptance: 0.52, persona_1_acceptance: 0.60, persona_2_acceptance: 0.70, persona_3_acceptance: 0.60, persona_4_acceptance: 0.52, persona_5_acceptance: 0.70 }
  },
  {
    speaker: "환경연대 시민대표 페르소나",
    text: "[목표] 유해 연기 99.9% 집진 및 필터링 보장\n[가장 기대하는 이익] 밀폐형 음압 환기팬 작동으로 외부 연기 유출 원천 차단\n[수용 가능한 조건] 삼중 헤파필터 탑재 및 6개월 주기 공공 점검 모니터링",
    round: 1,
    evals: { persona_0_acceptance: 0.55, persona_1_acceptance: 0.62, persona_2_acceptance: 0.72, persona_3_acceptance: 0.68, persona_4_acceptance: 0.55, persona_5_acceptance: 0.72 }
  },
  {
    speaker: "학부모협의회 대표 페르소나",
    text: "[목표] 학생 통학로 안전 및 시각적 차폐막 설치\n[수용 가능한 조건] 불투명 디자인 차폐 시트 부착 및 24시간 CCTV 연동\n[절대 수용 불가능한 조건] 초등학교 정문 통학로 직접 노출",
    round: 1,
    evals: { persona_0_acceptance: 0.58, persona_1_acceptance: 0.65, persona_2_acceptance: 0.75, persona_3_acceptance: 0.70, persona_4_acceptance: 0.60, persona_5_acceptance: 0.75 }
  },

  // ── Round 2: 상호 반박 및 대안 협상 (Counter-Arguments & Negotiations) ──
  {
    speaker: "사회자 (Supervisor)",
    text: "[제2라운드 - 상호 반박 및 상생 대안 협상]\n1라운드 제시 조건을 바탕으로 주택가 주민대표와 골목상권 상인 대표의 이격 거리 및 차폐막 절충안을 집중 논의합니다.",
    round: 2,
    evals: { persona_0_acceptance: 0.62, persona_1_acceptance: 0.70, persona_2_acceptance: 0.78, persona_3_acceptance: 0.74, persona_4_acceptance: 0.65, persona_5_acceptance: 0.78 }
  },
  {
    speaker: "주택가 주민대표 페르소나",
    text: "상인 대표 의견에 일부 동의하지만, 상가 간판 시야 확보를 위해 부스를 측면 보도로 옮기더라도 주택가 방향으로 환기구가 향하면 연기 피해가 발생합니다. 부스 배출구를 도로 차도 방향 상공 3.5m로 높여 설치한다면 수용을 긍정 검토하겠습니다.",
    round: 2,
    evals: { persona_0_acceptance: 0.72, persona_1_acceptance: 0.75, persona_2_acceptance: 0.80, persona_3_acceptance: 0.78, persona_4_acceptance: 0.70, persona_5_acceptance: 0.80 }
  },
  {
    speaker: "골목상권 상인 대표 페르소나",
    text: "훌륭한 대안입니다! 부스 배출구를 상공 3.5m 높이의 차도 방향 듀얼 팬으로 설치하고, 상가 주출입구에서 15m 측면 이격 부지로 이동 설치한다면 상인회에서도 적극 협조하겠습니다.",
    round: 2,
    evals: { persona_0_acceptance: 0.78, persona_1_acceptance: 0.82, persona_2_acceptance: 0.85, persona_3_acceptance: 0.82, persona_4_acceptance: 0.75, persona_5_acceptance: 0.85 }
  },
  {
    speaker: "도시청결과 담당주무관 페르소나",
    text: "[팩트체커 (System)]: 해당 15m 측면 이격 부지는 용산구 소유 도로 부지로, 공용 시설물 설치 조례 기준 상 행정 허가 수립이 용이한 구역임을 실측 확인했습니다.",
    round: 2,
    evals: { persona_0_acceptance: 0.82, persona_1_acceptance: 0.85, persona_2_acceptance: 0.88, persona_3_acceptance: 0.85, persona_4_acceptance: 0.78, persona_5_acceptance: 0.88 }
  },
  {
    speaker: "갈등조정 위원 페르소나",
    text: "주민대표의 차도 상공 배출구 요구와 상인대표의 측면 이격 배치가 결합되어 주거 쾌적성과 상권 유동인구가 동시에 확보됩니다. 갈등위험지수가 75점에서 22점으로 대폭 절감되었습니다.",
    round: 2,
    evals: { persona_0_acceptance: 0.85, persona_1_acceptance: 0.88, persona_2_acceptance: 0.90, persona_3_acceptance: 0.88, persona_4_acceptance: 0.82, persona_5_acceptance: 0.90 }
  },

  // ── Round 3: 최종 타결 및 시나리오 심의 (Final Consensus & Scenario Report) ──
  {
    speaker: "사회자 (Supervisor)",
    text: "[제3라운드 - 최종 타결 및 수용도 평가 종결]\n주민-상인-행정 3자 상생 절충안이 성립되었습니다. 최종 수용도 평가 및 시나리오 보고서를 작성합니다.",
    round: 3,
    evals: { persona_0_acceptance: 0.88, persona_1_acceptance: 0.90, persona_2_acceptance: 0.92, persona_3_acceptance: 0.90, persona_4_acceptance: 0.85, persona_5_acceptance: 0.92 }
  },
  {
    speaker: "학부모협의회 대표 페르소나",
    text: "측면 이격 부지에 불투명 차폐 시트 부착과 24시간 스마트 CCTV 모니터링까지 반영되는 조건이라면 학부모 협의회에서도 최종 찬성으로 입장을 변경합니다.",
    round: 3,
    evals: { persona_0_acceptance: 0.90, persona_1_acceptance: 0.92, persona_2_acceptance: 0.95, persona_3_acceptance: 0.92, persona_4_acceptance: 0.88, persona_5_acceptance: 0.95 }
  },
  {
    speaker: "사회자 (Supervisor)",
    text: "[모의 공청회 최종 종결]\n참여 AI 페르소나 6종의 평균 수용도: 92.0% (조건부 타결 성립)\n최종 시나리오 A (주민-상인 조건부 상생 타결) 보고서 작성이 완료되었습니다.",
    round: 3,
    evals: { persona_0_acceptance: 0.90, persona_1_acceptance: 0.92, persona_2_acceptance: 0.95, persona_3_acceptance: 0.92, persona_4_acceptance: 0.88, persona_5_acceptance: 0.95 }
  }
];

export default function DynamicHearingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  const [topic, setTopic] = useState("스마트 흡연부스 설치 (용산구 이태원동)");
  const [purpose, setPurpose] = useState("간접흡연 피해 예방 및 길거리 담배꽁초 무단투기 차단");
  
  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [isDiscussing, setIsDiscussing] = useState(false);
  const [discussionStatus, setDiscussionStatus] = useState<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 🎯 발표 시연용 1-Click 데모 프리셋 로드
  const loadDemoPresentation = () => {
    setTopic("스마트 흡연부스 설치 (용산구 이태원동)");
    setPurpose("간접흡연 피해 예방 및 길거리 담배꽁초 무단투기 차단");
    setPersonas(MOCK_DEMO_PERSONAS);
    setSelectedPersonaIds(new Set([0, 1, 2, 3, 4, 5]));
    setStep(2);
  };

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

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchMorePersonas = async (cacheKey?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/stakeholders/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          purpose,
          gis_data: { lat: 37.5665, lng: 126.9780, region: "테스트 지역" },
          ordinance_data: { "relevant_laws": ["서울특별시 간접흡연 피해방지조례 제5조"] }
        })
      });
      if (!res.ok) throw new Error("서버 에러");
      const data = await res.json();
      const mappedPersonas = data.map((p: any) => ({
        role: p.stakeholder_type || p.role || "이해관계자",
        name: p.display_name || p.name || "AI 페르소나",
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
      console.warn("백엔드 오프라인 - 데모 페르소나 데이터 사용");
      setPersonas(MOCK_DEMO_PERSONAS);
      setSelectedPersonaIds(new Set([0, 1, 2, 3, 4, 5]));
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
    setDiscussionStatus({
      round_count: 1,
      evaluations: {
        "persona_0_acceptance": 0.40,
        "persona_1_acceptance": 0.50,
        "persona_2_acceptance": 0.60,
        "persona_3_acceptance": 0.55,
        "persona_4_acceptance": 0.45,
        "persona_5_acceptance": 0.65
      }
    });

    try {
      const activePersonas = personas.filter((_, idx) => selectedPersonaIds.has(idx));
      const response = await fetch(`${API_BASE}/api/v1/stakeholders/dynamic/discuss/stream`, {
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
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                for (const [nodeName, stateUpdateRaw] of Object.entries(parsed)) {
                  const stateUpdate: any = stateUpdateRaw;
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

                    setMessages(prev => [...prev, { speaker: displaySpeaker, text: displayText }]);
                  }
                  
                  if (nodeName === "evaluator" && stateUpdate.round_count) {
                    setDiscussionStatus(stateUpdate);
                  }
                  if (nodeName === "reporter" && stateUpdate.final_scenarios) {
                    setDiscussionStatus((prev: any) => ({...prev, reporter: stateUpdate.final_scenarios}));
                  }
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (e: any) {
      // 🎯 발표 시연용 3라운드 실시간 다자간 모의 토론 순차 렌더링
      console.warn("데모 시연 모드 3라운드 모의 토론 렌더링 시작");
      for (let i = 0; i < MOCK_3_ROUND_DEBATE.length; i++) {
        const item = MOCK_3_ROUND_DEBATE[i];
        await new Promise(res => setTimeout(res, 900));
        setMessages(prev => [...prev, { speaker: item.speaker, text: item.text }]);
        setDiscussionStatus({
          round_count: item.round,
          evaluations: item.evals,
          ...(item.round === 3 && i === MOCK_3_ROUND_DEBATE.length - 1 ? {
            reporter: {
              scenario_title: "Scenario A: 주민-상인 조건부 상생 타결 시나리오",
              summary: "상가 15m 측면 이격 및 차도 상공 3.5m 듀얼 음압 배출구 설치 조건으로 페르소나 92.0% 찬성 타결",
              next_action: "용산구청 2026년도 스마트도시 예산 수립 및 3.5m 상공 환기 조건부 설계 착수"
            }
          } : {})
        });
      }
    }
    setIsDiscussing(false);
  };

  return (
    <PageBody>
      <PageHeader screen={SCREEN} lead="AI가 주변 환경과 조례를 분석해 다자간 페르소나를 도출하고, 사용자 승인(HITL)을 거쳐 공청회를 시뮬레이션합니다." />
      
      {/* 🎯 시연 발표 전용 1-Click 데모 바 */}
      <div className="mb-6 flex justify-between items-center bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-4 rounded-2xl text-white shadow-lg">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30">
            <Sparkles size={18} className="animate-pulse" />
          </span>
          <div>
            <h3 className="font-bold text-sm text-white">팀원 발표 시연용 (3라운드 AI 페르소나 모의 토론 데모)</h3>
            <p className="text-xs text-slate-300">1라운드(모두발언) ➔ 2라운드(상호반박/대안협상) ➔ 3라운드(최종타결) 순차 전개</p>
          </div>
        </div>
        <button
          onClick={loadDemoPresentation}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 transform active:scale-95"
        >
          <Play size={14} fill="white" /> 3라운드 시연용 데이터 불러오기
        </button>
      </div>

      <div className="flex justify-center mb-8">
        {[
          { num: 1, title: "안건 셋업", icon: <Info size={16} /> },
          { num: 2, title: "페르소나 확정 (HITL)", icon: <Users size={16} /> },
          { num: 3, title: "모의 공청회 진행", icon: <MessageSquare size={16} /> }
        ].map((s) => (
          <div key={s.num} className="flex items-center">
            <button
              onClick={() => {
                if (s.num === 1) setStep(1);
                if (s.num === 2 && personas.length > 0) setStep(2);
                if (s.num === 3 && messages.length > 0) setStep(3);
              }}
              className={`flex items-center px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 border ${
                step >= s.num ? "bg-slate-900 text-white border-slate-900 shadow-sm" : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {s.icon}
              <span className="ml-2 hidden sm:inline">{s.num}. {s.title}</span>
            </button>
            {s.num < 3 && (
              <div className={`w-6 md:w-10 h-[2px] mx-2 transition-all duration-300 ${
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
          activePersonas={personas.filter((_, idx) => selectedPersonaIds.has(idx))}
          topic={topic}
        />
      </div>
    </PageBody>
  );
}
