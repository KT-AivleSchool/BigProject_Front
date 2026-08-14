"use client";

import React, { useEffect, useState } from "react";
import { getAuthUser, UserResponse } from "@/lib/omnisite/auth";
import { useRouter } from "next/navigation";
import { useRun } from "@/lib/omnisite/RunProvider";
import Link from "next/link";
import { datetime } from "@/lib/omnisite/format";
import { describeFailure } from "@/lib/omnisite/client";
import { fetchPosts, PostListItem } from "@/lib/omnisite/posts";
import { PostDetailModal } from "@/components/board/PostDetailModal";

/**
 * 🔴 여기 있던 `describeFailure` 사본을 `client.ts` 로 올렸다 — 마이페이지·화면5
 *    (`hearings.ts`)에 이어 게시판까지 **넷째 사본**이 될 자리였다. 모양이 갈리면
 *    같은 실패가 화면마다 다르게 읽힌다.
 */

function maskName(name: string): string {
  if (!name) return "";
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  const first = name.substring(0, 1);
  const last = name.substring(name.length - 1);
  const masked = "*".repeat(name.length - 2);
  return first + masked + last;
}

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const parts = email.split("@");
  const id = parts[0] || "";
  const domain = parts[1] || "";
  if (id.length <= 2) return id[0] + "*@" + domain;
  const visible = id.slice(0, Math.ceil(id.length / 2));
  const masked = "*".repeat(id.length - visible.length);
  return visible + masked + "@" + domain;
}

