"use client";

/**
 * 산출물 하나를 화면에 걸 때의 상태 분기를 한 곳에 모은다.
 *
 * 화면마다 같은 분기를 다시 쓰면 어느 화면 하나는 반드시 빠뜨린다. 그리고
 * 빠뜨린 화면은 조용히 빈 표를 보여준다 — 이 프로젝트에서 제일 나쁜 결과다.
 */
import { useRun } from "@/lib/omnisite/RunProvider";
import type { ArtifactState } from "@/lib/omnisite/useArtifact";
import { Failed, LoadError, Loading, NoRun, Running } from "./State";

export function ArtifactView<T>({
  state,
  what,
  runningFallback,
  children,
}: {
  state: ArtifactState<T>;
  /** 로딩 문구에 쓸 이름. 예: "감리 결과" */
  what: string;
  /**
   * 「아직 그 단계가 안 끝났다」일 때 기본 `Running` 박스 대신 그릴 것.
   *
   * 🔴 분기를 화면으로 되돌리는 게 **아니다.** 판정(언제가 대기 상태인가)은
   *    여전히 여기 한 곳이고, 화면은 그 자리에 무엇을 그릴지만 준다. 화면마다
   *    `state.unavailable` 을 다시 계산하기 시작하면 이 파일이 있는 이유가 없어진다.
   *
   * 이 구멍을 낸 이유: 감리(`full` 모드)는 몇 분씩 걸리는데 정지 화면 한 장만
   * 두면 멈춘 건지 도는 건지 구분이 안 된다. 대기 시간이 사람의 인내를 넘는
   * 화면만 자기 대기 화면을 가진다 — 안 주면 기본값 그대로다.
   */
  runningFallback?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  const { run } = useRun();

  if (!run) return <NoRun />;
  if (run.status === "failed") return <Failed message={run.error} />;
  if (state.error) return <LoadError message={state.error} />;
  if (state.unavailable) return <>{runningFallback ?? <Running status={run.status} />}</>;
  if (state.loading || !state.data) return <Loading what={what} />;
  return <>{children(state.data)}</>;
}

/** 산출물 두 개가 다 있어야 그릴 수 있는 화면용. */
export function ArtifactView2<A, B>({
  a,
  b,
  what,
  children,
}: {
  a: ArtifactState<A>;
  b: ArtifactState<B>;
  what: string;
  children: (a: A, b: B) => React.ReactNode;
}) {
  const { run } = useRun();

  if (!run) return <NoRun />;
  if (run.status === "failed") return <Failed message={run.error} />;
  const err = a.error ?? b.error;
  if (err) return <LoadError message={err} />;
  if (a.unavailable || b.unavailable) return <Running status={run.status} />;
  if (a.loading || b.loading || !a.data || !b.data) return <Loading what={what} />;
  return <>{children(a.data, b.data)}</>;
}
