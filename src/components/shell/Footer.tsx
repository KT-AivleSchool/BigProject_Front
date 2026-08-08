"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PrivacyModal } from "./PrivacyModal";

export function Footer() {
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  return (
    <footer className="bg-[#f8f9fa] border-t border-gray-200 mt-auto">
      <div className="mx-auto max-w-[1600px] px-5 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          
          {/* 좌측: 로고 및 기관 정보 */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-bold text-gray-800 tracking-tight">OmniSite</span>
              <span className="text-[13px] text-gray-500 font-medium">B2G 공간의사결정지원</span>
            </div>
            
            <div className="text-[13px] text-gray-500 leading-relaxed">
              <p>(우) 06232 서울특별시 강남구 테헤란로 212</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span>대표전화: 02-1234-5678</span>
                <span className="hidden sm:inline">|</span>
                <span>팩스: 02-123-5679</span>
              </div>
            </div>
          </div>

          {/* 우측: 유틸리티 링크 및 저작권 */}
          <div className="flex flex-col items-start md:items-end gap-4">
            <div className="flex flex-wrap gap-4 text-[13px] font-medium text-gray-600">
              <Link href="#" className="hover:text-primary transition-colors">이용안내</Link>
              <button 
                onClick={() => setIsPrivacyModalOpen(true)}
                className="text-gray-900 font-bold hover:text-primary transition-colors"
              >
                개인정보처리방침
              </button>
              <Link href="#" className="hover:text-primary transition-colors">저작권정책</Link>
              <Link href="#" className="hover:text-primary transition-colors">웹접근성품질인증 마크</Link>
            </div>
            
            <p className="text-[12px] text-gray-400">
              © The Government of the Republic of Korea. All rights reserved.
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
