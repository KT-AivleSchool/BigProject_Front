"use client";

import { useEffect, useState } from "react";
import { fetchDataFiles } from "./upload";

/**
 * 감리(STEP1) 예상 소요시간.
 *
 * 🔴 **「용량에 비례」가 아니다** — 실측이 그걸 반증한다(2026-08-13, 전 run 의
 *    `runs/<run_id>/status.json` 에서 `steps[id=1].sec` 전수. ⚠ 여기 경로를 글로브
 *    (별표)로 적으면 블록 주석이 그 자리에서 **닫힌다** — 실제로 밟았다):
 *
 *      흡연    데이터셋 11개 · 562.0 MB → 223.5 / 227.4 / 228.1 / 234.3 / 237.2 /
 *                                        237.8 / 238.6 / 238.9 초  (1개당 ~21.0초)
 *      재활용  데이터셋  9개 ·   3.8 MB →  56.6 /  57.0 /  57.3 /  57.9 /  58.8 초
 *                                                                (1개당 ~6.4초)
 *
 *    용량은 148배인데 시간은 4배다. 개수도 1.22배뿐이라 단독으로는 못 맞춘다.
 *    감리는 **데이터셋마다 LLM 을 한 번씩** 부르고(CLAUDE.md 「조례」 절), 그 한 번의
 *    비용이 파일이 클수록 완만히 는다(프로파일 표본·컬럼 수가 는다). 그래서
 *
 *        1개당 초 ≒ A + B · log10(평균 파일 MB)
 *
 *    로 두 앵커를 지난다: A=9.0, B=7.0 (흡연 평균 51.1MB → 20.9초 · 재활용 0.42MB → 6.4초).
 *
 * 🔴 **이건 개략치다.** 앵커가 둘뿐이라 그 사이를 잇는 선이지 법칙이 아니고, LLM
 *    응답 시간은 같은 입력에도 223~344초로 흔들렸다(최댓값은 재시도가 낀 run 이다).
 *    그래서 화면에는 **「예상」이라고 적고 근거(데이터셋 수·용량)를 같이 보여준다** —
 *    숫자만 띄우면 그게 약속으로 읽힌다(원칙 4).
 */
const PER_DATASET_BASE = 9.0; // 평균 1MB 짜리 데이터셋 1개당 초
const PER_DATASET_LOG = 7.0; // 평균 크기가 10배가 될 때마다 더해지는 초
const PER_DATASET_MIN = 5;
const PER_DATASET_MAX = 40;

export interface AuditEta {
  /** 예상 초. 근거를 못 얻었으면 `null` — 0 으로 채우지 않는다. */
  seconds: number | null;
  datasetCount: number | null;
  totalBytes: number | null;
  /** 못 구한 이유. 화면이 지어내지 않게 그대로 쓴다. */
  reason: string | null;
}

/** 아직 못 구한 상태. 한 벌만 두어 매 렌더 새 객체가 나가지 않게 한다. */
const EMPTY: AuditEta = { seconds: null, datasetCount: null, totalBytes: null, reason: null };

export function estimateAuditSeconds(datasetCount: number, totalBytes: number): number | null {
  if (datasetCount <= 0 || totalBytes <= 0) return null;
  const meanMB = totalBytes / datasetCount / 1e6;
  const per = Math.min(
    PER_DATASET_MAX,
    Math.max(PER_DATASET_MIN, PER_DATASET_BASE + PER_DATASET_LOG * Math.log10(meanMB)),
  );
  return Math.round(datasetCount * per);
}

/**
 * `domain` 의 `data/` 를 한 번 훑어 예상시간을 만든다.
 *
 * 도메인이 없으면(= run 을 아직 안 골랐다) 아무것도 안 부른다. 실패는 삼키지 않고
 * `reason` 으로 돌려준다 — 화면은 그때 숫자 대신 그 사유를 말할 수 있다.
 *
 * 🔴 **값을 `domain` 과 **함께** 들고, 돌려줄 때 대조한다**(2026-08-14). 예전엔
 *    `AuditEta` 만 들고 있다가 도메인이 바뀌면 `useEffect` 안에서 비웠는데, 그
 *    방식은 **두 가지가 같이 틀린다**:
 *      ① 「비운다」가 `domain` 이 **falsy 가 될 때만** 걸렸다 — 흡연 → 재활용처럼
 *         **다른 도메인으로 바뀌면** 새 응답이 올 때까지 **앞 도메인의 예상시간이
 *         그대로 떠 있다.** 숫자는 멀쩡해 보이는데 다른 도메인 것이다(원칙 4).
 *      ② 그 비우기가 곧 eslint `react-hooks/set-state-in-effect` 였다.
 *    「effect 에서 되돌리기」가 아니라 **유도하기**로 바꾸면 둘 다 사라진다 —
 *    `got.domain !== domain` 이면 그 값은 **이 도메인의 답이 아니므로** 안 쓴다.
 *    (같은 판단이 `useSelectedSite.ts` 에도 적혀 있다.)
 */
export function useAuditEta(domain: string | undefined | null): AuditEta {
  const [got, setGot] = useState<{ domain: string; eta: AuditEta } | null>(null);

  useEffect(() => {
    if (!domain) return;
    let cancelled = false;
    fetchDataFiles(domain)
      .then((res) => {
        if (cancelled) return;
        const files = res.files.filter((f) => f.is_dataset);
        const bytes = files.reduce((s, f) => s + (f.size || 0), 0);
        const n = res.dataset_count || files.length;
        setGot({
          domain,
          eta: {
            seconds: estimateAuditSeconds(n, bytes),
            datasetCount: n,
            totalBytes: bytes,
            reason: null,
          },
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setGot({
          domain,
          eta: {
            seconds: null,
            datasetCount: null,
            totalBytes: null,
            reason: e instanceof Error ? e.message : String(e),
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [domain]);

  return got && got.domain === domain ? got.eta : EMPTY;
}
