"use client";

import { useMemo, useState } from "react";
import { Printer, FileDown } from "lucide-react";
import { HearingPipelineData } from "./_components/types";
import { PdfReportHeader } from "./_components/PdfReportHeader";
import { CandidateInfoSection } from "./_components/CandidateInfoSection";
import { ScenarioEvaluationSection } from "./_components/ScenarioEvaluationSection";
import { AhpWeightSection } from "./_components/AhpWeightSection";
import { PdfReportFooter } from "./_components/PdfReportFooter";

/**
 * 🔴 **고정 표본이다. 실행 결과가 아니다.**
 *
 * 이 화면은 아직 조회하는 곳이 없다 — `useState(SAMPLE_PIPELINE_DATA)` 에 setter 가
 * 없어서 **무엇을 하든 항상 이 값이 그려진다.** 그런데 나오는 그림은 결재선·시행번호·
 * 발신명의를 갖춘 공문서고, 「HWPX 한글 다운로드」는 이 값을 그대로 백엔드로 보내
 * **진짜 파일**을 만든다. 표시가 없으면 받은 사람은 실행 결과로 읽는다(원칙 4).
 *
 * 값 자체도 실물이 아니다. `(37.534, 126.994)` "이태원동 123-4" 는 백엔드가
 * 2026-08-10 에 **제거한 테스트용 좌표 폴백**과 같은 점이다 — 그때 이 좌표가
 * 위험했던 이유가 정확히 지금 상황이었다(정상 결과처럼 보이는 완주).
 *
 * 배선은 하지 않았다. 화면 5(토론)의 어느 결과를 화면 6 이 읽을지는 A/B 분기가
 * 정해지고 나야 답이 나오고, 그 분기는 동현님 작업분이다. **비어 있는 것을
 * 지어내지 않고 비었다고 표시한다.**
 */
const SAMPLE_PIPELINE_DATA: HearingPipelineData = {
  candidate_jibun: "후보지 #1 (실제 위치 기반)",
  candidate_address: "서울특별시 용산구 이태원동 123-4",
  candidate_lat: 37.534,
  candidate_lng: 126.994,
  facility_type: "흡연부스",
  intensity_level: "보통",
  ahp_weights: {
    "버스정류장의 승하차 인원 통계로, 흡연부스 설치 수요를 판단하는 데 사용될 수 있다.": 0.12,
    "지하철역 승하차 인원 통계로, 흡연부스 설치 수요를 판단하는 데 사용될 수 있다.": 0.14,
    "이 데이터는 흡연부스 설치 수요를 판단하기 위한 생활인구 통계로 사용됩니다.": 0.12,
    "서울시 지하철역 위치 데이터로, 흡연부스 설치 시 지하철역 출입구로부터 10미터 이내는 금연구역으로 지정되어 설치가 금지됨.": 0.14,
    "이 데이터는 흡연부스 입지에서 버스정류소 위치를 제공하여 유동인구 수요와 금연구역 배제를 동시에 고려해야 한다.": 0.12,
    "이 데이터는 흡연부스 설치 수요를 높이는 가점 요인으로 사용될 수 있는 가로휴지통 위치 데이터이다.": 0.09,
    "담배꽁초 상습 무단투기 지역은 흡연부스 설치 수요를 높이는 지표로 사용될 수 있다.": 0.12,
    "상가 및 상권 정보로, 흡연부스 설치 수요를 파악하는 데 사용될 수 있음.": 0.12
  },
  timestamp: "2026-08-06T17:21:13.783284",
  scenarios: [
    {
      scenario: "C",
      scenario_description: "협상 결렬 / 입지 재검토",
      final_acceptance_score: "0.15",
      reason: "최종 수용도 점수가 0.4 미만으로 협상이 결렬되었음을 나타냄.",
      summary: "후보지 #1에 대한 논의 결과, 지하철역 출입구로부터 10미터 이내는 금연구역으로 지정되어 설치가 금지된다는 명확한 제한이 존재하며, 주변 인프라 부족과 악취 및 소음 문제로 인해 흡연부스 설치에 대한 합의가 이루어지지 않았다. 따라서, 이 후보지에 대한 입지를 재검토할 필요가 있다.",
      conflict_risk_index: 75.0,
      risk_reason: "강한 반대 입장으로 인해 갈등 위험이 높음.",
      used_doc_ids: [1, 2]
    }
  ]
};

export default function HearingPdfReportPage() {
  const [data] = useState<HearingPipelineData>(SAMPLE_PIPELINE_DATA);
  const [isDownloading, setIsDownloading] = useState(false);

  // 날짜 포맷팅
  const formattedDate = useMemo(() => {
    try {
      const date = new Date(data.timestamp);
      return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return data.timestamp;
    }
  }, [data.timestamp]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHwpx = async () => {
    setIsDownloading(true);
    try {
      // 같은 출처로만 부른다 — 백엔드 주소는 `next.config.ts` rewrite 안에만 있다.
      const response = await fetch(`/api/v1/report/download/hwpx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error("한글 문서 생성 실패");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `입지심의보고서_${data.facility_type}.hwpx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("HWPX Download error:", e);
      alert("한글 문서(.hwpx) 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans text-slate-800 print:bg-white print:p-0">
      {/* 툴바 (인쇄 시 숨김) */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h1 className="text-lg font-bold text-slate-900">PDF 및 한글(HWPX) 심의 제출 보고서</h1>
          <p className="text-xs text-slate-500">파이프라인 심의 및 입지 분석 결과 보고서 양식입니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadHwpx}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <FileDown size={16} />
            {isDownloading ? "생성 중..." : "HWPX 한글 다운로드"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Printer size={16} />
            인쇄 및 PDF 다운로드
          </button>
        </div>
      </div>

      {/* A4 컨테이너 */}
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-lg border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full">
        {/*
          🔴 `print:hidden` 을 **일부러 안 붙였다.** 인쇄물(=PDF)로 나가는 순간
             화면 밖으로 나가고, 그때가 실행 결과로 오인될 위험이 가장 큰 지점이다.
             배선이 들어오면 이 블록을 지운다 — `SAMPLE_PIPELINE_DATA` 와 같이 지운다.
        */}
        <div className="mb-6 rounded-lg border-2 border-dashed border-amber-500 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900 print:bg-white">
          <span className="font-bold">표본 문서 — 실행 결과가 아닙니다.</span>{" "}
          아래 후보지·좌표·시나리오·AHP 가중치는 화면 배치를 확인하려고 코드에 박아 둔
          고정값입니다. 파이프라인·공청회 결과를 읽어 오는 배선은 아직 없습니다(화면 5의
          A/B 분기 확정 후 연결). 이 상태로 내려받은 PDF·HWPX 를 심의 자료로 쓰지 마십시오.
        </div>

        <PdfReportHeader
          facilityType={data.facility_type}
          formattedDate={formattedDate}
          timestamp={data.timestamp}
        />

        <CandidateInfoSection
          candidateJibun={data.candidate_jibun}
          candidateAddress={data.candidate_address}
          facilityType={data.facility_type}
          lat={data.candidate_lat}
          lng={data.candidate_lng}
          intensityLevel={data.intensity_level}
        />

        <ScenarioEvaluationSection scenarios={data.scenarios} />

        <AhpWeightSection ahpWeights={data.ahp_weights} />

        <PdfReportFooter timestamp={data.timestamp} />
      </div>
    </div>
  );
}
