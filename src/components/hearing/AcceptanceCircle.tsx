import React from "react";

interface AcceptanceCircleProps {
  /**
   * 🔴 `null` 은 **아직 값이 없다**는 뜻이고 `0` 은 **아무도 수용하지 않는다**는 뜻이다.
   *    둘을 섞으면 화면이 없는 값을 최악의 값으로 지어낸다(원칙 4).
   *    엔진이 첫 패킷을 주기 전엔 `null` 이 온다.
   */
  score: number | null;
  label: string;
  color: string;
}

export function AcceptanceCircle({ score, label, color }: AcceptanceCircleProps) {
  const pending = score === null;
  // 0~100 사이로 값 제한
  const safeScore = pending ? 0 : Math.min(Math.max(score, 0), 100);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // 채워지는 영역 계산. 값이 없으면 트랙을 아예 안 채운다(=배경만 보인다).
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
          {pending ? (
            <span className="text-[14px] font-medium text-gray-400">— 대기 중</span>
          ) : (
            <span className="tnum text-[32px] font-bold text-ink">
              {Math.round(safeScore)}<span className="text-[20px]">%</span>
            </span>
          )}
        </div>
      </div>
      <span className="mt-3 text-[14px] font-medium text-ink">
        {label}
      </span>
    </div>
  );
}
