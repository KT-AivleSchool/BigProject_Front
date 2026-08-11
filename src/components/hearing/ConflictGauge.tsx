import React from "react";

interface ConflictGaugeProps {
  score: number;
  label: string;
  /**
   * 백엔드가 실제로 준 값. `css_pro`/`css_con` 은 **`LOW`/`MEDIUM`/`HIGH` 문자열**이고
   * 숫자가 아니다(`app/core/sim_ai/graph.py:27-28`).
   *
   * 🔴 그래서 `score` 는 **바늘 위치일 뿐 점수가 아니다.** 예전엔 이 자리에
   *    `Math.random()` 으로 만든 두 자리 숫자를 "N 점" 이라고 찍었다 — 서버가 보낸
   *    적 없는 정밀도다(원칙 4). 값을 준 쪽이 등급만 말했으면 화면도 등급만 말한다.
   *    `level` 이 오면 숫자 대신 등급을 쓴다.
   */
  level?: string;
}

/** 등급 → 한국어. 모르는 값은 **그대로 보여준다**(뭉개면 새 등급이 생긴 날 사라진다). */
const LEVEL_KO: Record<string, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
};

export function ConflictGauge({ score, label, level }: ConflictGaugeProps) {
  // 0~100 사이로 값 제한
  const safeScore = Math.min(Math.max(score, 0), 100);
  
  // 바늘의 회전 각도 계산 (0점 = -90도, 100점 = 90도)
  // SVG 중심(100, 100)을 기준으로 회전
  const rotation = (safeScore / 100) * 180 - 90;
  
  // 아크의 길이 (반지름 80인 반원)
  const pathLength = Math.PI * 80;
  const strokeDashoffset = pathLength - (safeScore / 100) * pathLength;

  // 공백이 없는 안전한 ID 생성
  const gradId = `gauge-grad-${label.replace(/\s+/g, '-')}`;

  // 점수에 따른 텍스트 색상
  let scoreColorClass = "text-[#22c55e]"; // 낮음 (초록)
  if (safeScore >= 66) {
    scoreColorClass = "text-[#ef4444]"; // 높음 (빨강)
  } else if (safeScore >= 33) {
    scoreColorClass = "text-[#eab308]"; // 보통 (노랑)
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <h3 className="mb-4 text-[14px] font-semibold text-ink">{label}</h3>
      <div className="relative h-[110px] w-[200px] overflow-hidden">
        <svg
          viewBox="0 0 200 120"
          className="h-full w-full"
          preserveAspectRatio="xMidYMax meet"
        >
          <defs>
            {/* 게이지 그라데이션/색상 정의 (초록 -> 노랑 -> 빨강) */}
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />   {/* 초록 (낮음) */}
              <stop offset="50%" stopColor="#eab308" />  {/* 노랑 (보통) */}
              <stop offset="100%" stopColor="#ef4444" /> {/* 빨강 (높음) */}
            </linearGradient>
          </defs>

          {/* 배경 트랙 */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--hairline, #e5e7eb)"
            strokeWidth="24"
            strokeLinecap="round"
          />

          {/* 컬러 트랙 (단일 그라데이션 라인으로 부드럽게 표현) */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="24"
            strokeLinecap="round"
            strokeDasharray={pathLength}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />

          {/* 라벨 텍스트 */}
          <text x="30" y="115" textAnchor="middle" className="fill-ink-secondary text-[11px] font-medium">
            낮음
          </text>
          <text x="100" y="35" textAnchor="middle" className="fill-ink-secondary text-[11px] font-medium">
            보통
          </text>
          <text x="170" y="115" textAnchor="middle" className="fill-ink-secondary text-[11px] font-medium">
            높음
          </text>

          {/* 바늘 (Needle) */}
          <g
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "100px 100px",
              transition: "transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <circle cx="100" cy="100" r="6" className="fill-ink" />
            <path d="M 96 100 L 100 30 L 104 100 Z" className="fill-ink" />
          </g>
        </svg>
      </div>
      <div className="mt-2 text-center">
        {level ? (
          <>
            <span className={`text-[28px] font-bold ${scoreColorClass}`}>
              {LEVEL_KO[level] ?? level}
            </span>
            <span className="ml-2 align-middle font-mono text-[11px] text-ink-secondary">
              {level}
            </span>
          </>
        ) : (
          <span className="text-[15px] font-medium text-ink-secondary">— 대기 중</span>
        )}
      </div>
    </div>
  );
}
