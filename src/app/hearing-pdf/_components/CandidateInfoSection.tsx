import React from "react";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface CandidateInfoSectionProps {
  candidateJibun: string;
  candidateAddress?: string;
  facilityType: string;
  lat: number;
  lng: number;
  intensityLevel: string;
}

export function CandidateInfoSection({
  candidateJibun,
  candidateAddress = "서울특별시 용산구 이태원동 123-4 (좌표 기반 주소)",
  facilityType,
  lat,
  lng,
  intensityLevel
}: CandidateInfoSectionProps) {
  const displayAddress = candidateAddress || candidateJibun;
  const kakaoMapUrl = `https://map.kakao.com/link/map/${encodeURIComponent(displayAddress)},${lat},${lng}`;
  const naverMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(displayAddress)}`;

  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2 border-l-4 border-blue-600 pl-3">
        <MapPin size={16} className="text-blue-600" />
        가. 후보지 위치 및 기본 정보
      </h2>
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* 1. 후보지 명칭 & 시설 정보 */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-slate-400 text-xs block mb-1">1) 후보지 명칭 / 시설</span>
            <div className="text-slate-900 text-sm font-bold">{candidateJibun}</div>
            <div className="text-xs text-slate-500 mt-1">유형: <span className="font-semibold text-slate-700">{facilityType}</span> (수요: {intensityLevel})</div>
          </div>

          {/* 2. x, y 좌표 (위경도) */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-slate-400 text-xs block mb-1">2) x, y 좌표 (위경도)</span>
            <div className="font-mono text-sm text-blue-700 font-bold">
              Lat: {lat.toFixed(6)}
            </div>
            <div className="font-mono text-sm text-blue-700 font-bold">
              Lng: {lng.toFixed(6)}
            </div>
          </div>

          {/* 3. x, y 좌표 변환 주소 */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-slate-400 text-xs block mb-1">3) x, y 좌표 변환 주소</span>
            <div className="text-sm font-semibold text-slate-800 leading-tight">
              {displayAddress}
            </div>
          </div>
        </div>

        {/* 4. 지도 QR코드 (카카오지도 & 네이버지도) */}
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <Navigation size={14} className="text-emerald-600" />
            모바일 지도 핀 연결 QR코드 (카카오지도 & 네이버지도)
          </div>
          <div className="flex flex-wrap items-center justify-around gap-6 pt-1">
            {/* 카카오지도 QR코드 */}
            <div className="flex items-center gap-3 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/80">
              <div className="bg-white p-1.5 rounded-md border border-amber-200 shadow-2xs">
                <QRCodeSVG value={kakaoMapUrl} size={76} level="M" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  카카오지도 QR
                  <a href={kakaoMapUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-800 print:hidden">
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-[11px] text-amber-700/90 mt-0.5 max-w-[120px] leading-tight">
                  스캔 시 카카오지도 위치 핀 연결
                </p>
              </div>
            </div>

            {/* 네이버지도 QR코드 */}
            <div className="flex items-center gap-3 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200/80">
              <div className="bg-white p-1.5 rounded-md border border-emerald-200 shadow-2xs">
                <QRCodeSVG value={naverMapUrl} size={76} level="M" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                  네이버지도 QR
                  <a href={naverMapUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-800 print:hidden">
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-[11px] text-emerald-700/90 mt-0.5 max-w-[120px] leading-tight">
                  스캔 시 네이버지도 위치 핀 연결
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
