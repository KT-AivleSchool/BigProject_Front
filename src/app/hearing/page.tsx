"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageBody, PageFooter, PageHeader, SourceNote } from "@/components/ui/Page";
import { readSitePick, type SitePick } from "@/lib/omnisite/sitePick";
import { SCREENS } from "@/lib/omnisite/screens";
import { useSelectedSite, type Failure } from "@/lib/omnisite/useSelectedSite";
import {
  Candidate,
  FIRST_PACKET_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  STREAM_URL,
  StreamPacket,
  errorTitle,
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

const SS_KEYS = ["sim_messages", "sim_metrics", "sim_started", "sim_finished", "sim_parcel", "sim_run_id", "sim_pnu"];

/** 버퍼 마감 시한(ms). rAF 가 안 도는 숨은 탭에서 이쪽이 받아낸다. */
const FLUSH_DEADLINE_MS = 120;

/**
 * `onopen` 이 판정한 **사유 코드**를 바깥 `catch` 까지 들고 가는 통로.
 *
 * `fetchEventSource` 는 던진 것만 밖으로 내보내므로 코드를 문구에 실어 보내고
 * 다시 파싱하는 수밖에 없는데, 그러면 문구를 한 글자 고치는 날 분기가 조용히
 * 죽는다. 필드로 들고 간다.
 */
class OpenFailure extends Error {
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(detail);
    this.name = "OpenFailure";
  }
}

