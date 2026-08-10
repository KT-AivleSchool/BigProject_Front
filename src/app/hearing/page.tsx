"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { useRun } from "@/lib/omnisite/RunProvider";
import { SCREENS } from "@/lib/omnisite/screens";
import { ApiError, NetworkError } from "@/lib/omnisite/client";
import {
  Candidate,
  FIRST_PACKET_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  STREAM_URL,
  StreamPacket,
  errorTitle,
  fetchCandidates,
} from "@/lib/omnisite/simulation";

import { ChatBubble, ChatMessage, ChatRole } from "@/components/hearing/ChatBubble";
import { ConflictGauge } from "@/components/hearing/ConflictGauge";
import { AcceptanceCircle } from "@/components/hearing/AcceptanceCircle";

// SSE 연결용 (package.json에 포함됨)
import { fetchEventSource } from "@microsoft/fetch-event-source";

const SCREEN = SCREENS.find((s) => s.no === "5")!;

/**
 * 등급 → 게이지 바늘 위치. **점수가 아니다.**
 * 서버는 `LOW`/`MEDIUM`/`HIGH` 만 준다. 화면에 찍히는 글자는 등급이고, 이 숫자는
 * 반원 위 어디에 바늘을 둘지를 정할 뿐이다. 사이값을 지어내지 않는다.
 */
const LEVEL_ANGLE: Record<string, number> = { LOW: 15, MEDIUM: 50, HIGH: 85 };

interface Metrics {
  /** 서버가 준 등급 원문. 아직 안 왔으면 null — 0 으로 두면 "갈등 없음"으로 읽힌다. */
  cssPro: string | null;
  cssCon: string | null;
  /** 0~1 실수를 퍼센트로. 이건 진짜 숫자다. */
  proAccept: number | null;
  conAccept: number | null;
}

const EMPTY_METRICS: Metrics = {
  cssPro: null,
  cssCon: null,
  proAccept: null,
  conAccept: null,
};

/** 화면에 띄울 실패. `code` 는 서버 `error_code`, `detail` 은 서버 문구 원문. */
interface Failure {
  code: string;
  detail: string;
}

const SS_KEYS = ["sim_messages", "sim_metrics", "sim_started", "sim_finished", "sim_parcel"];

