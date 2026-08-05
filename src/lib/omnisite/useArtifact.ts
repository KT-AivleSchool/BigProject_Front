"use client";

/**
 * 산출물 로딩 훅.
 *
 * run 하나에 대해 같은 산출물을 두 번 받지 않는다 — `score_grid.json` 이
 * 215KB 고, 화면을 오갈 때마다 다시 받으면 지도가 매번 깜빡인다.
 * 캐시 키는 `run_id + 산출물 이름`이다. **run_id 가 다르면 절대 재사용하지
 * 않는다** — 다른 실행의 값을 보여주는 것이 이 화면에서 제일 나쁜 사고다.
 */
import { useEffect, useState } from "react";
import { useRun } from "./RunProvider";
import type { ArtifactName, RunDoc } from "./types";

const cache = new Map<string, Promise<unknown>>();

export interface ArtifactState<T> {
  data: T | null;
  loading: boolean;
  /** 실패 사유 원문. 화면이 그대로 보여준다 — 요약하지 않는다. */
  error: string | null;
  /** run 이 아직 없거나 이 산출물이 안 만들어진 상태. */
  unavailable: boolean;
}

/** 상태가 **어느 run 의 어느 산출물**에 대한 것인지 같이 들고 다닌다. 아래 설명 참고. */
interface Keyed<T> extends ArtifactState<T> {
  key: string | null;
}

export function useArtifact<T>(
  name: ArtifactName,
  loader: (run: RunDoc) => Promise<T>,
): ArtifactState<T> {
  const { run } = useRun();
  const [state, setState] = useState<Keyed<T>>({
    key: null,
    data: null,
    loading: false,
    error: null,
    unavailable: true,
  });

  const url = run?.artifacts[name] ?? null;
  const key = run && url ? `${run.run_id}::${name}` : null;

  useEffect(() => {
    if (!run || !url || !key) return; // 아래에서 "없음" 을 그대로 돌려준다

    let p = cache.get(key) as Promise<T> | undefined;
    if (!p) {
      p = loader(run);
      cache.set(key, p);
      // 실패한 약속은 캐시에 남기지 않는다. 남기면 재시도가 영원히 막힌다.
      p.catch(() => cache.delete(key));
    }

    let cancelled = false;
    p.then((data) => {
      if (!cancelled)
        setState({ key, data, loading: false, error: null, unavailable: false });
    }).catch((e: unknown) => {
      if (!cancelled)
        setState({
          key,
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
          unavailable: false,
        });
    });
    return () => {
      cancelled = true;
    };
    // loader 는 모듈 최상위 함수라 매 렌더 같은 참조다. 의존성에 넣으면 무한 루프.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, url, key]);

  /**
   * 🔴 "없음" 과 "불러오는 중" 을 **effect 안에서 setState 로** 만들고 있었다.
   *    `react-hooks/set-state-in-effect` 가 잡는데, 규칙 문제만이 아니었다 —
   *    setState 는 렌더가 끝난 뒤에 도착하므로 run 이 바뀐 직후 한 프레임 동안
   *    **직전 run 의 산출물이 화면에 남는다.** 다른 실행의 값을 보여주는 것이
   *    이 앱에서 제일 나쁜 사고다(파일 머리말 참고).
   *
   *    그래서 두 상태를 상태로 두지 않고 **렌더 중에 계산**한다. `state.key` 가
   *    지금 보고 있는 run·산출물과 다르면 그건 남의 값이므로 절대 내보내지 않는다.
   */
  if (!key) return { data: null, loading: false, error: null, unavailable: true };
  if (state.key !== key)
    return { data: null, loading: true, error: null, unavailable: false };
  return state;
}
