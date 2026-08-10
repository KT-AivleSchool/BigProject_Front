import type { Metadata } from "next";
import "./globals.css";
import { RunProvider } from "@/lib/omnisite/RunProvider";
import { Header } from "@/components/shell/Header";
import { Footer } from "@/components/shell/Footer";

import { ProgressSidebar } from "@/components/shell/ProgressSidebar";

export const metadata: Metadata = {
  title: "OmniSite — 갈등시설 입지 선정",
  description: "B2G 공간의사결정지원(SDSS). GIS 최적화 + 공청회 시뮬레이션.",
};

/**
 * 웹폰트를 안 쓴다.
 * `next/font/google` 은 빌드 시 구글에 나간다. 이 프로젝트는 폐쇄망 납품이
 * 전제(B2G)라, 개발 중에만 되는 의존성을 처음부터 넣지 않는다. 한글 본문은
 * OS 기본 산세리프가 가장 잘 읽힌다.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full flex flex-col overflow-hidden">
        <RunProvider>
          <Header />
          <div className="flex flex-1 relative min-h-0">
            <main className="flex-1 flex flex-col min-w-0 min-h-0">
              {children}
            </main>
            <ProgressSidebar />
          </div>
          <Footer />
        </RunProvider>
      </body>
    </html>
  );
}