export default function Screen5Page() {
  const { run } = useRun();
  const domain = run?.domain ?? null;

  // ── 후보점 ────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [candFailure, setCandFailure] = useState<Failure | null>(null);
  const [candLoading, setCandLoading] = useState(false);

  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [failure, setFailure] = useState<Failure | null>(null);
  /** 실제로 `/stream` 에 넘긴 후보. 복원된 대화가 어느 점의 것인지 밝히려고 남긴다. */
  const [usedParcelId, setUsedParcelId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /**
   * 🔴 **선정 위치는 `candidates[0]`(rank 1) 이다.** `score` 로 다시 정렬하지 않는다 —
   *    MCLP 커버 그리디라 순위와 점수가 어긋난다(실측 4위 0.7793 > 1위 0.7703).
   */
  // `?? null` 은 `noUncheckedIndexedAccess` 때문이다 — 인덱스 접근은 항상
  // `| undefined` 다. `!` 로 지우지 않는다: 빈 배열이면 진짜로 없는 것이다.
  const selected: Candidate | null = candidates?.[0] ?? null;

  // 세션 복원
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem("sim_messages");
      const savedMetrics = sessionStorage.getItem("sim_metrics");
      const savedStarted = sessionStorage.getItem("sim_started");
      const savedFinished = sessionStorage.getItem("sim_finished");
      const savedParcel = sessionStorage.getItem("sim_parcel");

      if (savedMessages) setMessages(JSON.parse(savedMessages));
      if (savedMetrics) setMetrics(JSON.parse(savedMetrics));
      if (savedStarted === "true") setIsStarted(true);
      if (savedFinished === "true") setIsFinished(true);
      if (savedParcel) setUsedParcelId(Number(savedParcel));
    } catch (e) {
      console.error("세션 스토리지 복구 실패", e);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) sessionStorage.setItem("sim_messages", JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    sessionStorage.setItem("sim_metrics", JSON.stringify(metrics));
  }, [metrics]);
  useEffect(() => {
    sessionStorage.setItem("sim_started", String(isStarted));
  }, [isStarted]);
  useEffect(() => {
    sessionStorage.setItem("sim_finished", String(isFinished));
  }, [isFinished]);
  useEffect(() => {
    if (usedParcelId !== null) sessionStorage.setItem("sim_parcel", String(usedParcelId));
  }, [usedParcelId]);

  /**
   * STEP4 Top-N 조회. **`domain` 이 없으면 부르지 않는다** — 기본값 `흡연` 을 넣으면
   * 성동구 run 을 보고 있는 화면이 용산 후보로 토론한다.
   */
  const loadCandidates = useCallback(async () => {
    if (!domain) return;
    setCandLoading(true);
    setCandFailure(null);
    try {
      const list = await fetchCandidates(domain);
      setCandidates(list.candidates);
    } catch (e) {
      setCandidates(null);
      if (e instanceof ApiError) {
        // 404 는 "적재 안 함" 이다. 서버가 적재 명령까지 문구에 넣어 준다 — 그대로 쓴다.
        setCandFailure({ code: `HTTP ${e.status}`, detail: e.detail });
      } else if (e instanceof NetworkError) {
        setCandFailure({ code: "NETWORK", detail: e.message });
      } else {
        setCandFailure({ code: "UNKNOWN", detail: String(e) });
      }
    } finally {
      setCandLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const pushSystem = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: "system",
        role: "system" as ChatRole,
        name: "시스템",
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        text,
      },
    ]);
  }, []);

  // ── SSE ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isStarted || isFinished) return;
    if (!selected) return;

    const controller = new AbortController();
    setUsedParcelId(selected.parcel_id);

    /**
     * 🔴 타임아웃을 **갈라 잡는다.** 첫 패킷까지 5분 / 그 뒤 침묵 1분.
     *    서버 기동 후 첫 토론은 PGVector 초기화 때문에 첫 패킷까지 264.2초가
     *    걸리고(실측), 두 번째부터는 2.6초다. 하나로 잡으면 둘 중 하나가 깨진다.
     *    "이후"는 브라우저가 아니라 **서버 프로세스** 기준이라 프런트가 미리
     *    단정할 수 없다 → 첫 패킷을 받기 전까지는 항상 긴 쪽을 쓴다.
     */
    let timer: ReturnType<typeof setTimeout> | null = null;
    let gotFirstPacket = false;

    const onTimeout = () => {
      controller.abort();
      const waited = gotFirstPacket ? IDLE_TIMEOUT_MS : FIRST_PACKET_TIMEOUT_MS;
      setFailure({
        code: "CLIENT_TIMEOUT",
        detail:
          `${Math.round(waited / 1000)}초 동안 서버에서 아무 것도 오지 않아 프런트가 연결을 끊었습니다. ` +
          (gotFirstPacket
            ? "토론 도중 멈춘 것이므로 백엔드 로그를 확인해야 합니다."
            : "백엔드를 방금 재시작했다면 첫 토론은 벡터 저장소 초기화에 5분 가까이 걸립니다."),
      });
      setIsFinished(true);
    };

    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onTimeout, gotFirstPacket ? IDLE_TIMEOUT_MS : FIRST_PACKET_TIMEOUT_MS);
    };
    arm();

    const startStreaming = async () => {
      try {
        await fetchEventSource(STREAM_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // 🔴 하드코딩하지 않는다. STEP4 Top-N 의 rank 1 이다.
            parcel_id: selected.parcel_id,
            facility_type: selected.facility_type,
            audit_data: {},
          }),
          signal: controller.signal,
          /**
           * 🔴 기본값이면 탭이 가려질 때 연결을 닫고 다시 연다. 첫 토론은 5분을
           *    기다려야 하는데 그 사이 탭을 옮기면 **처음부터 다시** 돈다
           *    (LLM 비용이 두 번 나가고 화면은 이유 없이 늦어진다).
           */
          openWhenHidden: true,
          async onopen(response) {
            const ct = response.headers.get("content-type") ?? "";
            if (response.ok && ct.includes("text/event-stream")) return;
            if (ct.includes("application/json")) {
              const errorData = await response.json();
              throw new Error(
                errorData.detail || errorData.message || "백엔드에서 JSON 에러를 반환했습니다.",
              );
            }
            throw new Error(`예상치 못한 Content-Type: ${ct || "(없음)"} (HTTP ${response.status})`);
          },
          onmessage(event) {
            if (!event.data) return;
            gotFirstPacket = true;
            arm();
            try {
              const msg = JSON.parse(event.data) as StreamPacket;

              /**
               * 🔴 에러 코드는 **뭉개지 않는다.** `CANDIDATE_NOT_FOUND` 는 좌표를
               *    지어내지 않고 멈췄다는 뜻이고, `OPENAI_QUOTA_EXCEEDED` 는 돈
               *    문제이며, `AI_ENGINE_ERROR` 는 코드 문제다 — 처치가 전부 다르다.
               *    빈 화면으로 삼키면 사용자는 "느리다"고만 안다.
               */
              if (msg.error_code) {
                setFailure({ code: msg.error_code, detail: msg.message ?? "(서버가 사유를 안 줬습니다)" });
                setIsFinished(true);
                return;
              }

              const sender = msg.sender ?? "";
              const text = msg.text ?? "";

              if (msg.is_finished || text.includes("최종 종료되었습니다")) {
                setIsFinished(true);
              }

              if (msg.metrics) {
                const m = msg.metrics;
                setMetrics((prev) => ({
                  cssPro: m.css_pro ?? prev.cssPro,
                  cssCon: m.css_con ?? prev.cssCon,
                  proAccept: typeof m.pro_acc === "number" ? Math.round(m.pro_acc * 100) : prev.proAccept,
                  conAccept: typeof m.con_acc === "number" ? Math.round(m.con_acc * 100) : prev.conAccept,
                }));
              }

              if (!sender && !text) return;

              setMessages((prev) => {
                const next = [...prev];
                const last = next.length > 0 ? next[next.length - 1] : null;
                const prevSender = last ? last.name || "" : "";

                if (sender && sender !== prevSender) {
                  const isSystem =
                    sender.toUpperCase().includes("SYSTEM") || sender === "시스템";
                  next.push({
                    id: `${Date.now()}-${Math.random()}`,
                    type: isSystem ? "system" : "user",
                    role: sender as ChatRole,
                    name: sender,
                    time: new Date().toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                    text,
                  });
                } else if (last) {
                  // 같은 화자면 토큰 조각을 이어 붙인다 (패킷 1,400~1,600건 → 발화 14건)
                  next[next.length - 1] = { ...last, text: last.text + text };
                }
                return next;
              });
            } catch (e) {
              console.error("스트리밍 데이터 파싱 오류:", e, event.data);
            }
          },
          onclose() {
            // 정상 종료. 던져서 자동 재연결을 막는다.
            throw new Error("Stream closed normally");
          },
          onerror(err) {
            throw err; // 재시도하지 않는다 — 토론은 멱등이 아니다.
          },
        });
      } catch (err) {
        if (err instanceof Error && err.message === "Stream closed normally") {
          setIsFinished(true);
          return;
        }
        if (controller.signal.aborted) return; // 타임아웃·언마운트는 위에서 이미 처리했다
        setFailure({
          code: "STREAM_FAILED",
          detail: err instanceof Error ? err.message : String(err),
        });
        setIsFinished(true);
      }
    };

    void startStreaming();

    return () => {
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [isStarted, isFinished, selected]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function reset() {
    SS_KEYS.forEach((k) => sessionStorage.removeItem(k));
    setIsStarted(false);
    setIsFinished(false);
    setMessages([]);
    setMetrics(EMPTY_METRICS);
    setFailure(null);
    setUsedParcelId(null);
    void loadCandidates();
  }

  const staleParcel =
    usedParcelId !== null && selected !== null && usedParcelId !== selected.parcel_id;

  return (
    <PageBody>
      <PageHeader
        screen={SCREEN}
        lead="AI 에이전트 간의 모의 공청회를 통해 잠재적 갈등 지수와 수용도를 실시간으로 분석합니다."
      />

      {/* 선정 위치 — 어느 점으로 토론하는지 먼저 밝힌다 */}
      <div className="mt-6">
        <CandidatePanel
          domain={domain}
          loading={candLoading}
          failure={candFailure}
          candidates={candidates}
          selected={selected}
          onRetry={() => void loadCandidates()}
        />
      </div>

      {staleParcel && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          화면에 남아 있는 대화는 <b>parcel_id {usedParcelId}</b> 로 돌린 것이고, 지금 선정 위치는{" "}
          <b>parcel_id {selected?.parcel_id}</b> 입니다. Top-N 이 다시 적재됐을 수 있습니다 —
          「초기화 및 재시작」을 눌러 새로 돌리세요.
        </div>
      )}

      {failure && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-red-800">{errorTitle(failure.code)}</span>
            <span className="rounded-md bg-red-100 px-2 py-0.5 font-mono text-[11px] text-red-700">
              {failure.code}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-red-900">
            {failure.detail}
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* 좌측: 채팅 패널 */}
        <div className="glass-panel relative flex h-[700px] flex-col rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-ink">AI 모의 심의 채팅</h2>
            {isStarted && (
              <button
                onClick={reset}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-bold text-red-600 transition-colors hover:bg-red-100"
              >
                초기화 및 재시작
              </button>
            )}
          </div>

          {!isStarted && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/50 backdrop-blur-[2px]">
              <button
                onClick={() => {
                  setFailure(null);
                  setIsStarted(true);
                }}
                disabled={!selected}
                className="rounded-full bg-blue-600 px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:scale-100"
              >
                AI 토론 시작하기
              </button>
              <p className="mt-4 text-[13px] text-ink-secondary">
                {selected
                  ? `선정 위치(rank 1, parcel_id ${selected.parcel_id})로 시뮬레이션을 시작합니다.`
                  : "후보점을 먼저 불러와야 시작할 수 있습니다."}
              </p>
              {selected && (
                <p className="mt-1 text-[12px] text-ink-secondary">
                  첫 실행은 벡터 저장소 초기화 때문에 첫 발언까지 최대 5분 걸립니다.
                </p>
              )}
            </div>
          )}

          <div className="custom-scrollbar flex-1 overflow-y-auto pr-4">
            {messages.length === 0 && (
              <div className="mt-10 text-center text-[13px] text-ink-secondary">
                시뮬레이션 대기 중...
              </div>
            )}
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* 우측: 지표 패널 */}
        <div className="flex h-[700px] flex-col gap-6">
          <div className="glass-panel flex flex-1 flex-col rounded-2xl p-6">
            <h2 className="mb-1 text-[18px] font-bold text-ink">갈등 지수 (Conflict Index)</h2>
            <p className="mb-4 text-[11px] text-ink-secondary">
              서버는 등급(LOW/MEDIUM/HIGH)만 보냅니다. 점수로 환산하지 않습니다.
            </p>
            <div className="flex flex-1 items-center justify-around">
              <ConflictGauge
                score={metrics.cssPro ? (LEVEL_ANGLE[metrics.cssPro] ?? 50) : 0}
                level={metrics.cssPro ?? undefined}
                label="찬성측 갈등 지수"
              />
              <ConflictGauge
                score={metrics.cssCon ? (LEVEL_ANGLE[metrics.cssCon] ?? 50) : 0}
                level={metrics.cssCon ?? undefined}
                label="반대측 갈등 지수"
              />
            </div>
          </div>

          <div className="glass-panel flex flex-1 flex-col rounded-2xl p-6">
            <h2 className="mb-6 text-[18px] font-bold text-ink">수용도 (Acceptance Score)</h2>
            <div className="flex flex-1 items-center justify-around">
              {/* 🔴 `?? 0` 을 쓰지 않는다 — 값이 없는 것을 "수용도 0%" 로 지어내면
                  화면이 아직 안 나온 결론을 말하게 된다(원칙 4). */}
              <AcceptanceCircle score={metrics.proAccept} label="찬성측 수용도" color="#3b82f6" />
              <AcceptanceCircle score={metrics.conAccept} label="반대측 수용도" color="#ef4444" />
            </div>
          </div>
        </div>
      </div>

      <PageFooter screen={SCREEN} />
      <SourceNote
        files={[
          "GET /api/v1/simulation/candidates?domain=<도메인> (STEP4 Top-N · rank 1 = 선정 위치)",
          "POST /api/v1/simulation/stream (SSE)",
        ]}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
      `,
        }}
      />
    </PageBody>
  );
}

/**
 * 선정 위치 패널.
 *
 * 화면이 **어느 점으로 토론하는지 숨기지 않는다.** 예전에는 `parcel_id: 1` 이
 * 코드에 박혀 있어 STEP4 를 다시 돌려도 늘 같은 점이었는데, 화면에는 그 사실이
 * 어디에도 안 나왔다.
 */
function CandidatePanel({
  domain,
  loading,
  failure,
  candidates,
  selected,
  onRetry,
}: {
  domain: string | null;
  loading: boolean;
  failure: Failure | null;
  candidates: Candidate[] | null;
  selected: Candidate | null;
  onRetry: () => void;
}) {
  if (!domain) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-[13px] text-gray-700">
        실행 중인 run 이 없어 <b>도메인</b>을 알 수 없습니다. 화면 1 에서 분석을 먼저 시작하세요.
        <span className="ml-1 text-gray-500">
          (도메인 기본값을 두지 않습니다 — 다른 지자체 후보로 토론하게 됩니다)
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-[13px] text-gray-600">
        STEP4 Top-N 후보를 불러오는 중… (domain={domain})
      </div>
    );
  }

  if (failure) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-red-800">후보점을 불러오지 못했습니다</span>
          <span className="rounded-md bg-red-100 px-2 py-0.5 font-mono text-[11px] text-red-700">
            {failure.code}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-all font-mono text-[12px] text-red-900">
          {failure.detail}
        </p>
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-50"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!selected) return null;

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
          rank 1 · 선정 위치
        </span>
        <span className="text-[15px] font-bold text-ink">{selected.jibun}</span>
        <span className="font-mono text-[12px] text-ink-secondary">
          parcel_id {selected.parcel_id} · PNU {selected.pnu}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-ink-secondary sm:grid-cols-4">
        <Kv k="시설" v={selected.facility_type} />
        <Kv k="점수" v={selected.score.toFixed(4)} />
        <Kv k="좌표" v={`${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`} />
        <Kv k="run" v={selected.run_id} />
      </div>
      <p className="mt-2 text-[11px] text-ink-secondary">
        후보 {candidates?.length ?? 0}건 중 rank 1. 점수 내림차순이 아니라 <b>MCLP 커버
        기여도</b> 순서이므로 점수가 더 높은 하위 순위가 있을 수 있습니다.
        {selected.land_id === null && " land_id 는 NULL 입니다(공간조인 미매칭 — 정상)."}
      </p>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-ink-secondary">{k} </span>
      <span className="font-mono text-ink">{v}</span>
    </div>
  );
}