export default function Screen5Page() {
  /**
   * 🔴 「토론할 위치」 배선은 **`useSelectedSite()` 한 곳**이다(2026-08-11 이관).
   *    예전엔 같은 규칙이 이 파일 안에 인라인으로 한 벌 더 있었다 — 도메인 기본값
   *    금지 · `run.loaded.run_id` 그대로 넘기기 · **PNU 로 잇기** · 못 이으면
   *    되짚지 않기. B(`/dynamic-hearing`)가 그 훅을 쓰고 A 만 사본을 들고 있었는데,
   *    사본은 **import 가 멀쩡하고 값만 갈리는 종류**의 사고를 낸다(백엔드 함정표
   *    `dummy/gam4_spatial_ops.py` 와 같다). 옮긴 것이지 새로 쓴 게 아니다 —
   *    아래에서 없어진 코드는 훅 안에 **같은 문장 그대로** 있다.
   */
  const site = useSelectedSite();
  const { domain, candidates, selected, pick, pickMissing, pickUnmatched } = site;
  const candLoading = site.loading;
  const candFailure = site.failure;

  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [failure, setFailure] = useState<Failure | null>(null);
  /** 실제로 `/stream` 에 넘긴 후보. 복원된 대화가 어느 점의 것인지 밝히려고 남긴다. */
  const [usedParcelId, setUsedParcelId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 세션 복원
  useEffect(() => {
    try {
      const pick = readSitePick();
      const currentRunId = pick?.run_id ?? null;
      const currentPnu = pick?.pnu ?? null;

      const savedRunId = sessionStorage.getItem("sim_run_id");
      const savedPnu = sessionStorage.getItem("sim_pnu");

      // 새 실행(run)이거나 다른 위치(pnu)면 과거 기록을 무시하고 지운다
      if ((savedRunId && savedRunId !== currentRunId) || (savedPnu && savedPnu !== currentPnu)) {
        SS_KEYS.forEach((k) => sessionStorage.removeItem(k));
        return;
      }

      const savedMessages = sessionStorage.getItem("sim_messages");
      const savedMetrics = sessionStorage.getItem("sim_metrics");
      const savedStarted = sessionStorage.getItem("sim_started");
      const savedFinished = sessionStorage.getItem("sim_finished");
      const savedParcel = sessionStorage.getItem("sim_parcel");

      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedMessages) setMessages(JSON.parse(savedMessages));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedMetrics) setMetrics(JSON.parse(savedMetrics));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedStarted === "true") setIsStarted(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedFinished === "true") setIsFinished(true);
      if (savedParcel) setUsedParcelId(Number(savedParcel));
    } catch (e) {
      console.error("세션 스토리지 복구 실패", e);
    }
    // 🔴 화면 4 의 선택(`readSitePick`)은 여기서 안 읽는다 — `useSelectedSite()`
    //    안에서 같은 이유(하이드레이션)로 `useEffect` 에 담아 읽는다.
  }, []);

  /**
   * 🔴 패킷마다 쓰지 않는다. `sim_messages` 는 토론이 끝날 무렵 140KB 가 넘는데
   *    (실측 146,701B · 1,586패킷), `JSON.stringify` + `sessionStorage.setItem`
   *    은 **동기**라 초당 ~48회 부르면 메인 스레드가 그만큼 멈춘다. 화면에서는
   *    "SSE 가 안 온다"로 보인다 — 서버는 실시간으로 흘려보내고 있다(같은 실측:
   *    TTFB 1.87s · 종료 직전 1초에 몰린 바이트 1.5%). 최대 1초에 한 번만 쓰고,
   *    마지막 변경은 타이머가 안 취소되므로 **완결본은 반드시 저장된다**.
   */
  const lastPersistRef = useRef(0);
  useEffect(() => {
    if (messages.length === 0) return;
    const due = Math.max(0, 1000 - (Date.now() - lastPersistRef.current));
    const t = setTimeout(() => {
      lastPersistRef.current = Date.now();
      sessionStorage.setItem("sim_messages", JSON.stringify(messages));
    }, due);
    return () => clearTimeout(t);
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
   * 🔴 패킷 하나에 렌더 하나를 하지 않는다. 토론 한 번이 **1,586패킷 / 32초**
   *    (실측)이고 그때마다 ⓐ 전체 대화 리렌더 ⓑ `scrollIntoView` 강제 레이아웃이
   *    걸린다 — 브라우저가 프레임을 못 그려 **끝나고 한꺼번에 뜨는 것처럼** 보인다.
   *    받은 조각은 버퍼에 쌓고 **프레임당 한 번** 합쳐 넣는다. 화면에 들어가는
   *    내용은 한 글자도 안 바뀐다(합치는 규칙이 같다) — 바뀌는 건 횟수뿐이다.
   *    ⚠ 버퍼는 ref 다. state 로 두면 그 자체가 리렌더를 부른다.
   *
   * 🔴 rAF **하나에만** 매달지 않는다. 탭이 숨겨지면(`document.hidden`)
   *    브라우저가 rAF 를 **아예 안 돌린다** — 그러면 이 버퍼가 곧 버퍼링이 되어
   *    돌아왔을 때 한꺼번에 쏟아진다(고치려던 증상과 똑같이 보인다).
   *    마감 타이머를 같이 걸어 **둘 중 먼저 오는 쪽**이 비운다: 보이는 탭에서는
   *    rAF(~16ms)가 항상 이기므로 동작이 안 바뀌고, 숨은 탭에서는 타이머가
   *    받아낸다(숨은 탭은 최소 1초로 조여지지만 어차피 그리지 않는 구간이다).
   */
  const pendingRef = useRef<{ sender: string; text: string }[]>([]);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPending = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const batch = pendingRef.current;
    if (batch.length === 0) return;
    pendingRef.current = [];

    setMessages((prev) => {
      const next = [...prev];
      for (const { sender, text } of batch) {
        const last = next.length > 0 ? next[next.length - 1] : null;
        const prevSender = last ? last.name || "" : "";

        if (sender && sender !== prevSender) {
          const isSystem = sender.toUpperCase().includes("SYSTEM") || sender === "시스템";
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
      }
      return next;
    });
  }, []);

  const queuePacket = useCallback(
    (sender: string, text: string) => {
      pendingRef.current.push({ sender, text });
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          flushPending();
        });
      }
      if (timerRef.current === null) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          flushPending();
        }, FLUSH_DEADLINE_MS);
      }
    },
    [flushPending],
  );

  /**
   * 🔴 언마운트에서 rAF·타이머를 **직접** 푼다. SSE 이펙트의 정리는
   *    `controller.abort()` 까지고, 그 시점에 예약된 콜백은 그대로 남는다 —
   *    깨어나서 `setMessages` 를 부르면 사라진 컴포넌트를 갱신하는 셈이다.
   *    두 손잡이를 만든 곳이 여기이므로 놓는 곳도 여기다.
   */
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      rafRef.current = null;
      timerRef.current = null;
    };
  }, []);

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
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            // 🔴 하드코딩하지 않는다. 화면 4 에서 고른 필지(PNU 로 이은 것)다.
            //    `audit_data` 는 2026-08-11 계약에서 빠졌다 — 감리 근거는 요청이
            //    아니라 서버가 `parcel_id` 로 조회한다(`StreamRequest` 주석).
            parcel_id: selected.parcel_id,
            facility_type: selected.facility_type,
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
            if (response.ok && ct.includes("text/event-stream")) {
              /**
               * 🔴 「넘겼다」를 **여기서** 적는다. 예전엔 effect 본문에서 요청을 보내기
               *    전에 적었는데, 그러면 스트림이 안 열려도(400·JSON 에러) 화면에는
               *    「이 필지로 돌렸다」가 남는다 — 그 필지로는 한 마디도 안 나왔다.
               *    effect 본문의 동기 setState 라 `react-hooks/set-state-in-effect`
               *    에도 걸렸고, 규칙이 받아주는 자리(콜백)가 마침 **더 정확한 자리**다.
               */
              setUsedParcelId(selected.parcel_id);
              
              // 스트림이 정상적으로 열렸을 때 현재 run_id와 pnu를 한 번만 기록한다
              if (site.pick?.run_id) sessionStorage.setItem("sim_run_id", site.pick.run_id);
              if (site.pick?.pnu) sessionStorage.setItem("sim_pnu", site.pick.pnu);
              
              return;
            }
            if (ct.includes("application/json")) {
              const errorData = await response.json();
              throw new Error(
                errorData.detail || errorData.message || "백엔드에서 JSON 에러를 반환했습니다.",
              );
            }
            /**
             * 🔴 **Content-Type 이 아예 없으면 스트림 문제가 아니다.**
             *    이 자리는 오래 「예상치 못한 Content-Type: (없음) (HTTP 500)」만
             *    띄웠다. 그 문구를 받은 사람은 백엔드 토론 엔진을 뒤지는데,
             *    2026-08-14 조사에서 EC2 컨테이너 로그 · nginx 로그 · 로컬
             *    uvicorn · 핸들러 어디에도 **요청 자체가 닿은 흔적이 없었다.**
             *
             *    백엔드는 이 모양으로 응답하지 않는다 — 성공은 `text/event-stream`,
             *    실패는 `application/json` 이고 둘 다 위에서 걸린다. 헤더 없는 500
             *    을 만들 수 있는 건 **그 앞에 있는 Next rewrite 프록시**뿐이다
             *    (`next.config.ts` 의 proxyTimeout·업로드 상한 주석에 같은 서명이
             *    두 번 적혀 있다 — 「죽인 쪽은 백엔드가 아니다」).
             *
             *    그래서 코드부터 가른다. 사유를 스트림 쪽으로 읽히게 두면 조사
             *    인력이 통째로 엉뚱한 곳으로 간다(원칙 4: 없는 사실을 말하지 않는다).
             */
            if (ct === "") {
              throw new OpenFailure(
                "BACKEND_UNREACHABLE",
                `요청이 백엔드에 닿지 않았습니다. 앞단 프록시가 백엔드 응답 없이 ` +
                  `HTTP ${response.status} 를 만들었습니다(Content-Type 없음 — 백엔드는 ` +
                  `이런 응답을 만들지 않습니다). 토론 엔진 문제가 아니므로 확인할 곳은 ` +
                  `ⓐ 백엔드 프로세스가 떠 있는지 ⓑ \`OMNISITE_API_ORIGIN\` 이 그 주소를 ` +
                  `가리키는지(안 주면 http://127.0.0.1:8000) ⓒ Next 서버 콘솔의 ` +
                  `\`Failed to proxy … ECONNREFUSED/ECONNRESET\` 줄입니다.`,
              );
            }
            throw new Error(`예상치 못한 Content-Type: ${ct} (HTTP ${response.status})`);
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

              queuePacket(sender, text);
              // 끝났으면 버퍼에 남은 조각을 바로 넣는다 — 다음 프레임을 기다리면
              // 마지막 문장이 화면에서 잘린 채로 남는다.
              if (msg.is_finished) flushPending();
            } catch (e) {
              console.error("스트리밍 데이터 파싱 오류:", e, event.data);
            }
          },
          onclose() {
            // 버퍼에 남은 조각을 흘리고 나서 끝낸다 — 안 그러면 마지막 프레임
            // 분량이 화면에 영영 안 들어간다(서버는 보냈는데 안 보인다).
            flushPending();
            // 정상 종료. 던져서 자동 재연결을 막는다.
            throw new Error("Stream closed normally");
          },
          onerror(err) {
            throw err; // 재시도하지 않는다 — 토론은 멱등이 아니다.
          },
        });
      } catch (err) {
        flushPending();
        if (err instanceof Error && err.message === "Stream closed normally") {
          setIsFinished(true);
          return;
        }
        if (controller.signal.aborted) return; // 타임아웃·언마운트는 위에서 이미 처리했다
        setFailure({
          // `onopen` 이 이미 사유를 판정했으면 그 코드를 쓴다. 여기서 전부
          // `STREAM_FAILED` 로 덮으면 위에서 가른 것이 도로 뭉개진다.
          code: err instanceof OpenFailure ? err.code : "STREAM_FAILED",
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
  }, [isStarted, isFinished, selected, queuePacket, flushPending]);

  useEffect(() => {
    // 🔴 smooth 스크롤을 쓰면 SSE 토큰이 초당 수십 번씩 렌더링될 때 브라우저 렌더링 엔진이 마비되어
    // 통신이 끝날 때까지 화면이 멈추는(한 번에 나오는) 버그가 발생하므로 auto 를 쓴다.
    chatEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  function reset() {
    SS_KEYS.forEach((k) => sessionStorage.removeItem(k));
    pendingRef.current = [];
    setIsStarted(false);
    setIsFinished(false);
    setMessages([]);
    setMetrics(EMPTY_METRICS);
    setFailure(null);
    setUsedParcelId(null);
    site.reload();
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
          pick={pick}
          pickMissing={pickMissing}
          pickUnmatched={pickUnmatched}
          onRetry={site.reload}
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
              {!selected && (
                <p className="mt-4 text-[13px] text-amber-700">
                  {pickMissing
                    ? "이전 화면에서 공청회를 열 위치를 먼저 고르세요."
                    : "후보점을 먼저 불러와야 시작할 수 있습니다."}
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

      {/* 바닥 내비게이션 바 */}
      <div className="mt-6 mb-8 flex shrink-0 items-center justify-between rounded-2xl border border-gray-100 bg-white px-8 py-5 shadow-sm">
        <Link
          href="/sites"
          className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            이전 단계
          </div>
        </Link>
        {isFinished ? (
          <Link
            href="/report"
            className="rounded-xl bg-green-600 px-8 py-2.5 text-sm font-bold text-white shadow-md shadow-green-200 transition-colors hover:bg-green-700"
          >
            <div className="flex items-center gap-2">
              갈등 예측 완료, 보고서로 넘어가기 &gt;
            </div>
          </Link>
        ) : (
          <button
            disabled
            className="rounded-xl bg-gray-300 px-8 py-2.5 text-sm font-bold text-white cursor-not-allowed opacity-70"
          >
            <div className="flex items-center gap-2">
              갈등 예측 진행 중...
            </div>
          </button>
        )}
      </div>

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
 *
 * 지금은 그 자리에 **화면 4 의 선택**이 들어온다. 그래서 상태가 셋 더 있다:
 * 안 골랐다 · 골랐는데 목록에 없다 · 골랐고 이었다. 셋을 한 문구로 뭉치면
 * 사람이 무엇을 해야 하는지 알 수 없다.
 */
function CandidatePanel({
  domain,
  loading,
  failure,
  candidates,
  selected,
  pick,
  pickMissing,
  pickUnmatched,
  onRetry,
}: {
  domain: string | null;
  loading: boolean;
  failure: Failure | null;
  candidates: Candidate[] | null;
  selected: Candidate | null;
  pick: SitePick | null | undefined;
  pickMissing: boolean;
  pickUnmatched: boolean;
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

  if (pickMissing) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-900">
        <p className="font-semibold">공청회를 열 위치가 아직 정해지지 않았습니다.</p>
        <p className="mt-1">
          화면 4(위치 선정)에서 지도나 후보 목록의 한 곳을 고르고 「이 위치로 갈등 예측
          실행」을 누르세요.
          <span className="ml-1 text-amber-800/80">
            (1순위를 자동으로 집지 않습니다 — 순위는 추천이지 결정이 아닙니다)
          </span>
        </p>
        <Link
          href="/sites"
          className="mt-3 inline-block rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-bold text-amber-800 hover:bg-amber-50"
        >
          화면 4 로 이동
        </Link>
      </div>
    );
  }

  if (pickUnmatched && pick) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-[13px] text-red-900">
        <p className="font-semibold">고른 위치를 적재된 후보 목록에서 찾지 못했습니다.</p>
        <p className="mt-1">
          화면 4 에서 고른 것: <b>{pick.jibun}</b> ({pick.rank}순위 ·{" "}
          <span className="font-mono">PNU {pick.pnu}</span>
          {pick.run_id ? ` · run ${pick.run_id}` : ""})
        </p>
        <p className="mt-1">
          지금 서버에 적재된 후보는 {candidates?.length ?? 0}건인데 그 안에 이 PNU 가 없습니다.
          화면 4 가 보던 실행과 DB 에 적재된 실행이 다를 때 이렇게 됩니다.
          <b> 순위가 같은 다른 필지로 대신 돌리지 않습니다</b> — 그러면 고른 곳이 아닌 땅으로
          토론이 돌아갑니다.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onRetry}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-50"
          >
            후보 목록 다시 불러오기
          </button>
          <Link
            href="/sites"
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-50"
          >
            화면 4 에서 다시 고르기
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-ink-secondary">{k} </span>
      <span className="font-mono text-ink">{v}</span>
    </div>
  );
}
