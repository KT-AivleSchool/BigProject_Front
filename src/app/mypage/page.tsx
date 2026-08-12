"use client";

import React, { useEffect, useState } from "react";
import { getAuthUser, UserResponse } from "@/lib/omnisite/auth";
import { useRouter } from "next/navigation";
import { useRun } from "@/lib/omnisite/RunProvider";
import Link from "next/link";
import { datetime } from "@/lib/omnisite/format";
import { ApiError, NetworkError, apiErrorCode } from "@/lib/omnisite/client";

/**
 * 실패 문구. 화면 5(`hearings.ts`)와 같은 모양이다 —
 * 문장은 서버 `detail`, 코드는 「어느 갈래였는지」로 괄호에 덧붙이기만 한다.
 * `ApiError.message` 를 그대로 쓰지 않는 이유: 거기엔 요청 URL 이 들어 있다.
 */
function describeFailure(e: unknown): string {
  if (e instanceof ApiError) {
    const code = apiErrorCode(e);
    return `HTTP ${e.status}${code ? ` [${code}]` : ""} — ${e.detail}`;
  }
  if (e instanceof NetworkError) return e.message;
  return e instanceof Error ? e.message : String(e);
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
      setUser(u);
    }
  }, [router]);

  if (!user) return <div className="p-10 text-center text-gray-500">로딩 중...</div>;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-shadow hover:shadow-md">
        <div className="py-10 px-10 min-h-[400px] flex flex-col items-center justify-start">
          <RunList />
        </div>
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

  const fetchData = () => {
    setLoading(true);
    setError(null);
    import('@/lib/omnisite/pipeline').then(({ fetchRuns }) => {
      fetchRuns(true)
        .then((res) => {
          setRuns(res.runs);
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
    fetchData();
  }, []);

  if (loading) {
    return <div className="text-gray-500 w-full text-center">불러오는 중...</div>;
  }

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

  if (runs.length === 0) {
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

  const myRuns = runs.filter((r) => r.is_mine);
  const unassignedRuns = runs.filter((r) => !r.is_mine);

  const handleOpenRun = async (runId: string) => {
    await loadHistoricalRun(runId);
    router.push("/report");
  };

  return (
    <div className="w-full text-left space-y-10">
      <HeaderSection onRefresh={fetchData} />
      {myRuns.length > 0 && (
        <div>
          <h3 className="text-md font-semibold text-gray-700 mb-4">내 분석 내역</h3>
          <div className="space-y-4">
            {myRuns.map((r) => (
              <RunCard key={r.run_id} run={r} onClick={() => handleOpenRun(r.run_id)} />
            ))}
          </div>
        </div>
      )}

      {/*
        🔴 「주인 미상(이관 전)」이라고 적었던 자리다(2026-08-12 정정).
           **「이관 전」은 사실이 아니다.** 로그인 없이 실행할 수 있는 건 미구현이
           아니라 의도된 정상 상태이고, 로그인 전에 시작한 run 을 나중에 그 계정
           것으로 만드는 경로는 **만들지 않기로 결정돼 있다**(만들면 「누구 run
           이었나」의 정본이 둘이 된다). 옛 문구는 로그인하면 이 목록이 옮겨온다고
           약속하는데 그런 일은 안 일어난다.
      */}
      {unassignedRuns.length > 0 && (
        <div>
          <h3 className="text-md font-semibold text-gray-700 mb-4">로그인 없이 실행된 분석 내역</h3>
          <div className="space-y-4">
            {unassignedRuns.map((r) => (
              <RunCard key={r.run_id} run={r} onClick={() => handleOpenRun(r.run_id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RunCard({ run, onClick }: { run: import('@/lib/omnisite/pipeline').RunMeta, onClick: () => void }) {
  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between hover:border-primary/50 transition-colors gap-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            {run.domain}
          </span>
          <span className="text-xs font-medium text-gray-500">
            일시: {run.started_at ? datetime(run.started_at) : "알 수 없음"}
          </span>
        </div>
        <h3 className="text-lg font-bold text-gray-800">
          {run.domain} 입지 분석
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          상태: <span className={run.status === 'succeeded' ? 'text-green-600 font-semibold' : run.status === 'failed' ? 'text-red-600 font-semibold' : 'text-yellow-600 font-semibold'}>{run.status}</span>
        </p>
      </div>

      <button 
        onClick={onClick}
        className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors font-medium text-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        보고서 보기
      </button>
    </div>
  );
}
