'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Dashboard from './dashboard/page';

import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import MapContainer from '../components/MapContainer';
import WizardPanel from '../components/WizardPanel';
import { SimulationModal, LoginModal, RegulationModal } from '../components/Modals';


export default function Home() {
  // 플랫폼 단계별 상태 제어 (Pipeline Wizard Steps)
  // Step 1: 데이터 일괄 업로드 및 감리 (Ingestion & AI Audit)
  // Step 2: 비주얼 HITL 좌표 보정 (Visual HITL Alignment)
  // Step 3: AHP 상대적 가중치 잠금 (AHP Weight Profile Lock)
  // Step 4: 최적 입지 선정 및 갈등도 평가 (PostGIS Filtering & CSS)
  // Step 5: AI 모의 심의 및 PDF 보고서 (AI Simulation & PDF Report)
  const [pipelineStep, setPipelineStep] = useState(1);

  // Step 1 AI 감리 및 실무자 의도 매핑 검증 상태
  const [isAuditComplete, setIsAuditComplete] = useState(false);
  const [auditMetadata, setAuditMetadata] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // 1. AHP 가중치 입력 상태
  const [ahpWeights, setAhpWeights] = useState({});
  const [crValue, setCrValue] = useState(0.04);
  const [isAhpLocked, setIsAhpLocked] = useState(false);
  const [auditReason, setAuditReason] = useState('');
  const [userIntent, setUserIntent] = useState('');

  // 2. 후보지 탭 및 상태 (Step 4 & 5에서 노출)
  const [activeTab, setActiveTab] = useState('top1');
  const [selectedParcel, setSelectedParcel] = useState({
    top1: { id: 1, pnu: '1117011200100420000', jibun: '한강로동 42-12 (국유지)', price: 14200000, area: 15, css: 78, cssGrade: '상', lat: 37.5302, lng: 126.9724, simulated: true },
    top2: { id: 2, pnu: '1117011200100450002', jibun: '한강로동 45-2 (시유지)', price: 9800000, area: 12, css: 45, cssGrade: '중', lat: 37.5328, lng: 126.9751, simulated: false },
    top3: { id: 3, pnu: '1117011300100120001', jibun: '이촌동 12-1 (구유지)', price: 18500000, area: 18, css: 12, cssGrade: '하', lat: 37.5255, lng: 126.9702, simulated: false }
  });

  // 3. 비주얼 HITL 보정 상태
  const [hitlJibun, setHitlJibun] = useState('');
  const [hitlLng, setHitlLng] = useState(126.9724);
  const [hitlLat, setHitlLat] = useState(37.5302);

  // 4. AI 시뮬레이션 상태 (개별 및 일괄 실행 대응을 위해 객체/상태 세분화)
  const [showSimModal, setShowSimModal] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMode, setSimMode] = useState('single'); // 'single' (개별) | 'all' (일괄)
  const [simTarget, setSimTarget] = useState('top1'); // 개별 심의 대상 ('top1' | 'top2' | 'top3')
  const [simLogs, setSimLogs] = useState({ // 후보지별 독립 토론 로그 기록
    top1: [],
    top2: [],
    top3: []
  });

  // 5. 로그인 및 회원가입 인증 상태 (백엔드 auth API 실물 동기화 연동)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [municipalId, setMunicipalId] = useState('');
  const [department, setDepartment] = useState('용산구 스마트도시과');

  // 조례 RAG 관리 모달 관련 상태
  const [showRegulationModal, setShowRegulationModal] = useState(false);
  const [regulationsList, setRegulationsList] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('map'); // 'map' | 'dashboard'
  
  // 개별 터미널들의 자동 스크롤 제어용 Refs
  const simEndRefTop1 = useRef(null);
  const simEndRefTop2 = useRef(null);
  const simEndRefTop3 = useRef(null);

  // 조례 목록 비동기 동기화 조회
  const fetchRegulations = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/upload/regulations');
      if (res.ok) {
        const data = await res.json();
        setRegulationsList(data);
      }
    } catch (err) {
      console.error("조례 목록 로드 실패:", err);
    }
  };

  // 모달 활성화 시 자동 fetch
  useEffect(() => {
    if (showRegulationModal) {
      setTimeout(() => {
        fetchRegulations();
      }, 0);
    }
  }, [showRegulationModal]);

  // 다중 업로드 핸들러 (중복 가드 적용)
  const handleRegulationUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setIsUploading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/upload/regulation', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        alert('조례 PDF 파일이 성공적으로 업로드되었습니다.');
        fetchRegulations();
      } else {
        const errData = await res.json();
        alert(`업로드 실패: ${errData.detail || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error("업로드 통신 실패:", err);
      alert("서버 연결에 실패했습니다.");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // 물리 삭제 핸들러 (Deletion Engine)
  const handleRegulationDelete = async (filename) => {
    if (!confirm(`조례 '${filename}' 및 RAG 텍스트 캐시를 영구 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`http://localhost:8000/api/v1/upload/regulations/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert('조례 및 RAG 캐시 파일이 성공적으로 물리 삭제되었습니다.');
        fetchRegulations();
      } else {
        const errData = await res.json();
        alert(`삭제 실패: ${errData.detail || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error("삭제 통신 실패:", err);
      alert("서버 연결에 실패했습니다.");
    }
  };

  // AHP 가중치 조절
  const handleSliderChange = (key, val) => {
    if (isAhpLocked) return;
    const value = parseInt(val);
    setAhpWeights(prev => {
      const updated = { ...prev, [key]: value };
      const values = Object.values(updated);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      const mockCr = parseFloat(((maxVal - minVal) / 25).toFixed(3));
      setCrValue(mockCr);
      return updated;
    });
  };

  // 상대 쌍대비교 역수 행렬 조립 함수 (동적 N x N 스펙 대응)
  const buildPairwiseMatrix = (weights) => {
    const keys = Object.keys(weights);
    const n = keys.length;
    const matrix = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        const valI = weights[keys[i]] || 1;
        const valJ = weights[keys[j]] || 1;
        row.push(parseFloat((valI / valJ).toFixed(4)));
      }
      matrix.push(row);
    }
    return matrix;
  };

  // AHP 일관성(C.R.) 검증 및 DB 락 요청 연동
  const handleAhpLock = async () => {
    if (pipelineStep !== 3 || isAhpLocked) return;

    const matrix = buildPairwiseMatrix(ahpWeights);
    const keys = Object.keys(ahpWeights);

    try {
      // 1. 백엔드 AHP 일관성 비율(C.R.) 연산 API 호출
      const calcRes = await fetch('http://localhost:8000/api/v1/ahp/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matrix_size: keys.length,
          pairwise_matrix: matrix
        })
      });

      if (!calcRes.ok) {
        const calcErr = await calcRes.json();
        alert(`AHP 계산 실패: ${calcErr.detail || '알 수 없는 오류'}`);
        return;
      }

      const calcData = await calcRes.json();
      const { consistency_ratio, is_locked_allowed, weights } = calcData;

      setCrValue(parseFloat(consistency_ratio.toFixed(4)));

      if (!is_locked_allowed) {
        alert(`⚠️ 일관성 비율(C.R.) 기준 미달: 현재 일관성 비율은 ${consistency_ratio.toFixed(3)}입니다. 의사결정의 일관성을 확보하기 위해 가중치를 다시 조절하십시오. (C.R. < 0.1 필수)`);
        return;
      }

      // 2. 일관성 통과 시 백엔드 DB 가중치 락 저장 호출
      const lockRes = await fetch('http://localhost:8000/api/v1/ahp/lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairwise_matrix: matrix,
          weights: weights,
          consistency_ratio: consistency_ratio
        })
      });

      if (lockRes.ok) {
        setIsAhpLocked(true);
        setPipelineStep(4);
        alert(`AHP 일관성 검증 승인 (C.R: ${consistency_ratio.toFixed(3)}). 가중치가 DB에 안전하게 동결 저장되었습니다. PostGIS 최적 입지(Top 1~3) 연산이 기동됩니다!`);
      } else {
        const lockErr = await lockRes.json();
        alert(`AHP 락 저장 실패: ${lockErr.detail || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error("AHP 락 통신 실패:", err);
      alert("서버 연결에 실패했습니다.");
    }
  };

  // HITL 폼 동기화
  useEffect(() => {
    const active = selectedParcel[activeTab];
    if (active) {
      setTimeout(() => {
        setHitlJibun(active.jibun || '');
        setHitlLng(active.lng || 0);
        setHitlLat(active.lat || 0);
      }, 0);
    }
  }, [activeTab, selectedParcel]);

  // [하이브리드 HITL 의사결정 보정 이벤트 헨들러]
  // 1. 공공 데이터의 위경도 오차 및 오역 지번(Jibun) 정보를 서버 DB에 정식 반영하기 위해 API를 호출합니다.
  // 2. 사용자가 기입한 '텍스트 기획 의도(userIntent)'는 정보 보호 가이드에 입각해 로컬 상태로만 안전 격리하고 서버로는 발송하지 않습니다.
  const handleHitlCommit = async () => {
    // 텍스트 의도가 미입력되었을 경우 연산을 차단하는 유효성 가드입니다.
    if (!userIntent.trim()) {
      alert('⚠️ 예외 감지: 탐색 의도가 비어있습니다. 의도를 작성해야 필지 연산으로 진행할 수 있습니다.');
      return;
    }

    try {
      // 보정된 물리적 주소 및 위경도를 백엔드 HITL API로 커밋 전송합니다.
      const res = await fetch('http://localhost:8000/api/v1/lands/hitl/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcel_id: selectedParcel[activeTab].id,
          corrected_address: hitlJibun,
          corrected_lat: hitlLat,
          corrected_lng: hitlLng
        })
      });

      // API 전송 성공 시, 클라이언트의 후보 부지 주소/좌표 데이터를 갱신하고 Step 3로 상태를 진입시킵니다.
      if (res.ok) {
        setSelectedParcel(prev => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
            jibun: hitlJibun,
            lat: hitlLat,
            lng: hitlLng
          }
        }));
        setPipelineStep(3);
        alert('공간 좌표 및 지번 속성이 보정 완료되어 백엔드 서버에 성공적으로 커밋되었습니다. 의사결정 의도 보정도 완료되어 [Step 3: AHP 인자 설정] 단계를 진행합니다. (의도 데이터는 로컬 보안 정책에 따라 서버로 전송되지 않고 브라우저에 격리 보관됩니다.)');
      } else {
        const errData = await res.json();
        alert(`커밋 실패: ${errData.detail || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error("HITL 커밋 통신 실패:", err);
      alert("서버 연결에 실패했습니다.");
    }
  };

  // 최종 시뮬레이션 결과 단독 로드 API (지정한 targetTab 후보지를 대상으로 결과 업데이트)
  const fetchSimulationResults = async (parcelId, targetTab) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/simulation/results/${parcelId}`);
      if (res.ok) {
        const data = await res.json();
        // 백엔드 통계 데이터로 해당 필지 상태 갱신
        setSelectedParcel(prev => ({
          ...prev,
          [targetTab]: {
            ...prev[targetTab],
            css: data.conflict_sensitivity_score,
            cssGrade: data.conflict_sensitivity_score >= 7.0 ? '상' : data.conflict_sensitivity_score >= 4.0 ? '중' : '하',
            simulated: true
          }
        }));
      }
    } catch (err) {
      console.error("[E2E Error] 결과 조회 실패:", err);
    }
  };

  // AI 모의 심의 대사 인입 시 터미널 스크롤 최하단 자동 갱신 (TOP1, TOP2, TOP3 채널별 독립 모니터링)
  useEffect(() => {
    if (simEndRefTop1.current) simEndRefTop1.current.scrollIntoView({ behavior: 'smooth' });
  }, [simLogs.top1]);

  useEffect(() => {
    if (simEndRefTop2.current) simEndRefTop2.current.scrollIntoView({ behavior: 'smooth' });
  }, [simLogs.top2]);

  useEffect(() => {
    if (simEndRefTop3.current) simEndRefTop3.current.scrollIntoView({ behavior: 'smooth' });
  }, [simLogs.top3]);

  // 개별 시뮬레이션 실행 (지정한 단일 후보지를 대상으로 SSE 통신 개시)
  const runSingleSimulation = (targetTab) => {
    setShowSimModal(true);
    setSimMode('single');
    setSimTarget(targetTab);
    setIsSimulating(true);
    
    // 대상 후보지 로그만 초기화
    setSimLogs(prev => ({
      ...prev,
      [targetTab]: []
    }));

    const activeParcel = selectedParcel[targetTab];
    const parcelId = activeParcel.id;

    // EventSource 커넥션 생성 및 백엔드 SSE 스트림 연동
    const eventSource = new EventSource(`http://localhost:8000/api/v1/simulation/stream?parcel_id=${parcelId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 실시간 대사 누적
        setSimLogs(prev => ({
          ...prev,
          [targetTab]: [...(prev[targetTab] || []), { sender: data.sender, text: data.text }]
        }));

        // 마지막 패킷 수신 시 연결 종료 및 최종 결과 로드
        if (data.is_finished) {
          eventSource.close();
          setIsSimulating(false);
          fetchSimulationResults(parcelId, targetTab);
          
          // 모의 심의 완료 후 1.5초 대기 후 자동으로 모달을 닫고 Step 5로 자동 슬라이딩 (하이브리드)
          setTimeout(() => {
            setShowSimModal(false);
            setPipelineStep(5);
          }, 1500);
        }
      } catch (err) {
        console.error("SSE 파싱 에러:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE 통신 에러 (서버 연결 실패 또는 종료):", err);
      eventSource.close();
      setIsSimulating(false);
      fetchSimulationResults(parcelId, targetTab);
    };
  };

  // 모든 조건 일괄 시뮬레이션 실행 (3개 후보지 동시 병렬 SSE 통신 개시)
  const runAllSimulation = () => {
    setShowSimModal(true);
    setSimMode('all');
    setIsSimulating(true);
    
    // 모든 로그 데이터셋 초기화
    setSimLogs({
      top1: [],
      top2: [],
      top3: []
    });

    let finishedCount = 0;

    ['top1', 'top2', 'top3'].forEach(tab => {
      const activeParcel = selectedParcel[tab];
      const parcelId = activeParcel.id;
      const eventSource = new EventSource(`http://localhost:8000/api/v1/simulation/stream?parcel_id=${parcelId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          setSimLogs(prev => ({
            ...prev,
            [tab]: [...(prev[tab] || []), { sender: data.sender, text: data.text }]
          }));

          if (data.is_finished) {
            eventSource.close();
            finishedCount += 1;
            fetchSimulationResults(parcelId, tab);
            
            // 모든 스트림 채널이 종료되었을 때 로딩 플래그 해제 및 Step 5 자동 슬라이딩 (하이브리드)
            if (finishedCount === 3) {
              setIsSimulating(false);
              setTimeout(() => {
                setShowSimModal(false);
                setPipelineStep(5);
              }, 1500);
            }
          }
        } catch (err) {
          console.error("SSE 파싱 에러:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error(`SSE 통신 에러 (tab: ${tab}):`, err);
        eventSource.close();
        finishedCount += 1;
        fetchSimulationResults(parcelId, tab);
        
        if (finishedCount === 3) {
          setIsSimulating(false);
          setTimeout(() => {
            setShowSimModal(false);
            setPipelineStep(5);
          }, 1500);
        }
      };
    });
  };

  // 기존 runSimulation 트리거 핸들러와 하방 호환 연계
  const runSimulation = () => {
    runAllSimulation();
  };

  // WeasyPrint 타당성 PDF 보고서 실물 다운로드 연동
  const handleDownloadPdf = async () => {
    const activeParcel = selectedParcel[activeTab];
    const parcelId = activeParcel.id;
    
    try {
      const res = await fetch(`http://localhost:8000/api/v1/simulation/report/${parcelId}`);
      if (!res.ok) {
        alert("PDF 리포트 생성에 실패했습니다. (백엔드 4주차 모듈 미완성)");
        return;
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OmniSite_입지타당성보고서_PNU_${activeParcel.pnu}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF 다운로드 통신 실패:", err);
      alert("서버 연결에 실패했습니다.");
    }
  };

  // 실제 백엔드 연계 로그인 인증 처리 (JWT 토큰 발급)
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      alert('행정 이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('auth_token', data.access_token);
        setIsLoggedIn(true);
        setMunicipalId(email.split('@')[0]); // 이메일 ID 부분을 실무자 ID로 노출
        setShowLoginModal(false);
        alert('🎉 도시행정망 접속 인증에 성공했습니다.');
      } else {
        alert(`❌ 로그인 실패: ${data.detail || '이메일 혹은 패스워드가 올바르지 않습니다.'}`);
      }
    } catch (err) {
      console.error('로그인 통신 장애:', err);
      alert('백엔드 인증 서버와의 통신에 실패했습니다.');
    }
  };

  // 실제 백엔드 연계 신규 실무자 회원가입 처리
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !username.trim()) {
      alert('모든 필수 항목(이메일, 비밀번호, 실무자 이름)을 기입해주세요.');
      return;
    }
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });
      const data = await res.json();
      if (res.ok) {
        alert('🎉 신규 행정망 실무자 계정 등록에 성공했습니다. 로그인 모드에서 로그인을 진행해 주세요.');
        setAuthMode('login'); // 성공 후 로그인 화면으로 전환
        setPassword('');
      } else {
        alert(`❌ 회원가입 실패: ${data.detail || '입력 규격을 다시 확인해 주세요.'}`);
      }
    } catch (err) {
      console.error('회원가입 통신 장애:', err);
      alert('백엔드 회원가입 서버와의 통신에 실패했습니다.');
    }
  };

  // 로컬 테스트용 목업 데이터 주입 엔진 (하이브리드 시연용)
  const injectMockData = () => {
    setAuditReason("[목업] 인근 대중교통 인프라 접점 및 소방 안전 확보 규정 검토 필요");
    setUserIntent("[목업] 스마트 쉼터 부스 설치를 위한 유동 인구 밀집도 분석 및 적합 필지 탐색");
    setAhpWeights({
      "대중교통 접근성": 7,
      "소방 통로 확보": 5,
      "생활인구 밀집도": 8,
      "민원 발생 빈도": 4
    });
    setUploadedFiles([
      { name: '용산구_유동인구_데이터셋.csv', type: 'CSV' },
      { name: '서울시_쉼터인프라_안전규정.pdf', type: 'PDF' }
    ]);
    setIsAuditComplete(true);
    setPipelineStep(2); // Mock 데이터 주입 완료 시 자동으로 Step 2 단계로 화면 슬라이딩 전환 (하이브리드)
    alert('🎉 로컬 목업 데이터 주입 완료! 자동으로 Step 2로 이동합니다.');
  };

  // Step 1 다중 파일 드롭 모사 및 AI 통합 사전 감리 수행 (실물 다중 CSV API 연동)
  const triggerFileAudit = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.multiple = true; // 다중 파일 선택 허용
    
    input.onchange = async (e) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;
      
      const formData = new FormData();
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'csv') {
          alert(`⚠️ 파일 유형 제한: 오직 CSV 파일만 업로드할 수 있습니다. (에러 파일: ${file.name})`);
          return;
        }
        formData.append('files', file); // 동일한 'files' 키로 다중 추가
      }
      
      try {
        const res = await fetch('http://localhost:8000/api/v1/lands/audit/csv', {
          method: 'POST',
          body: formData
        });
        
        if (res.ok) {
          const data = await res.json();
          setAuditReason(data.audit_reason);
          setUserIntent(data.user_intent);
          setAhpWeights(data.extracted_weights); // 동적 가중치 슬라이더 항목 대입
          setIsAuditComplete(true);
          setPipelineStep(2); // CSV 감리 완료 시 자동으로 Step 2 단계로 화면 슬라이딩 전환
          alert(`🎉 AI 통합 감리가 성공적으로 완료되었습니다. 총 ${selectedFiles.length}개의 데이터셋 분석을 기반으로 도출된 감리 사유 및 의도를 Step 2에서 확인하십시오.`);
        } else {
          // fallback mock data injection if server error
          console.warn("서버 에러 감지 - 로컬 목업 데이터로 우회 진행합니다.");
          setAuditReason("[목업] 인근 대중교통 인프라 접점 및 소방 안전 확보 규정 검토 필요");
          setUserIntent("[목업] 스마트 쉼터 부스 설치를 위한 유동 인구 밀집도 분석 및 적합 필지 탐색");
          setAhpWeights({
            "대중교통 접근성": 7,
            "소방 통로 확보": 5,
            "생활인구 밀집도": 8,
            "민원 발생 빈도": 4
          });
          setUploadedFiles(Array.from(selectedFiles).map(f => ({ name: f.name, type: 'CSV' })));
          setIsAuditComplete(true);
          setPipelineStep(2);
          alert(`🎉 [로컬 목업 모드] AI 통합 감리가 완료되었습니다. (서버 연결 에러로 로컬 테스트 데이터 주입)`);
        }
      } catch (err) {
        // fallback mock data injection if server connection failure
        console.warn("서버 연결 불가 - 로컬 목업 데이터로 우회 진행합니다.");
        setAuditReason("[목업] 인근 대중교통 인프라 접점 및 소방 안전 확보 규정 검토 필요");
        setUserIntent("[목업] 스마트 쉼터 부스 설치를 위한 유동 인구 밀집도 분석 및 적합 필지 탐색");
        setAhpWeights({
          "대중교통 접근성": 7,
          "소방 통로 확보": 5,
          "생활인구 밀집도": 8,
          "민원 발생 빈도": 4
        });
        setUploadedFiles(Array.from(selectedFiles).map(f => ({ name: f.name, type: 'CSV' })));
        setIsAuditComplete(true);
        setPipelineStep(2);
        alert(`🎉 [로컬 목업 모드] AI 통합 감리가 완료되었습니다. (네트워크 연결 장애로 로컬 테스트 데이터 주입)`);
      }
    };
    
    input.click();
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-ink font-sans bg-canvas-soft">
      <Header 
        setIsSidebarOpen={setIsSidebarOpen}
        setActiveView={setActiveView}
        setPipelineStep={setPipelineStep}
        activeView={activeView}
        pipelineStep={pipelineStep}
        isLoggedIn={isLoggedIn}
        department={department}
        municipalId={municipalId}
        setShowLoginModal={setShowLoginModal}
      />
      
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      <MapContainer 
        activeView={activeView}
        pipelineStep={pipelineStep}
        hitlLat={hitlLat}
        hitlLng={hitlLng}
        setHitlLat={setHitlLat}
        setHitlLng={setHitlLng}
        selectedParcel={selectedParcel}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <WizardPanel 
        activeView={activeView}
        pipelineStep={pipelineStep}
        setPipelineStep={setPipelineStep}
        isAuditComplete={isAuditComplete}
        triggerFileAudit={triggerFileAudit}
        injectMockData={injectMockData}
        uploadedFiles={uploadedFiles}
        auditReason={auditReason}
        userIntent={userIntent}
        setUserIntent={setUserIntent}
        hitlJibun={hitlJibun}
        setHitlJibun={setHitlJibun}
        hitlLng={hitlLng}
        setHitlLng={setHitlLng}
        hitlLat={hitlLat}
        setHitlLat={setHitlLat}
        ahpWeights={ahpWeights}
        crValue={crValue}
        isAhpLocked={isAhpLocked}
        handleSliderChange={handleSliderChange}
        setIsAhpLocked={setIsAhpLocked}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedParcel={selectedParcel}
        runSingleSimulation={runSingleSimulation}
        handleHitlCommit={handleHitlCommit}
        handleAhpLock={handleAhpLock}
        runAllSimulation={runAllSimulation}
        handleDownloadPdf={handleDownloadPdf}
      />

      <div className={activeView === 'dashboard' ? 'block pt-16 min-h-screen bg-canvas-soft' : 'hidden'}>
        <Dashboard isSubView={true} />
      </div>

      <SimulationModal 
        showSimModal={showSimModal}
        setShowSimModal={setShowSimModal}
        simMode={simMode}
        simTarget={simTarget}
        selectedParcel={selectedParcel}
        simLogs={simLogs}
        isSimulating={isSimulating}
        simEndRefTop1={simEndRefTop1}
        simEndRefTop2={simEndRefTop2}
        simEndRefTop3={simEndRefTop3}
        setPipelineStep={setPipelineStep}
      />

      <LoginModal 
        showLoginModal={showLoginModal}
        setShowLoginModal={setShowLoginModal}
        authMode={authMode}
        setAuthMode={setAuthMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        username={username}
        setUsername={setUsername}
        department={department}
        setDepartment={setDepartment}
        handleLogin={handleLogin}
        handleRegister={handleRegister}
      />

      <RegulationModal 
        showRegulationModal={showRegulationModal}
        setShowRegulationModal={setShowRegulationModal}
        regulationsList={regulationsList}
        isUploading={isUploading}
        handleRegulationUpload={handleRegulationUpload}
        handleRegulationDelete={handleRegulationDelete}
      />
    </div>
  );
}
