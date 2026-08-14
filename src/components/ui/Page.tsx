"use client";

/**
 * 화면 공통 골격 — 제목 · 임시(안) 표시 · 이전/다음.
 *
 * 명세의 「Step N / 6」 표기를 그대로 쓴다. 이 "Step" 은 **화면 번호**이고
 * 백엔드 STEP 번호가 아니다. 헷갈리기 딱 좋은 지점이라, 화면에도 그 사실을
 * 각주로 남긴다(명세 2쪽이 요구하는 바다).
 */
import Link from "next/link";
import { NAV_SCREENS, neighbours, type Screen, isScreenAllowed } from "@/lib/omnisite/screens";
import { useRun } from "@/lib/omnisite/RunProvider";

export function DraftBadge() {
  return (
    <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
      임시(안)
    </span>
  );
}

export function PageHeader({
  screen,
  lead,
  right,
}: {
  screen: Screen;
  lead?: string;
  right?: React.ReactNode;
}) {
  const idx = NAV_SCREENS.findIndex((s) => s.no === screen.no);
  return (
    <div className="shrink-0 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[19px] font-semibold tracking-tight">
            {screen.name}
          </h1>
        </div>
        {lead && <p className="mt-1 text-[13px] text-ink-secondary">{lead}</p>}
      </div>
      <div className="flex items-center gap-3">
        {right}
        {idx >= 0 && (
          <span className="tnum shrink-0 rounded-md bg-black/[0.04] px-2 py-1 text-[12px] text-ink-secondary">
            {idx + 1} / {NAV_SCREENS.length}
          </span>
        )}
      </div>
    </div>
  );
}

export function PageFooter({
  screen,
  action,
}: {
  screen: Screen;
  action?: React.ReactNode;
}) {
  if (!action) return null;

  return (
    <div className="shrink-0 mt-4 flex items-center justify-end gap-4 pt-4">
      {action}
    </div>
  );
}

/**
 * 화면 여섯 개가 **같은 폭**을 쓴다. 그래야 단계를 넘길 때 제목이 안 튄다.
 *
 * 🔴 `fullWidth` 옵션이 있었고 화면 4(위치 선정)·5-B(다자간 토론) 둘만 그걸 켜고
 *    있었다. 그 둘만 제목이 왼쪽 끝(x≈18)에 붙고 나머지 넷은 가운데 통(x≈417)에
 *    들어가서, 단계를 넘길 때마다 제목·설명이 400px 씩 옮겨 다녔다
 *    (2026-08-15 사용자 지적). 폭을 늘리려면 화면 안쪽에서 늘려야지 통을
 *    바꾸면 안 된다 — 통은 여섯 화면의 공통 골격이다.
 */
export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pt-7 pb-10 h-full flex flex-col min-h-0 overflow-y-auto">
      {children}
    </div>
  );
}

/** 산출물 출처 각주. 명세가 모든 화면 하단에 요구한다. */
export function SourceNote({ files }: { files: string[] }) {
  return (
    <div className="shrink-0 bg-white pt-3 pb-2 border-t border-hairline mt-4">
      <p className="text-[11px] text-ink-secondary/80">
        읽는 산출물 · {files.join("  ·  ")}
      </p>
    </div>
  );
}
