"use client";

/**
 * 화면 5 공통 — 「토론할 위치」 배선.
 * ==================================
 * 화면 5 는 토론 방식이 둘이다(A 대립 `/hearing` · B 다인 `/dynamic-hearing`).
 * **입력은 같다** — 화면 4 에서 사람이 고른 그 점이다. 그 배선이 화면마다 따로
 * 있으면 한쪽만 고쳐지고, 그때 나는 사고는 「안 터지고 값만 다른 땅」이다
 * (백엔드 함정표의 `dummy/gam4_spatial_ops.py` 와 같은 종류다 — import 는
 * 멀쩡하고 값만 다르다). 그래서 규칙을 여기 한 곳에 둔다.
 *
 * 여기 담긴 규칙은 넷이다. 셋은 화면 5 A 가 이미 지키던 것이고 하나는 그 이유다.
 *
 *  1. **도메인 기본값을 두지 않는다.** `run` 이 없으면 후보를 아예 안 부른다 —
 *     `흡연` 을 기본값으로 넣으면 성동구 run 을 보는 화면이 용산 후보로 토론한다.
 *  2. **`run_id` 는 `run.loaded.run_id` 를 그대로 넘긴다.** 「mode 가 full 이면
 *     run_id 와 같다」를 프런트가 다시 계산하지 않는다 — 어디에 적재했는지는
 *     적재한 쪽만 안다.
 *  3. **조인 키는 `pnu` 다.** 화면 4 는 run 산출물(`topN.csv`)을, 화면 5 는 DB
 *     적재분을 읽는다. 두 출처가 같은 실행이 아닐 수 있어 `rank` 로 이으면
 *     **말없이 다른 필지**가 들어간다.
 *  4. **못 이으면 되짚지 않는다.** `selected` 를 `null` 로 두고 화면이 사유를
 *     띄우고 멈춘다. 이 훅은 폴백을 하나도 갖고 있지 않다(원칙 1·4).
 *
 * ✅ 2026-08-11 — **A(`/hearing`)도 이 훅을 쓴다.** 그전까지는 같은 규칙이 A 파일
 *    안에 인라인으로 한 벌 더 있었다(분기 UI 를 넣던 커밋에서는 일부러 안 옮겼다 —
 *    진입 경로 변경과 배선 교체를 한 커밋에 섞으면 토론이 안 돌 때 어느 쪽 탓인지
 *    못 가른다). 이제 **규칙을 고칠 곳은 이 파일 하나**다.
 */
import { useCallback, useEffect, useState } from "react";
import { useRun } from "./RunProvider";
import { ApiError, NetworkError } from "./client";
import { readSitePick, type SitePick } from "./sitePick";
import { fetchCandidates, type Candidate } from "./simulation";

/** 화면에 띄울 실패. `code` 는 분류, `detail` 은 서버 문구 **원문**이다. */
export interface Failure {
  code: string;
  detail: string;
}

export interface SelectedSite {
  /** `run` 이 없으면 `null`. 기본값을 만들지 않는다. */
  domain: string | null;
  /** `/candidates` 에 넘긴 run_id. `null` = 안 넘김(= 서버가 최근 적재분을 준다). */
  loadedRunId: string | null;
  /** 아직 안 불렀거나 실패했으면 `null`. 빈 배열과 다르다. */
  candidates: Candidate[] | null;
  loading: boolean;
  failure: Failure | null;
  /** `undefined` = 아직 안 읽음 · `null` = 고른 적 없음. 섞으면 안내가 한 번 깜빡인다. */
  pick: SitePick | null | undefined;
  /** 화면 4 의 선택을 PNU 로 이은 결과. 못 이으면 `null` 이다. */
  selected: Candidate | null;
  /** 화면 4 를 안 거치고 들어옴. */
  pickMissing: boolean;
  /** 골랐는데 적재 목록에 없음 — 그 사이 STEP4 가 다시 돌았을 수 있다. */
  pickUnmatched: boolean;
  reload: () => void;
}

export function useSelectedSite(): SelectedSite {
  const { run } = useRun();
  const domain = run?.domain ?? null;
  const loadedRunId = run?.loaded?.run_id ?? null;

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<SitePick | null | undefined>(undefined);

  // 🔴 렌더 중에 sessionStorage 를 읽지 않는다 — 서버 프리렌더엔 없어서
  //    초깃값을 그쪽에서 정하면 하이드레이션이 어긋난다.
  useEffect(() => {
    setPick(readSitePick());
  }, []);

  const reload = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    setFailure(null);
    try {
      const list = await fetchCandidates(domain, loadedRunId);
      setCandidates(list.candidates);
    } catch (e) {
      setCandidates(null);
      if (e instanceof ApiError) {
        // 404 는 "적재 안 함" 이다. 서버가 적재 명령까지 문구에 넣어 준다 — 그대로 쓴다.
        setFailure({ code: `HTTP ${e.status}`, detail: e.detail });
      } else if (e instanceof NetworkError) {
        setFailure({ code: "NETWORK", detail: e.message });
      } else {
        setFailure({ code: "UNKNOWN", detail: String(e) });
      }
    } finally {
      setLoading(false);
    }
  }, [domain, loadedRunId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected: Candidate | null =
    pick && candidates ? (candidates.find((c) => c.pnu === pick.pnu) ?? null) : null;

  return {
    domain,
    loadedRunId,
    candidates,
    loading,
    failure,
    pick,
    selected,
    pickMissing: pick === null,
    pickUnmatched: Boolean(pick) && candidates !== null && selected === null,
    reload: () => void reload(),
  };
}
