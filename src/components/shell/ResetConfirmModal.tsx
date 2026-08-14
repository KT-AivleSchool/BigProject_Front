"use client";

/**
 * 「데이터 초기화」 확인 — **도메인 이름을 직접 쳐야 열린다.**
 * ========================================================
 * 🔴 **왜 `confirm()` 을 버렸나.** 이 버튼은 이제 폴더 단위로 지운다 — 그 도메인에
 *    올린 조례·데이터 **전부**와 벡터 검색 색인까지다. 파일 단위 삭제(`/upload/
 *    regulations/{filename}`)와 달리 **되돌릴 방법이 없고**, 서버 쪽에도 `force`
 *    같은 우회가 없다. 브라우저 기본 확인창은 엔터 한 번에 넘어간다.
 *    (백엔드 회신 2026-08-14: 「체크박스는 8-13 사고를 못 막습니다」 —
 *     같은 이유로 체크박스도 안 쓴다. **타이핑**이어야 한다.)
 *
 * 🔴 **타이핑은 「지울 게 있을 때」만 요구한다**(`deletable !== null`).
 *    프리셋 도메인·옛 서버·개수 확인 실패는 파일을 **한 개도 안 지운다**(헤더가
 *    아예 라우트를 안 친다). 거기서까지 이름을 치게 하면 그건 안전장치가 아니라
 *    **아무것도 막지 않는 마찰**이고, 마찰이 습관이 되면 진짜 삭제에서도 손이
 *    먼저 움직인다.
 *
 * 🔴 **개수를 글로 적는다.** 「폴더를 지웁니다」는 크기를 안 알려준다 —
 *    「조례 3개 · 데이터 11개」라고 적어야 사람이 무게를 잰다(절대원칙 4).
 *    개수는 우리가 세지 않는다. `GET /upload/domains` 가 준 값 그대로다.
 *
 * 🔴 **`isOpen` prop 이 없는 것은 빠뜨린 게 아니다**(2026-08-14). 이 모달은
 *    `Header.tsx` 가 `{confirmTargets && <ResetConfirmModal …/>}` 로 **조건부
 *    렌더**한다 — 닫히면 언마운트되므로 **존재 자체가 곧 열림**이다. 그래서
 *    `useState("")` 의 초기값이 매번 새로 잡히고, 지난번에 친 도메인 이름이
 *    남을 자리가 **구조적으로** 없다.
 *    처음엔 `isOpen` 을 받아 `useEffect` 로 비웠는데(그 자리가 곧 eslint
 *    `react-hooks/set-state-in-effect` 였다) 그 방식은 **안전이 부모의 렌더
 *    방식에 매달린다** — 누가 나중에 항상 마운트해두고 `isOpen` 만 토글하면
 *    「이름을 치게 한 이유」가 조용히 사라진다. 규칙을 억누르는 대신 그
 *    매달림을 없앴다. `AuthModal` 은 항상 마운트라 `isOpen` 을 받는다 —
 *    **모양이 다른 건 두 모달의 수명이 달라서다.**
 */
import { useEffect, useState } from "react";

export interface ResetTargets {
  /** 취소될 실행. 없으면 `null`(브라우저 상태만 지운다). */
  runId: string | null;
  /** 그 실행이 진행 중인가 — 「취소됩니다」를 붙일지 정한다. */
  live: boolean;
  domain: string | null;
  /**
   * 지워질 파일 수. **`null` 이면 아무것도 안 지운다** — 프리셋이거나, 옛 서버이거나,
   * 개수를 못 셌다는 뜻이다. 「0개」와 다르다: 0개는 셌는데 없는 것이고 `null` 은
   * 세지 못한 것이다(그 사유가 `countReason`).
   */
  deletable: { law: number; data: number } | null;
  countReason: string | null;
}

export function ResetConfirmModal({
  targets,
  onClose,
  onConfirm,
}: {
  targets: ResetTargets;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { runId, live, domain, deletable, countReason } = targets;
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const needsTyping = deletable !== null && !!domain;
  const armed = !needsTyping || typed === domain;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl">
        <div className="border-b border-hairline px-6 py-4">
          <h2 className="text-[15px] font-semibold text-ink">현재 실행을 초기화합니다</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 text-[13px] text-ink-secondary">
          <ul className="space-y-2">
            {runId && (
              <li>
                · 실행 <span className="font-mono text-ink">{runId}</span>
                {live ? " — 진행 중이므로 취소됩니다." : ""}
              </li>
            )}
            {domain && (
              <li>
                · 도메인 「<span className="font-medium text-ink">{domain}</span>」 —{" "}
                {deletable ? (
                  <span className="text-red-700">
                    올린 조례 <b>{deletable.law}개</b> · 데이터 <b>{deletable.data}개</b>를 지웁니다
                    (벡터 검색 색인 포함). <b>되돌릴 수 없습니다.</b>
                  </span>
                ) : (
                  /* 없는 삭제를 예고하지 않는다. 사유는 서버·목록에서 온 그대로다. */
                  (countReason ?? "지울 업로드가 없습니다.")
                )}
              </li>
            )}
            <li>· 브라우저에 남은 실행 상태(진행 위치·확인 답변)를 지웁니다.</li>
          </ul>

          {needsTyping && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50/60 p-3">
              <label className="block text-[12px] text-red-900">
                확인을 위해 도메인 이름 「<b>{domain}</b>」 을 그대로 입력하세요.
              </label>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={domain ?? ""}
                className="mt-2 w-full rounded-md border border-red-300 bg-white px-3 py-2 font-mono text-[13px] outline-none focus:border-red-500"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline px-4 py-2 text-[13px] text-ink-secondary hover:bg-black/[0.04]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!armed}
            className="rounded-md bg-red-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {/* 문구가 곧 동작이다. 지울 게 없으면 「삭제」라고 쓰지 않는다. */}
            {deletable ? "영구 삭제하고 초기화" : "초기화"}
          </button>
        </div>
      </div>
    </div>
  );
}
