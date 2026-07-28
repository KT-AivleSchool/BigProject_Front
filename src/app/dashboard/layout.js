'use client'

import React from 'react';
import { usePipelineStore } from '@/store/usePipelineStore';

export default function DashboardLayout({ children }) {
  const { currentStep } = usePipelineStore();
  const totalSteps = 6;
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-6">
          <div className="font-bold text-xl mr-6 flex gap-2 items-center text-gray-800">
            <span className="text-2xl">🌍</span> OmniSite
          </div>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <span className="transition-colors hover:text-foreground/80 text-foreground cursor-pointer">Dashboard</span>
            <span className="transition-colors hover:text-foreground/80 text-foreground/60 cursor-pointer">Maps</span>
            <span className="transition-colors hover:text-foreground/80 text-foreground/60 cursor-pointer">Data</span>
            <span className="transition-colors hover:text-foreground/80 text-foreground/60 cursor-pointer">Models</span>
          </nav>
          <div className="ml-auto flex items-center space-x-4">
            <div className="text-sm text-gray-500">Admin. J. Park</div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container px-6 py-8 mx-auto max-w-7xl">
        {/* Wizard Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-700">작업 현황 (단계 {currentStep} / {totalSteps})</h2>
            <span className="text-sm font-medium text-blue-600">{progressPercent}% 완료</span>
          </div>
          <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-in-out" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 px-1">
            <span className={currentStep >= 1 ? 'text-blue-600 font-bold' : ''}>데이터 업로드</span>
            <span className={currentStep >= 2 ? 'text-blue-600 font-bold' : ''}>AI 감리</span>
            <span className={currentStep >= 3 ? 'text-blue-600 font-bold' : ''}>가중치 산출</span>
            <span className={currentStep >= 4 ? 'text-blue-600 font-bold' : ''}>위치 선정</span>
            <span className={currentStep >= 5 ? 'text-blue-600 font-bold' : ''}>갈등 시뮬레이션</span>
            <span className={currentStep >= 6 ? 'text-blue-600 font-bold' : ''}>결과 리포트</span>
          </div>
        </div>

        {/* Dynamic Step Component injected here */}
        {children}
      </main>
    </div>
  );
}