export default function MyPage() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const router = useRouter();
  const { run } = useRun();

  useEffect(() => {
    const u = getAuthUser();
    if (!u) {
      router.push("/");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(u);
    }
  }, [router]);

  if (!user) return <div className="p-10 text-center text-gray-500">로딩 중...</div>;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8 tracking-tight">마이페이지</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8 transition-shadow hover:shadow-md">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800">기본 정보</h2>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">이름</dt>
              <dd className="text-base text-gray-900 font-medium">{maskName(user.username)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">이메일</dt>
              <dd className="text-base text-gray-900 font-medium">{maskEmail(user.email)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">계정 상태</dt>
              <dd className="text-base">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                  {user.is_active ? "활성 계정" : "비활성"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/*
        두 카드를 **가로로 나란히** 둔다(2026-08-12, 사람 지시). 둘 다 한 줄이
        짧아서 세로로 쌓으면 오른쪽이 통째로 비고 목록은 화면 밖으로 밀린다.

        ⚠ `items-start` 가 있어야 한다 — 없으면 grid 가 두 칸의 높이를 맞추려고
          짧은 카드를 늘려, 게시글 3건짜리 카드 아래에 빈 흰 판이 붙는다.
        ⚠ 쌓는 기준을 `lg`(1024px)로 잡았다. `md`(768px)에서 두 칸이면 한 칸이
          384px 라 `RunCard` 의 [날짜 · 도메인 · 상태 + 버튼] 한 줄이 뭉개진다.
      */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        {/* 파이프라인 분석 내역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-shadow hover:shadow-md">
          <div className="px-6 py-8 min-h-[420px]">
            <RunList />
          </div>
        </div>

        {/* 내가 작성한 안건 카드 (최근 5개 요약 + 우상단 모두보기 버튼) */}
        <MyPostList />
      </div>
    </div>
  );
}



/**
 * 🔴 `RunList` **밖**에 둔다. 안에 두면 렌더마다 새 컴포넌트 타입이 만들어져
 *    React 가 매번 언마운트→마운트한다(eslint `Cannot create components during
 *    render`). 실패 화면을 추가하며 이 자리가 셋이 됐다.
 */
function HeaderSection({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="w-full mb-8 flex justify-between items-center border-b border-gray-100 pb-4">
      <h2 className="text-xl font-bold text-gray-800">분석 내역</h2>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        새로고침
      </button>
    </div>
  );
}

function RunList() {
  const { loadHistoricalRun } = useRun();
  const router = useRouter();
  const [runs, setRuns] = useState<import('@/lib/omnisite/pipeline').RunMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 「다시보기」를 누른 run. 두 번 눌러 두 run 을 동시에 불러오지 않게 막는다. */
  const [opening, setOpening] = useState<string | null>(null);
  /** 그 run 을 못 연 사유. 목록이 아니라 **그 줄**에 붙는다. */
  const [openError, setOpenError] = useState<{ runId: string; message: string } | null>(null);
  /** 서버가 아는 전체 건수. 목록이 잘렸는지 판단하는 근거다. `null` = 서버가 안 줬다. */
  const [total, setTotal] = useState<number | null>(null);
  /** 서버가 잘랐다고 **말한** 값. 위 `total` 과 따로 본다 — 아래 주석 참조. */
  const [truncated, setTruncated] = useState(false);
  /** 보고 있는 쪽(1부터). 목록이 화면을 넘기지 않게 자른다. */
  const [page, setPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    // 목록이 바뀌면 1쪽으로 돌아간다 — 3쪽을 보다 새로고침해서 2쪽이 되면
    // 빈 쪽이 뜬다(아래 clamp 가 막긴 하지만, 보던 자리도 이미 남의 자리다).
    setPage(1);
    import('@/lib/omnisite/pipeline').then(({ fetchRuns }) => {
      fetchRuns(true)
        .then((res) => {
          setRuns(res.runs);
          setTotal(typeof res.total === "number" ? res.total : null);
          setTruncated(res.truncated === true);
          setLoading(false);
        })
        .catch((e) => {
          // 🔴 **삼키지 않는다.** 여기서 `console.error` 만 하고 빈 목록을 그리면
          //    「내 내역이 없다」로 읽히는데 실제로는 **「못 물어봤다」**다(원칙 4).
          //    404(엔드포인트 미구현) · 401(토큰 만료) · 500 이 전부 같은 빈 화면이 된다.
          //    문구는 서버 것을 그대로 쓴다 — 우리가 만들면 사유를 지어내게 된다.
          setError(describeFailure(e));
          setLoading(false);
        });
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  if (loading) {
    return <div className="text-gray-500 w-full text-center">불러오는 중...</div>;
  }

  /**
   * 🔴 **잘렸으면 잘렸다고 적는다**(계약 §3-3, 2026-08-12 백엔드 결정 ⓑ+가시화).
   *    서버가 `?limit=`(기본 100)로 자르는데 화면이 아무 말도 안 하면 사용자는
   *    **옛 run 이 지워진 줄 안다** — 실제로는 안 물어봤을 뿐이다(절대원칙 4).
   *
   * 🔴 서버의 `truncated` **하나만 믿지 않는다.** `total > runs.length` 는 화면이
   *    직접 관측할 수 있는 사실이고, 플래그는 서버가 계산한 주장이다. 둘 중
   *    하나라도 참이면 적는다 — 플래그 쪽이 틀렸을 때 조용히 안 적는 것이 바로
   *    이 조치가 막으려던 상황이다.
   * ⚠ N 은 `total` 에서 뺀 값이 아니라 **지금 화면에 있는 수**(`runs.length`)다.
   *   `limit` 을 쓰면 서버가 상한보다 적게 줬을 때 없는 줄을 있다고 말한다.
   */
  const missing = total !== null ? total - runs.length : 0;
  const truncNotice =
    truncated || missing > 0 ? (
      <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        최근 <strong>{runs.length}</strong>건만 보입니다
        {total !== null && <> (전체 <strong>{total}</strong>건)</>}. 나머지는 이 화면에서
        볼 수 없습니다 — 지워진 것이 아니라 <strong>불러오지 않은</strong> 것입니다.
      </p>
    ) : null;

  /**
   * 🔴 **내 것만 보여준다**(2026-08-12, 사람 지시). 서버 `mine=true` 는 계약대로
   *    **내 것 + 익명**을 준다 — 거르는 자리는 여기다.
   *
   * 🔴 **거른 수를 적는다.** 익명 run 을 말없이 숨기면 「전체 12건」이라는 위 안내와
   *    화면의 3줄이 안 맞아, 9건이 사라진 것처럼 보인다(절대원칙 4). 「이관 전」이
   *    아니다 — 로그인 없이 실행할 수 있는 건 의도된 정상 상태이고, 나중에 그 계정
   *    것으로 옮겨주는 경로는 **만들지 않기로 결정돼 있다.**
   * ⚠ 위 `truncNotice` 는 거르기 **전** 수(`runs.length`)로 센다. 거른 뒤로 바꾸면
   *   익명이 섞인 응답마다 「잘렸다」고 거짓말한다.
   */
  const myRuns = runs.filter((r) => r.is_mine);
  const hiddenAnon = runs.length - myRuns.length;
  const anonNotice =
    hiddenAnon > 0 ? (
      <p className="mt-3 text-xs text-gray-400">
        로그인 없이 실행된 <strong>{hiddenAnon}</strong>건은 표시하지 않습니다. 지워진 것이
        아니라 <strong>주인이 없는</strong> 기록입니다.
      </p>
    ) : null;

  // 🔴 **빈 목록보다 먼저 본다.** 실패했으면 목록은 `[]` 인데, 그 `[]` 는
  //    「없다」가 아니라 「모른다」다. 순서를 바꾸면 "아직 실행한 내역이 없습니다"
  //    가 뜨고 사용자는 자기 기록이 지워진 줄 안다.
  if (error !== null) {
    return (
      <div className="w-full">
        <HeaderSection onRefresh={fetchData} />
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-700">분석 내역을 불러오지 못했습니다.</p>
          <p className="mt-1.5 break-all text-sm text-red-600">{error}</p>
          <p className="mt-2 text-xs text-red-500">
            목록이 비어 있는 것이 아니라 <strong>서버에 물어보지 못한</strong> 상태입니다.
            로그인이 만료됐다면 헤더의 ⟳ 로 연장한 뒤 새로고침해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // ⚠ 여기서도 `truncNotice`·`anonNotice` 를 먼저 본다. 0건인데 서버가 「전체 N건」
  //   이라고 하거나 익명 N건을 우리가 감춘 상태면, 그건 「없다」가 아니라 **감췄다**
  //   이고 "없습니다" 라고 적으면 화면이 거짓말을 한다.
  if (myRuns.length === 0 && truncNotice === null && anonNotice === null) {
    return (
      <div className="w-full">
        <HeaderSection onRefresh={fetchData} />
        <div className="text-center flex flex-col items-center justify-center mt-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 border border-gray-100 mb-6 text-gray-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <p className="text-gray-600 font-medium text-lg">아직 실행한 분석 내역이 없습니다.</p>
          <p className="text-sm text-gray-400 mt-2">OmniSite 데이터 분석 파이프라인을 실행하면 이곳에 진행 내역이 기록됩니다.</p>
        </div>
      </div>
    );
  }

  /**
   * 쪽 나누기 — 목록이 옆 카드(「내가 작성한 안건」)보다 길어지지 않게 자른다.
   *
   * ⚠ `page` 를 `useEffect` 로 되맞추지 않고 **계산으로 가둔다**(clamp). 효과로
   *   `setPage` 하면 한 번 더 그려지는 사이에 **빈 쪽**이 스쳐 지나가고, 이 저장소의
   *   `react-hooks/set-state-in-effect` 규칙에도 걸린다.
   * ⚠ 목록이 줄어 지금 쪽이 사라져도(새로고침 후 3쪽→2쪽) 마지막 쪽을 보여준다.
   */
  const PAGE_SIZE = 5;
  const pageCount = Math.max(1, Math.ceil(myRuns.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const pageRuns = myRuns.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // 쪽 번호는 최대 5개만 — 100건이면 20쪽이라 다 그리면 페이저가 카드보다 넓어진다.
  const winStart = Math.max(1, Math.min(safePage - 2, pageCount - 4));
  const pageNums = Array.from(
    { length: Math.min(5, pageCount) },
    (_, i) => winStart + i,
  );

  /**
   * 🔴 **못 열면 이동하지 않는다.** 예전엔 결과를 안 보고 `/report` 로 넘겼다 —
   *    그러면 서버에서 사라진 run(폴더가 정리됐거나 404)을 눌러도 화면이 넘어가고,
   *    거기 그려지는 건 **직전에 보던 run** 이다. 다른 실행의 숫자를 이 실행의
   *    것으로 읽게 된다(원칙 4).
   * 🔴 사유는 목록 전체가 아니라 **누른 줄 옆**에 붙인다. 줄이 여럿이라 한 곳에
   *    모아 띄우면 어느 run 얘기인지가 사라진다.
   */
  const handleOpenRun = async (runId: string) => {
    setOpening(runId);
    setOpenError(null);
    try {
      await loadHistoricalRun(runId);
      router.push("/report");
    } catch (e) {
      setOpenError({ runId, message: describeFailure(e) });
    } finally {
      setOpening(null);
    }
  };

  const cardProps = (r: import('@/lib/omnisite/pipeline').RunMeta) => ({
    run: r,
    busy: opening === r.run_id,
    failure: openError?.runId === r.run_id ? openError.message : null,
    onOpen: () => handleOpenRun(r.run_id),
  });

  return (
    <div className="w-full text-left">
      <HeaderSection onRefresh={fetchData} />
      {truncNotice}

      {myRuns.length === 0 ? (
        // 위 빈 화면 분기를 못 탄 경우 — 응답에 줄은 있는데 **내 것이 없다**.
        // "없습니다" 로 뭉뚱그리면 감춘 익명 건이 지워진 것처럼 읽힌다.
        <p className="mt-6 text-sm text-gray-500">내 이름으로 실행된 분석 내역이 없습니다.</p>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {pageRuns.map((r) => (
              <RunCard key={r.run_id} {...cardProps(r)} />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-xs text-gray-400">
              총 <strong className="text-gray-600">{myRuns.length}</strong>건 · {safePage}/
              {pageCount} 쪽
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                  aria-label="이전 쪽"
                >
                  ‹
                </button>
                {pageNums.map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    aria-current={n === safePage ? "page" : undefined}
                    className={
                      n === safePage
                        ? "min-w-[28px] rounded bg-gray-800 px-2 py-1 text-sm font-semibold text-white"
                        : "min-w-[28px] rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
                    }
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount}
                  className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                  aria-label="다음 쪽"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {anonNotice}
    </div>
  );
}

/**
 * 한 줄 = **[날짜, 도메인] + 「다시보기」** 다(2026-08-12, 사람 지시).
 *
 * 🔴 `{domain} 입지 분석` 같은 제목을 다시 만들지 않는다 — 그건 우리가 지어낸
 *    문장이고, 도메인은 이미 옆에 그대로 있다.
 * ⚠ `status` 는 `run_records.last_known_status` 라 **세 값뿐**이다
 *    (`queued` · `succeeded` · `failed`). `running`·`awaiting_hitl` 은 DB 에
 *    일부러 안 적는다 — 진행 상태의 정본은 `status.json` 이다. 그래서 여기 값은
 *    「지금 어떤가」가 아니라 **「마지막으로 알려진 것」**이고, 작은 글씨로만 둔다.
 */
function RunCard({
  run,
  busy,
  failure,
  onOpen,
}: {
  run: import('@/lib/omnisite/pipeline').RunMeta;
  busy: boolean;
  failure: string | null;
  onOpen: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:border-primary/50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-gray-800 tabular-nums">
            {run.started_at ? datetime(run.started_at) : "날짜 미상"}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 shrink-0">
            {run.domain}
          </span>
          <span
            className={
              "text-xs shrink-0 " +
              (run.status === "succeeded"
                ? "text-green-600"
                : run.status === "failed"
                  ? "text-red-600"
                  : "text-yellow-600")
            }
            title="마지막으로 기록된 상태"
          >
            {run.status}
          </span>
        </div>

        <button
          onClick={onOpen}
          disabled={busy}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          {busy ? "불러오는 중..." : "다시보기"}
        </button>
      </div>

      {/*
        🔴 못 열었으면 **그 자리에** 적는다. 이동은 안 했으므로 사용자는 아직
           목록에 있고, 사유가 없으면 「버튼이 안 눌린다」로 읽는다.
           문구는 서버 것을 그대로 쓴다 — 우리가 만들면 사유를 지어내게 된다.
      */}
      {failure !== null && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-3">
          <p className="text-xs font-semibold text-red-700">이 실행의 기록을 열지 못했습니다.</p>
          <p className="mt-1 break-all text-xs text-red-600">{failure}</p>
          <p className="mt-1.5 text-[11px] text-red-500">
            목록에 남아 있어도 <strong>산출물은 정리(prune)돼 사라질 수 있습니다</strong> —
            실행 기록(DB)과 산출물 파일은 수명이 다릅니다.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 마이페이지 내 작성 게시글 카드 UI (최근 5개 요약 + 우상단 모두보기 버튼)
 */
function MyPostList() {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  /**
   * 🔴 원본은 `.catch(() => {})` 였다. 그러면 401·404·서버 미기동이 전부
   *    **「작성한 게시글이 없습니다」**로 그려진다 — 실패를 없음으로 바꿔 말하는
   *    자리다(원칙 4). 아래 렌더도 **실패를 빈 목록보다 먼저** 본다.
   */
  const [error, setError] = useState<string | null>(null);

  const loadMyPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPosts(1, 5, "created_at", "desc", "title_content", "", true);
      setPosts(data.posts);
      setTotal(data.total);
    } catch (err) {
      setError(describeFailure(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 🔴 누른다(2026-08-14). `react-hooks/set-state-in-effect` 는 `await` 를 경계로
    //    안 보고 「setState 를 부르는 함수를 effect 가 직접 부르는가」만 잡는다 —
    //    첫 줄이 `await` 인 `PostDetailModal.loadDetail` 도 같은 이유로 걸렸다.
    //    마운트 시 조회는 이 규칙이 말하는 「불필요한 effect」가 아니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMyPosts();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-shadow hover:shadow-md">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-1.5">
            <span>📋</span> 내가 작성한 안건
          </h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            {total}건
          </span>
        </div>
        <Link
          href="/posts?mine=true"
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 transition-colors"
        >
          <span>내 작성글 모두 보기</span>
          <span>→</span>
        </Link>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">내 작성글을 불러오는 중입니다...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
            ⚠️ {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            작성한 게시글이 없습니다. 게시판에서 첫 안건을 등록해 보세요!
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => {
                  setSelectedPostId(post.id);
                  setDetailModalOpen(true);
                }}
                className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-slate-50 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  {post.has_file && <span className="text-xs shrink-0" title="첨부파일 있음">📎</span>}
                  <span className="text-xs font-bold text-gray-800 group-hover:text-primary transition-colors truncate">
                    {post.title}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-gray-400 font-medium">
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 group-hover:bg-primary group-hover:text-white transition-colors">
                    상세보기
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PostDetailModal
        postId={selectedPostId}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onDeleted={() => loadMyPosts()}
      />
    </div>
  );
}

