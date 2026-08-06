import React from "react";

interface AcceptanceCircleProps {
  score: number;
  label: string;
  color: string;
}

export function AcceptanceCircle({ score, label, color }: AcceptanceCircleProps) {
  // 0~100 사이로 값 제한
  const safeScore = Math.min(Math.max(score, 0), 100);
  
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // 채워지는 영역 계산
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex h-[140px] w-[140px] items-center justify-center">
        {/* SVG 원형 차트 */}
        <svg
          className="absolute left-0 top-0 h-full w-full -rotate-90"
          viewBox="0 0 140 140"
        >
          {/* 배경 트랙 (연한 회색) */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth="12"
          />
          {/* 컬러 트랙 (값에 따라 차오름) */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* 중앙 점수 텍스트 */}
        <div className="flex flex-col items-center">
          <span className="tnum text-[32px] font-bold text-ink">
            {Math.round(safeScore)}<span className="text-[20px]">%</span>
          </span>
        </div>
      </div>
      <span className="mt-3 text-[14px] font-medium text-ink">
        {label}
      </span>
    </div>
  );
}
