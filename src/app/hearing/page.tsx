"use client";

import React, { useState, useEffect, useRef } from "react";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { useRun } from "@/lib/omnisite/RunProvider";
import { SCREENS } from "@/lib/omnisite/screens";

import { ChatBubble, ChatMessage, ChatRole } from "@/components/hearing/ChatBubble";
import { ConflictGauge } from "@/components/hearing/ConflictGauge";
import { AcceptanceCircle } from "@/components/hearing/AcceptanceCircle";

// SSE 연결용 (package.json에 포함됨)
import { fetchEventSource } from "@microsoft/fetch-event-source";

const SCREEN = SCREENS.find((s) => s.no === "5")!;

// 임시 지표 모사 데이터 (백엔드에서 지표 데이터를 주지 않을 경우 대체용)
const MOCK_METRICS = [
  { proConflict: 20, conConflict: 20, proAccept: 90, conAccept: 80 },
  { proConflict: 50, conConflict: 40, proAccept: 80, conAccept: 65 },
  { proConflict: 85, conConflict: 60, proAccept: 75, conAccept: 55 },
];

export default function Screen5Page() {
  const { run } = useRun();
  
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [realMetrics, setRealMetrics] = useState({ proConflict: 0, conConflict: 0, proAccept: 0, conAccept: 0 });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 컴포넌트 마운트 시 로컬 스토리지(세션)에서 기존 데이터 복구
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem("sim_messages");
      const savedMetrics = sessionStorage.getItem("sim_metrics");
      const savedStarted = sessionStorage.getItem("sim_started");
      const savedFinished = sessionStorage.getItem("sim_finished");
      
      if (savedMessages) setMessages(JSON.parse(savedMessages));
      if (savedMetrics) setRealMetrics(JSON.parse(savedMetrics));
      if (savedStarted === "true") setIsStarted(true);
      if (savedFinished === "true") setIsFinished(true);
    } catch (e) {
      console.error("세션 스토리지 복구 실패", e);
    }
  }, []);

  // 상태 변경 시 세션 스토리지에 자동 저장
  useEffect(() => {
    if (messages.length > 0) sessionStorage.setItem("sim_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    sessionStorage.setItem("sim_metrics", JSON.stringify(realMetrics));
  }, [realMetrics]);

  useEffect(() => {
    sessionStorage.setItem("sim_started", String(isStarted));
  }, [isStarted]);
  
  useEffect(() => {
    sessionStorage.setItem("sim_finished", String(isFinished));
  }, [isFinished]);

  // 백엔드 스트리밍 API 연결
  useEffect(() => {
    if (!isStarted || isFinished) return;

    let currentSender = "";
    const controller = new AbortController();

    const startStreaming = async () => {
      try {
        await fetchEventSource("http://127.0.0.1:8000/api/v1/simulation/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ parcel_id: 1, facility_type: "흡연부스", audit_data: {} }),
          signal: controller.signal,
          async onopen(response) {
            if (response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
              return; // 성공
            } else if (response.headers.get("content-type")?.includes("application/json")) {
              const errorData = await response.json();
              console.error("백엔드 에러 응답:", errorData);
              throw new Error(errorData.detail || errorData.message || "백엔드에서 JSON 에러를 반환했습니다.");
            } else {
              throw new Error(`예상치 못한 Content-Type: ${response.headers.get("content-type")}`);
            }
          },
          onmessage(event) {
            if (!event.data) return;
            try {
              const msg = JSON.parse(event.data);
              
              if (msg.error_code) {
                console.error("시스템 오류:", msg.message);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    type: "system",
                    role: "system" as any,
                    name: "시스템 에러",
                    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
                    text: `[오류 발생] ${msg.message}`,
                  },
                ]);
                setIsFinished(true);
                return;
              }

              const sender = msg.sender || "";
              const text = msg.text || "";
              const metrics = msg.metrics;
              
              if (text.includes("최종 종료되었습니다") || msg.is_finished) {
                setIsFinished(true);
              }

              if (metrics) {
                // 백엔드에서 받은 실제 평가 지표를 상태에 반영합니다. (고정 점수 대신 범위 내 랜덤 점수 부여)
                const getJitteredScore = (prevScore: number, level: string) => {
                  const ranges: Record<string, [number, number]> = { "LOW": [15, 28], "MEDIUM": [42, 58], "HIGH": [82, 95] };
                  const range = ranges[level] || [45, 55];
                  if (prevScore >= range[0] && prevScore <= range[1]) return prevScore;
                  return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
                };

                setRealMetrics((prev) => ({
                  proConflict: getJitteredScore(prev.proConflict, metrics.css_pro),
                  conConflict: getJitteredScore(prev.conConflict, metrics.css_con),
                  proAccept: Math.round(metrics.pro_acc * 100),
                  conAccept: Math.round(metrics.con_acc * 100),
                }));
              }

              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMsg = newMessages.length > 0 ? newMessages[newMessages.length - 1] : null;
                const prevSender = lastMsg ? (lastMsg.name || "") : "";
                
                // 새로운 화자인 경우 말풍선 추가
                if (sender && sender !== prevSender) {
                  const isSystem = sender.toUpperCase().includes("SYSTEM") || sender === "시스템";
                  
                  newMessages.push({
                    id: Date.now().toString() + Math.random().toString(),
                    type: isSystem ? "system" : "user",
                    role: sender as ChatRole,
                    name: sender,
                    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
                    text: text,
                  });
                } else if (lastMsg) {
                  // 같은 화자면 텍스트를 이어서 붙임 (스트리밍 토큰 처리)
                  const lastIndex = newMessages.length - 1;
                  newMessages[lastIndex] = { ...lastMsg, text: lastMsg.text + text };
                }
                
                return newMessages;
              });

            } catch (e) {
              console.error("스트리밍 데이터 파싱 오류:", e);
            }
          },
          onclose() {
            // 스트림 정상 종료 시 재연결 방지
            throw new Error("Stream closed normally");
          },
          onerror(err) {
            if (err.message === "Stream closed normally") {
              throw err; // 정상 종료 시 에러를 던져 무한 재연결(Retry)을 방지합니다.
            }
            console.error("SSE Connection Error:", err);
            // 에러 시 재연결 방지
            throw err;
          }
        });
      } catch (err) {
        if (err instanceof Error && err.message === "Stream closed normally") {
           // 무시
        } else {
           console.error("스트리밍 요청 실패:", err);
        }
      }
    };

    startStreaming();

    return () => {
      controller.abort();
    };
  }, [isStarted]);

  // 새 메시지가 추가될 때마다 스크롤을 맨 아래로 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const defaultMetrics = { proConflict: 20, conConflict: 20, proAccept: 90, conAccept: 80 };
  const currentMetrics = realMetrics || defaultMetrics;

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="AI 에이전트 간의 모의 공청회를 통해 잠재적 갈등 지수와 수용도를 실시간으로 분석합니다."
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        
        {/* 좌측: 채팅 패널 */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col h-[700px] relative">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[18px] font-bold text-ink">AI 모의 심의 채팅</h2>
            {isStarted && (
              <button
                onClick={() => {
                  sessionStorage.removeItem("sim_messages");
                  sessionStorage.removeItem("sim_metrics");
                  sessionStorage.removeItem("sim_started");
                  sessionStorage.removeItem("sim_finished");
                  setIsStarted(false);
                  setIsFinished(false);
                  setMessages([]);
                  setRealMetrics({ proConflict: 0, conConflict: 0, proAccept: 0, conAccept: 0 });
                }}
                className="px-3 py-1.5 text-[12px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
              >
                초기화 및 재시작
              </button>
            )}
          </div>
          
          {!isStarted ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-[2px] z-10 rounded-2xl">
              <button 
                onClick={() => setIsStarted(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg transition-transform transform hover:scale-105 active:scale-95"
              >
                AI 토론 시작하기
              </button>
              <p className="mt-4 text-[13px] text-ink-secondary">버튼을 누르면 시뮬레이션이 시작됩니다.</p>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center text-ink-secondary text-[13px] mt-10">
                시뮬레이션 대기 중...
              </div>
            )}
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            {/* 자동 스크롤 기준점 */}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* 우측: 지표 패널 영역 */}
        <div className="flex flex-col gap-6 h-[700px]">
          
          {/* 우측 상단: 갈등 지수 */}
          <div className="glass-panel rounded-2xl p-6 flex-1 flex flex-col">
            <h2 className="text-[18px] font-bold text-ink mb-6">갈등 지수 (Conflict Index)</h2>
            <div className="flex flex-1 items-center justify-around">
              <ConflictGauge score={currentMetrics.proConflict} label="찬성측 갈등 지수" />
              <ConflictGauge score={currentMetrics.conConflict} label="반대측 갈등 지수" />
            </div>
          </div>

          {/* 우측 하단: 수용도 */}
          <div className="glass-panel rounded-2xl p-6 flex-1 flex flex-col">
            <h2 className="text-[18px] font-bold text-ink mb-6">수용도 (Acceptance Score)</h2>
            <div className="flex flex-1 items-center justify-around">
              <AcceptanceCircle score={currentMetrics.proAccept} label="찬성측 수용도" color="#3b82f6" />
              <AcceptanceCircle score={currentMetrics.conAccept} label="반대측 수용도" color="#ef4444" />
            </div>
          </div>
          
        </div>
      </div>

      <PageFooter screen={SCREEN} />
      <SourceNote files={["/api/v1/simulation/stream (실시간 스트리밍 연결됨)"]} />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
      `}} />
    </PageBody>
  );
}
