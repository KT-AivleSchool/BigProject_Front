"use client";

/**
 * 상단 셸 — 로고 · 6단계 내비 · 실행 상태.
 *
 * 내비에는 **화면 번호**만 나온다. STEP 번호는 여기 절대 안 들어온다.
 * 완료 표시(✓)의 기준은 "그 화면이 읽을 산출물이 run 에 있는가" 다 —
 * 사용자가 방문했는지가 아니라 데이터가 있는지로 판단한다.
 *
 * 🔴 **화면 5 만 예외다.** 다른 화면은 `run.artifacts` 하나로 판정하는데 토론은
 *    거기 없다 — **서버 DB 에 남고**(2026-08-11 경로가 열렸다) 물으려면 조인 키인
 *    `run.loaded.run_id` 가 있어야 한다. 그래서 아래 `hearingDone` 을 따로 구해
 *    넘긴다. 판정이 어디서 왔는지(`source`)까지 같이 온다.
 */
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SCREENS, screenOf, isScreenReady, isScreenAllowed } from "@/lib/omnisite/screens";
import { useRun } from "@/lib/omnisite/RunProvider";
import { isHearingDoneFor } from "@/lib/omnisite/hearingResult";
import { useHearingDone } from "@/lib/omnisite/hearings";
import type { ArtifactName, RunDoc } from "@/lib/omnisite/types";
import { AuthModal } from "./AuthModal";
import { SessionBadge } from "./SessionBadge";
import { getAuthUser, clearAuth, UserResponse } from "@/lib/omnisite/auth";

export function Header() {
  const pathname = usePathname();
  const { run } = useRun();
  const current = screenOf(pathname);
  const live = run?.status === "queued" || run?.status === "running";

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<UserResponse | null>(null);

  /**
   * 화면 5 완료 여부. **서버가 본선, sessionStorage 가 폴백**이다(`useHearingDone`).
   * 둘 다 마운트 뒤에 구한다 — 로컬 기록은 서버 렌더 때 존재하지 않아 렌더 중에
   * 읽으면 하이드레이션이 깨진다(2026-08-05 에 한 번 밟은 자리다).
   *
   * 🔴 폴백으로 넘기는 `isHearingDoneFor` 는 **이 탭 안에서만 유효**하다. 서버에
   *    못 물었을 때만(적재 칸 없는 fixture·hitl 실행, 404, 네트워크 실패) 쓰인다 —
   *    서버가 「0건」이라고 답하면 로컬을 보지 않는다.
   */
  const hearing = useHearingDone(isHearingDoneFor, pathname);
  const hearingDone = hearing.done;

  useEffect(() => {
    setUser(getAuthUser());
  }, []);

  const handleLogout = () => {
    // 🔴 access·refresh·user 를 **같이** 지운다(`clearAuth`). 예전엔 access 와 user 만
    //    지웠는데, refresh 키가 생긴 뒤로는 그러면 죽은 재발급 토큰이 남아 다음
    //    로그인 세션과 섞인다.
    clearAuth();
    setUser(null);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-hairline bg-glass-mid backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-5">
          <Link href="/" className="flex shrink-0 items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">OmniSite</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {NAV_SCREENS.map((s, i) => {
              const active = current?.no === s.no;
              const done = isScreenReady(run, s.no, hearingDone) && !active;
              const allowed = isScreenAllowed(run, s.no, hearingDone);
              
              const inner = (
                <>
                  <span
                    className={[
                      "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[10px] font-semibold transition-colors",
                      active
                        ? "bg-white/25 text-white"
                        : done
                          ? "bg-primary/12 text-primary"
                          : allowed
                            ? "bg-black/[0.06] text-ink-secondary"
                            : "bg-black/[0.03] text-ink-secondary/30",
                    ].join(" ")}
                  >
                    {done ? "✓" : s.no}
                  </span>
                  <span className="whitespace-nowrap">{s.name}</span>
                </>
              );

              return (
                <div key={s.no} className="flex shrink-0 items-center">
                  {i > 0 && <span className="px-1 text-ink-secondary/40">›</span>}
                  {allowed ? (
                    <Link
                      /**
                       * 🔴 **들어가는 문은 `entryPath` 다**(있을 때만). 화면 5 는 경로가
                       *    셋이라 `path`(`/hearing`) 로 링크하면 방식을 고르는 화면을
                       *    건너뛰고 **A 로 바로** 떨어진다 — 그러면 B 는 URL 을 직접
                       *    쳐야 닿는 예전 상태로 돌아간다. 지금 어느 화면인지 판정하는
                       *    `screenOf` 는 여전히 `path` 를 쓴다(같이 바꾸면 A·B 화면에서
                       *    화면 5 표시가 꺼진다).
                       */
                      href={s.entryPath ?? s.path}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-primary text-white"
                          : "text-ink-secondary hover:bg-black/[0.04] hover:text-ink",
                      ].join(" ")}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-ink-secondary/40 cursor-not-allowed"
                      title="이전 단계를 먼저 완료해주세요."
                    >
                      {inner}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-4 ml-4">
            {/* 유틸리티 링크 (가이드라인 준수) */}
            <div className="flex items-center gap-3 text-[12px] text-gray-600 font-medium">
              <Link href="/posts" className="hover:text-primary transition-colors font-semibold flex items-center gap-1 text-primary/90 bg-primary/8 px-2 py-1 rounded">
                <span>📋</span> 게시판
              </Link>
              <span className="text-gray-300">|</span>
              {user ? (
                <>
                  <Link href="/mypage" className="text-gray-800 hover:text-primary transition-colors font-semibold">
                    {maskName(user.username)}님
                  </Link>
                  <SessionBadge />
                  <span className="text-gray-300">|</span>
                  <Link href="/mypage" className="hover:text-primary transition-colors">마이페이지</Link>
                  <span className="text-gray-300">|</span>
                  <button onClick={handleLogout} className="hover:text-primary transition-colors">로그아웃</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setAuthMode("login"); setAuthModalOpen(true); }} className="hover:text-primary transition-colors">로그인</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => { setAuthMode("register"); setAuthModalOpen(true); }} className="hover:text-primary transition-colors">회원가입</button>
                </>
              )}
            </div>

          </div>
        </div>
      </header>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onSuccess={(u) => setUser(u)}
      />
    </>
  );
}

function statusText(s: RunDoc["status"]): string {
  // 상태값을 한글로 바꾸되 의미를 보태지 않는다. failed 를 "오류"로 순화하지 않는다.
  //
  // 🔴 `awaiting_hitl` 을 "대기" 라고 쓰면 `queued` 와 같은 말이 된다. 둘 다 멈춰
  //    있지만 `queued` 는 서버가 곧 집어가고 이쪽은 **사람이 답할 때까지 영영**
  //    안 움직인다. 상단 배지는 좁아서 줄이고 싶어지는 자리인데, 여기서 줄이면
  //    사람이 실행이 알아서 굴러가는 줄 알고 기다린다.
  return {
    queued: "대기",
    running: "진행 중",
    awaiting_hitl: "확인 대기",
    succeeded: "완료",
    failed: "실패",
  }[s];
}

function maskName(name: string): string {
  if (!name) return "";
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";

  const first = name.substring(0, 1);
  const last = name.substring(name.length - 1);
  const masked = "*".repeat(name.length - 2);

  return first + masked + last;
}
