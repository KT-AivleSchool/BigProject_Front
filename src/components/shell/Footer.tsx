"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PrivacyModal } from "./PrivacyModal";

export function Footer() {
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  return (
    <footer className="bg-[#f8f9fa] border-t border-gray-200 mt-auto">
      <div className="mx-auto max-w-[1600px] px-5 py-3">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* 좌측: 로고 및 기관 정보 */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-gray-800 tracking-tight">OmniSite</span>
              <span className="text-[11px] text-gray-500 font-medium">B2G 공간의사결정지원</span>
            </div>
            
            <div className="hidden lg:flex items-center gap-3 text-[11px] text-gray-400">
              <span>(우) 06232 서울특별시 강남구 테헤란로 212</span>
              <span className="text-gray-300">|</span>
              <span>대표전화: 02-1234-5678</span>
            </div>
          </div>

          {/* 우측: 유틸리티 링크 및 저작권 */}
          <div className="flex items-center gap-4">
            <div className="flex flex-wrap gap-3 text-[11px] font-medium text-gray-500">
              <Link href="#" className="hover:text-primary transition-colors">이용안내</Link>
              <button 
                onClick={() => setIsPrivacyModalOpen(true)}
                className="text-gray-700 font-bold hover:text-primary transition-colors"
              >
                개인정보처리방침
              </button>
              <Link href="#" className="hover:text-primary transition-colors">저작권정책</Link>
            </div>
            
            <span className="hidden sm:inline text-gray-300">|</span>
            <p className="hidden sm:block text-[10px] text-gray-400">
              © Republic of Korea.
            </p>
          </div>

        </div>
      </div>

      <PrivacyModal 
        isOpen={isPrivacyModalOpen} 
        onClose={() => setIsPrivacyModalOpen(false)} 
      />
    </footer>
  );
}
