'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Dashboard from './dashboard/page';

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

  // Leaflet 지도 인스턴스 참조
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // 위경도 결측치(Null/Zero)에 기반한 군부대/보안시설 우회 예외처리 함수
  const isValidCoordinate = (lat, lng) => {
    if (lat === null || lat === undefined || isNaN(lat) || lat === 0) return false;
    if (lng === null || lng === undefined || isNaN(lng) || lng === 0) return false;
    if (lat < 33.0 || lat > 39.0 || lng < 124.0 || lng > 132.0) return false; // 대한민국 위경도 한계 범주 검증
    return true;
  };

  // 1. Leaflet 스크립트 및 CSS 로드 (최초 마운트 시 단 1회만 기동)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (window.L) {
      setTimeout(() => setLeafletLoaded(true), 0);
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        setTimeout(() => setLeafletLoaded(true), 0);
      };
      document.body.appendChild(script);
    }
  }, []);

  // 2. 지도 초기화 및 마커 동적 갱신 (leafletLoaded 및 pipelineStep 변경 시에만 안전 연동)
  useEffect(() => {
    if (!leafletLoaded) return;
    const L = window.L;
    if (!L) return;

    // 맵 객체 생성 (기존에 없을 때만 최초 1회)
    if (!mapRef.current) {
      const map = L.map('interactive-map', {
        zoomControl: false,
        dragging: true,           // 드래그 정상 허용 (마커 드래그 메커니즘 정상화)
        touchZoom: true,          // 터치 줌 허용
        scrollWheelZoom: true,     // 마우스 휠 줌 허용
        doubleClickZoom: true,     // 더블클릭 줌 허용
        boxZoom: true,             // 박스 줌 허용
        keyboard: true             // 키보드 이동 허용
      }).setView([37.5302, 126.9724], 14);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);

      mapRef.current = map;
    }

    const map = mapRef.current;
    if (map) {
      map.dragging.enable();
      if (map.touchZoom) map.touchZoom.enable();
      if (map.doubleClickZoom) map.doubleClickZoom.enable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
      if (map.boxZoom) map.boxZoom.enable();
      if (map.keyboard) map.keyboard.enable();
      
      // [invalidateSize 해결책] 지도가 다시 활성화될 때 레이아웃 정정을 위해 강제 invalidateSize 호출
      if (activeView === 'map') {
        setTimeout(() => {
          map.invalidateSize();
        }, 50);
      }
    }

    // 기존 맵 레이어/마커 일괄 청소 및 수거
    Object.values(markersRef.current).forEach(m => {
      if (m && typeof m.remove === 'function') {
        m.remove();
      }
    });
    markersRef.current = {};

    // 파이프라인 단계별 시각 요소 렌더링
    if (pipelineStep === 2) {
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 28px; 
          height: 28px; 
          background: hsl(28, 91%, 54%); 
          border: 2px solid white; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 11px; 
          font-weight: bold; 
          color: white;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        ">★</div>`,
        iconSize: [28, 28]
      });

      if (!isValidCoordinate(hitlLat, hitlLng)) {
        console.error("[Exception] Step 2 coordinate is invalid. Suspended rendering.");
        return;
      }

      // Step 2 용 임시 마커 객체를 생성 및 초기화합니다.
      // draggable: true 옵션으로 마커를 지도 위에서 마우스 드래그앤드롭하여 좌표를 정정할 수 있도록 합니다.
      const marker = L.marker([hitlLat, hitlLng], {
        icon: markerIcon,
        draggable: true, // [HITL 피처] 지도 마커 드래그 보정 활성화
        autoPan: false
      }).addTo(map);

      // 법정 제한구역(지하철역 30m, 스쿨존 200m, 군사보호 400m)을 시각적으로 나타내는 차집합 차단 마스크 레이어(적색 원)를 지도에 투영합니다.
      const subwayBuffer = L.circle([37.5290, 126.9680], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.25,
        radius: 30
      }).addTo(map);

      const schoolBuffer = L.circle([37.5315, 126.9740], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.15,
        radius: 200
      }).addTo(map);

      const militaryBuffer = L.circle([37.5240, 126.9650], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.1,
        radius: 400
      }).addTo(map);

      // 드래그가 시작될 때 지도의 자체 드래깅/패닝 이벤트를 일시 정지하여 마커 조작성에 간섭을 배제합니다.
      marker.on('dragstart', () => {
        map.dragging.disable();
      });

      // 마커의 현재 경고 상태 플래그를 저장합니다.
      marker.isWarning = false;

      // 마커를 드래그하는 도중에 실시간으로 각 규제 영역 중심점과의 구면 거리를 측정하여 침범 여부를 스캔합니다.
      marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        const distSubway = pos.distanceTo(L.latLng(37.5290, 126.9680));
        const distSchool = pos.distanceTo(L.latLng(37.5315, 126.9740));
        const distMilitary = pos.distanceTo(L.latLng(37.5240, 126.9650));

        // 각 구역의 법적 규제 반경 미만으로 들어가면 침범 상태(shouldWarn)로 판정합니다.
        const shouldWarn = (distSubway < 30 || distSchool < 200 || distMilitary < 400);

        // 경고 상태가 전환될 때만 마커 아이콘을 경고(divIcon ⚠️) 혹은 일반 아이콘으로 실시간 교체하여 성능 지연을 최소화합니다.
        if (shouldWarn !== marker.isWarning) {
          marker.isWarning = shouldWarn;
          if (shouldWarn) {
            marker.setIcon(L.divIcon({
              className: 'custom-marker-warning',
              html: `<div style="
                width: 30px; 
                height: 30px; 
                background: #ef4444; 
                border: 2px solid white; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 11px; 
                font-weight: bold; 
                color: white;
                box-shadow: 0 0 15px rgba(239,68,68,0.8);
              ">⚠️</div>`,
              iconSize: [30, 30]
            }));
          } else {
            marker.setIcon(markerIcon);
          }
        }
      });

      // 드래그가 끝났을 때(마우스를 놓았을 때) 지도의 기본 드래깅 기능을 재활성화하고, 최종 안착지의 적격성을 검사합니다.
      marker.on('dragend', () => {
        map.dragging.enable();
        const newPos = marker.getLatLng();
        const distSubway = newPos.distanceTo(L.latLng(37.5290, 126.9680));
        const distSchool = newPos.distanceTo(L.latLng(37.5315, 126.9740));
        const distMilitary = newPos.distanceTo(L.latLng(37.5240, 126.9650));

        // 최종 안착지가 법정 금역 구역 내일 경우 경고 메시지를 출력하고 마커를 드래그 이전 시작 위치로 강제 롤백 처리합니다.
        if (distSubway < 30 || distSchool < 200 || distMilitary < 400) {
          alert('⚠️ 경고: 해당 지점은 법정 금역 구역(지하철/학교/군사보호구역)에 침범합니다. 안전한 구역으로 위치를 복원합니다.');
          marker.setLatLng([hitlLat, hitlLng]);
          marker.setIcon(markerIcon);
          marker.isWarning = false;
          return;
        }

        // 합법적인 구역일 경우에만 소수점 4자리 정밀도로 위경도 입력 폼 상태를 갱신합니다.
        setHitlLat(parseFloat(newPos.lat.toFixed(4)));
        setHitlLng(parseFloat(newPos.lng.toFixed(4)));
      });

      markersRef.current['temp'] = marker;
      markersRef.current['subway'] = subwayBuffer;
      markersRef.current['school'] = schoolBuffer;
      markersRef.current['military'] = militaryBuffer;
      map.panTo([hitlLat, hitlLng]);

    } else if (pipelineStep >= 4) {
      // Step 4 이상: 추천 후보 3개 마커 동시 드로잉
      Object.keys(selectedParcel).forEach(key => {
        const parcel = selectedParcel[key];

        // 결측 위경도(Null/Zero) 기반 군사보호/보안구역 자동 예외처리 및 렌더 제외
        if (!isValidCoordinate(parcel.lat, parcel.lng)) {
          console.warn(`[GIS Exception] ${key} (${parcel.jibun}) has invalid coordinates. Excluded as restricted/military zone.`);
          return;
        }

        const isSelected = activeTab === key;

        const markerIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            width: 28px; 
            height: 28px; 
            background: ${isSelected ? 'hsl(217, 91%, 60%)' : 'hsla(142, 70%, 50%, 0.9)'}; 
            border: 2px solid white; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 11px; 
            font-weight: bold; 
            color: white;
            box-shadow: ${isSelected ? '0 0 15px hsl(217, 91%, 60%)' : '0 0 10px rgba(0,0,0,0.5)'};
          ">${key.replace('top', '')}</div>`,
          iconSize: [28, 28]
        });

        const marker = L.marker([parcel.lat, parcel.lng], {
          icon: markerIcon,
          draggable: false
        }).addTo(map);

        marker.on('click', () => {
          setActiveTab(key);
        });

        markersRef.current[key] = marker;

        // 선택된 후보지인 경우, 주변 대중교통 배후 유동 영향 반경 시각화 (Wow Point)
        if (isSelected) {
          const influenceBuffer = L.circle([parcel.lat, parcel.lng], {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            weight: 1.5,
            dashArray: '4, 4',
            radius: 150
          }).addTo(map);
          markersRef.current[`influence_${key}`] = influenceBuffer;
        }
      });

      // 법정 제한구역 배제 영역(Exclusion Mask) 오버레이 유지 (ST_Difference 공간 연산 근거 전시)
      const subwayBuffer = L.circle([37.5290, 126.9680], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.15,
        radius: 30
      }).addTo(map);

      const schoolBuffer = L.circle([37.5315, 126.9740], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.1,
        radius: 200
      }).addTo(map);

      const militaryBuffer = L.circle([37.5240, 126.9650], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.08,
        radius: 400
      }).addTo(map);

      markersRef.current['subway_ex'] = subwayBuffer;
      markersRef.current['school_ex'] = schoolBuffer;
      markersRef.current['military_ex'] = militaryBuffer;

      const activeParcel = selectedParcel[activeTab];
      if (activeParcel && isValidCoordinate(activeParcel.lat, activeParcel.lng)) {
        map.panTo([activeParcel.lat, activeParcel.lng]);
      }
    }
  }, [leafletLoaded, pipelineStep, activeView]); // eslint-disable-line react-hooks/exhaustive-deps

  // 마커 속성 및 지도 동기화 효과 (드래그 스냅 보정)
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || pipelineStep < 4) return;

    Object.keys(selectedParcel).forEach(key => {
      const marker = markersRef.current[key];
      if (!marker) return;

      const parcel = selectedParcel[key];
      if (!isValidCoordinate(parcel.lat, parcel.lng)) return;

      const isSelected = activeTab === key;

      const currentPos = marker.getLatLng();
      if (Math.abs(currentPos.lat - parcel.lat) > 0.005 || Math.abs(currentPos.lng - parcel.lng) > 0.005) {
        marker.setLatLng([parcel.lat, parcel.lng]);
      }

      // 아이콘 스타일 색상 업데이트 (transition: all 0.2s 삭제!)
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 28px; 
          height: 28px; 
          background: ${isSelected ? 'hsl(217, 91%, 60%)' : 'hsla(142, 70%, 50%, 0.9)'}; 
          border: 2px solid white; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 11px; 
          font-weight: bold; 
          color: white;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        ">${key.replace('top', '')}</div>`,
        iconSize: [28, 28]
      });
      
      marker.setIcon(markerIcon);
    });

    const activeParcel = selectedParcel[activeTab];
    if (activeParcel && isValidCoordinate(activeParcel.lat, activeParcel.lng)) {
      mapRef.current.panTo([activeParcel.lat, activeParcel.lng]);
    }
  }, [activeTab, selectedParcel, pipelineStep]);

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
            
            // 모든 스트림 채널이 종료되었을 때 로딩 플래그 해제
            if (finishedCount === 3) {
              setIsSimulating(false);
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
          alert(`🎉 AI 통합 감리가 성공적으로 완료되었습니다. 총 ${selectedFiles.length}개의 데이터셋 분석을 기반으로 도출된 감리 사유 및 의도를 Step 2에서 확인하십시오.`);
        } else {
          const errData = await res.json();
          alert(`감리 실패: ${errData.detail || '알 수 없는 오류'}`);
        }
      } catch (err) {
        console.error("CSV 감리 통신 실패:", err);
        alert("서버 연결에 실패했습니다.");
      }
    };
    
    input.click();
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-ink font-sans bg-canvas-soft">
      
      {/* 1. 상단 글로벌 네비게이션 헤더 */}
      <header className="absolute top-0 left-0 right-0 h-16 glass-panel rounded-none border-t-0 border-x-0 border-b border-hairline z-50 px-8 flex justify-between items-center text-glass-crisp">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className="text-ink hover:text-primary text-xl font-bold cursor-pointer p-1 transition-colors mr-1"
            title="메뉴 토글"
          >
            ☰
          </button>
          <div 
            onClick={() => {
              setActiveView('map');
              setPipelineStep(1);
            }}
            className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-all"
            title="홈 화면으로 이동"
          >
            <span className="text-xl font-bold tracking-tight text-primary">OmniSite</span>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 font-medium">B2G SDSS v1.0</span>
          </div>
        </div>

        {/* 5단계 프로세스 시각화 (Header Steps Indicator) */}
        {activeView === 'map' && (
          <div className="hidden md:flex items-center gap-2 text-[11px] font-medium bg-white/50 border border-hairline px-4 py-1.5 rounded-full shadow-sm">
            {[
              { step: 1, label: '파일 업로드' },
              { step: 2, label: '데이터 승인' },
              { step: 3, label: 'AHP 가중치 락' },
              { step: 4, label: 'AI 토론' },
              { step: 5, label: '보고서 발급' }
            ].map((item, idx) => (
              <React.Fragment key={item.step}>
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                    pipelineStep === item.step 
                      ? 'bg-primary text-white scale-110 shadow-sm' 
                      : pipelineStep > item.step 
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                        : 'bg-gray-200/60 text-ink-secondary'
                  }`}>
                    {pipelineStep > item.step ? '✓' : item.step}
                  </span>
                  <span className={pipelineStep === item.step ? 'text-primary font-bold' : 'text-ink-secondary'}>
                    {item.label}
                  </span>
                </div>
                {idx < 4 && (
                  <span className="text-gray-300 mx-0.5">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div>
          {isLoggedIn ? (
            <span className="text-xs text-ink-secondary font-medium">{department} | {municipalId}</span>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="btn-primary text-xs px-4 py-1.5 font-semibold"
            >
              로그인
            </button>
          )}
        </div>
      </header>

      {/* 1-1. 왼쪽 사이드바 (Toggleable Left Sidebar) */}
      <aside className={`fixed top-0 left-0 h-full w-64 glass-panel rounded-none border-y-0 border-l-0 border-r border-hairline z-48 p-6 flex flex-col gap-6 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} text-glass-crisp pt-20 bg-white/70`}>
        <div className="flex justify-between items-center border-b border-hairline pb-4">
          <span className="text-xs font-bold text-ink-secondary">행정 시스템 메뉴</span>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="text-ink-secondary hover:text-ink text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col gap-2.5 text-xs font-semibold">
          <button 
            onClick={() => {
              setActiveView('map');
              setIsSidebarOpen(false);
            }} 
            className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-2.5 cursor-pointer border ${activeView === 'map' ? 'text-primary bg-primary/5 border-primary/10' : 'text-ink border-transparent hover:bg-primary/5'}`}
          >
            🗺️ 입지분석 메인 (Map)
          </button>
          <button 
            onClick={() => {
              setActiveView('dashboard');
              setIsSidebarOpen(false);
            }} 
            className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-2.5 cursor-pointer border ${activeView === 'dashboard' ? 'text-primary bg-primary/5 border-primary/10' : 'text-ink border-transparent hover:bg-primary/5'}`}
          >
            📊 이력 대시보드 (Analytics)
          </button>
        </nav>
      </aside>

      {/* 2. 인터랙티브 Leaflet GIS 3D 맵 공간 영역 (Map Container) */}
      <div 
        id="interactive-map" 
        className="map-container w-full h-full transition-opacity duration-300" 
        style={{ 
          opacity: activeView === 'map' ? 1 : 0, 
          pointerEvents: activeView === 'map' ? 'auto' : 'none', 
          zIndex: activeView === 'map' ? 1 : -1 
        }} 
      />

      {/* 3. 중앙 집중형 플로팅 위저드 패널 (Centered Workflow Wizard Panel) */}
      {activeView === 'map' && (
        <div 
          className={`fixed z-40 rounded-2xl text-glass-crisp shadow-2xl glass-panel-deep p-6 flex flex-col justify-between transition-all duration-700 ease-in-out ${
            pipelineStep >= 2
              ? 'top-20 left-[calc(100%-504px)] translate-x-0 translate-y-0 w-[480px] h-[calc(100vh-110px)] max-h-[85vh]'
              : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] max-w-[95vw] h-[480px]'
          }`} 
          style={{ background: 'rgba(255, 255, 255, 0.94)' }}
        >
          <div className="flex justify-between items-start border-b border-hairline pb-3 flex-none">
            <div>
              <h2 className="text-sm font-bold text-ink mb-0.5">
                {pipelineStep === 1 && "Step 1. 파일 업로드"}
                {pipelineStep === 2 && "Step 2. 데이터 승인"}
                {pipelineStep === 3 && "Step 3. AHP 가중치 락"}
                {pipelineStep === 4 && "Step 4. AI 토론"}
                {pipelineStep === 5 && "Step 5. 보고서 발급"}
              </h2>
              <p className="text-[10px] text-ink-secondary">
                {pipelineStep === 1 && "CSV 데이터셋 파일을 업로드하고 AI 감리를 진행합니다."}
                {pipelineStep === 2 && "공간 위치와 의사결정 탐색 의도를 보정하고 최종 승인합니다."}
                {pipelineStep === 3 && "AHP 쌍대비교 상대 가중치를 조정하고 확정합니다."}
                {pipelineStep === 4 && "추천 후보지의 분석 내용과 대중교통 영향 및 갈등 지수를 검토합니다."}
                {pipelineStep === 5 && "AI 주무관 에이전트 간의 갈등 조정 토론을 실시하고 타당성 보고서를 발급받습니다."}
              </p>
            </div>
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold shrink-0">
              Step {pipelineStep} / 5
            </span>
          </div>

          <div className="flex-1 py-2 my-1 flex flex-col gap-4">
            {/* Step 1 내용 */}
            {pipelineStep === 1 && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-ink-secondary">CSV 데이터셋 & RAG 법규 PDF 수집</label>
                  <span className="text-[10px] text-primary font-mono font-medium">CSV 및 PDF 파일 통합 지원</span>
                </div>
                {!isAuditComplete ? (
                  <div 
                    onClick={triggerFileAudit}
                    className="border-2 border-dashed border-hairline hover:border-primary rounded-xl p-8 text-center cursor-pointer transition-all bg-white/40 hover:bg-white/60"
                  >
                    <p className="text-xs text-ink font-semibold">📁 분석 CSV 및 RAG 법규 PDF 파일 일괄 드래그앤드롭</p>
                    <p className="text-[10px] text-ink-secondary mt-1">AI 감리 및 법률 규제 인코딩 일괄 수행</p>
                  </div>
                ) : (
                  <div className="bg-white/50 p-4 rounded-xl border border-hairline grid grid-cols-2 gap-4 h-[160px] items-center">
                    <div className="text-[11px] flex flex-col gap-1.5 text-ink leading-relaxed border-r border-hairline pr-3 max-h-[140px] overflow-y-auto">
                      <span className="text-primary font-bold">✓ 업로드된 파일 ({uploadedFiles.length}개)</span>
                      <div className="flex flex-col gap-1 mt-1 pr-1">
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-100 p-1 px-2 rounded border border-hairline text-[9px]">
                            <span className="truncate max-w-[170px] font-medium">{file.name}</span>
                            <span className={`text-[8px] px-1 rounded font-mono font-bold ${file.type === 'CSV' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{file.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-[11px] flex flex-col gap-1 text-ink leading-relaxed pl-1 max-h-[140px] overflow-y-auto pr-1">
                      <span className="text-primary font-bold">✓ AI 통합 사전 감리 결과</span>
                      <p className="text-[10px] leading-relaxed"><strong className="text-ink-secondary">감리 사유:</strong> {auditReason}</p>
                      <p className="text-[10px] leading-relaxed"><strong className="text-ink-secondary">추출 의도:</strong> {userIntent}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {pipelineStep === 2 && (
              <div className="bg-white/50 p-4 rounded-xl border border-hairline flex flex-col gap-3">
                <div className="flex flex-col gap-3">
                  {/* Left Column: Intent Correction */}
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="text-ink-secondary font-semibold">1. 정보 탐색 의도 및 목적 수정</span>
                    <textarea 
                      rows={3}
                      value={userIntent} 
                      onChange={(e) => setUserIntent(e.target.value)} 
                      className="text-input-notion resize-none leading-relaxed w-full h-[75px]"
                    />
                    <span className="text-[9px] text-ink-secondary">* 의도 데이터는 로컬 브라우저 세션에만 보안 격리 저장됩니다.</span>
                  </div>
                  {/* Right Column: Address/Coordinates */}
                  <div className="flex flex-col gap-2 text-xs border-t border-hairline pt-2.5">
                    <span className="text-[11px] text-ink-secondary font-semibold">2. 공간 좌표 및 임시 지번 보정</span>
                    <div className="flex flex-col gap-1">
                      <span className="text-ink-secondary">지번 주소</span>
                      <input 
                        type="text" 
                        value={hitlJibun} 
                        onChange={(e) => setHitlJibun(e.target.value)} 
                        className="text-input-notion w-full"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-ink-secondary">경도(Lng)</span>
                        <input type="number" step="0.000001" value={hitlLng} onChange={(e) => setHitlLng(parseFloat(e.target.value))} className="text-input-notion" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-ink-secondary">위도(Lat)</span>
                        <input type="number" step="0.000001" value={hitlLat} onChange={(e) => setHitlLat(parseFloat(e.target.value))} className="text-input-notion" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 내용 */}
            {pipelineStep === 3 && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-ink-secondary">AHP 인자별 상대 가중치</label>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold transition-all ${Object.keys(ahpWeights).length === 0 ? 'bg-ink-secondary/10 text-ink-secondary' : crValue < 0.1 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                    C.R. = {Object.keys(ahpWeights).length === 0 ? '-' : crValue} ({Object.keys(ahpWeights).length === 0 ? '대기' : crValue < 0.1 ? '만족' : '위배'})
                  </span>
                </div>
                <div className="flex flex-col gap-3.5 bg-white/40 p-4 rounded-xl border border-hairline max-h-[280px] overflow-y-auto pr-1">
                  {Object.keys(ahpWeights).map(key => (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[11px] text-ink-secondary">
                        <span className="font-medium">{key}</span>
                        <span className="font-mono text-ink font-semibold">{ahpWeights[key]}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="9"
                        disabled={isAhpLocked || pipelineStep !== 3}
                        value={ahpWeights[key]}
                        onChange={(e) => handleSliderChange(key, e.target.value)}
                        className="w-full accent-primary cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4 & 5 내용 (의사결정 보조 및 토론/보고서 영역) */}
            {pipelineStep >= 4 && (
              <div className="flex flex-col gap-3">
                {/* Top 1 ~ Top 3 탭 (각 후보지의 실시간 심의 상태 배지 추가) */}
                <div className="flex bg-gray-200/50 p-1 rounded-lg border border-hairline flex-none">
                  {['top1', 'top2', 'top3'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-all flex items-center justify-center gap-1 ${activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
                    >
                      {tab.toUpperCase()}
                      {selectedParcel[tab].simulated ? (
                        <span className="text-[8px] px-1 py-0.2 rounded-full font-bold bg-emerald-500/20 text-emerald-700">완료</span>
                      ) : (
                        <span className="text-[8px] px-1 py-0.2 rounded-full font-bold bg-gray-300/40 text-ink-secondary">대기</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* 개별 후보지별 1:1 심의 실행 버튼 패널 (Step 4에서만 신설 노출) */}
                {pipelineStep === 4 && (
                  <div className="flex gap-1.5 mb-0.5 flex-none">
                    {['top1', 'top2', 'top3'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => runSingleSimulation(tab)}
                        className="flex-1 btn-secondary text-[10px] py-1.5 font-bold border border-primary/20 hover:border-primary text-primary bg-primary/5 rounded-lg transition-all flex items-center justify-center gap-1 truncate"
                        title={`${tab.toUpperCase()} 후보지 맞춤형 AI 토론 개별 실행`}
                      >
                        {tab.toUpperCase()} 개별 심의
                        {selectedParcel[tab].simulated && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {pipelineStep === 5 ? (
                  <div className="flex flex-col gap-2.5 animate-fadeIn">
                    {/* 최종 단계 심의 합의 안내 카드 */}
                    <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/50 flex items-center gap-2 text-xs text-emerald-800">
                      <span className="text-base">📄</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-[11px]">AI 모의 심의 타당성 검토 완료</span>
                        <p className="text-[9px] text-emerald-700 leading-normal">
                          아래 종합 비교 대조표를 확인하고 필요한 후보지의 행정용 PDF 보고서를 다운로드 하십시오.
                        </p>
                      </div>
                    </div>
                    {/* 종합 비교 대조표 (3개 후보지의 면적, CSS, 심의여부 등 한눈에 비교 가능) */}
                    <div className="bg-white/50 border border-hairline rounded-xl overflow-hidden flex flex-col">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-gray-100/80 text-ink-secondary border-b border-hairline font-bold">
                            <th className="p-2">후보지</th>
                            <th className="p-2">소유/지번</th>
                            <th className="p-2 text-right">면적(㎡)</th>
                            <th className="p-2 text-center">갈등지수(CSS)</th>
                            <th className="p-2 text-center">심의결과</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['top1', 'top2', 'top3'].map(tab => {
                            const p = selectedParcel[tab];
                            return (
                              <tr key={tab} className={`border-b border-hairline/50 hover:bg-gray-50/50 transition-colors ${activeTab === tab ? 'bg-primary/5 font-semibold' : ''}`}>
                                <td className="p-2 font-bold text-primary">{tab.toUpperCase()}</td>
                                <td className="p-2 truncate max-w-[120px]" title={p.jibun}>{p.jibun}</td>
                                <td className="p-2 text-right font-mono">{p.area} ㎡</td>
                                <td className="p-2 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                    p.cssGrade === '상' ? 'bg-rose-500/10 text-rose-600' :
                                    p.cssGrade === '중' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                                  }`}>
                                    {p.cssGrade} ({p.css}점)
                                  </span>
                                </td>
                                <td className="p-2 text-center">
                                  {p.simulated ? (
                                    <span className="text-emerald-600 font-bold">합의 완료</span>
                                  ) : (
                                    <span className="text-gray-400">미진행</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 animate-fadeIn">
                    {/* Left Column: Properties */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-ink-secondary">추천지 속성 정보</span>
                      <div className="bg-white/50 p-3 rounded-xl border border-hairline flex flex-col gap-2 h-[135px] justify-between">
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-secondary">지번 / 소유 구분</span>
                          <span className="text-ink font-semibold truncate max-w-[180px]">{selectedParcel[activeTab].jibun}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-secondary">면적(㎡)</span>
                          <span className="font-mono text-ink font-semibold">{selectedParcel[activeTab].area} ㎡</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-secondary">공시지가</span>
                          <span className="font-mono text-primary font-semibold">₩ {selectedParcel[activeTab].price.toLocaleString()} / ㎡</span>
                        </div>
                        <div className="flex justify-between text-[10px] border-t border-hairline pt-1.5 text-ink-secondary font-mono">
                          <span>좌표: {selectedParcel[activeTab].lat}, {selectedParcel[activeTab].lng}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Conflict */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-ink-secondary">지역 갈등 민감도 (CSS)</span>
                      <div className="bg-white/50 p-3 rounded-xl border border-hairline flex flex-col gap-3 h-[135px] justify-center">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-ink-secondary">갈등 지수</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            selectedParcel[activeTab].cssGrade === '상' ? 'bg-rose-500/10 text-rose-600' :
                            selectedParcel[activeTab].cssGrade === '중' ? 'bg-amber-500/10 text-amber-600' :
                            'bg-emerald-500/10 text-emerald-600'
                          }`}>
                            등급: {selectedParcel[activeTab].cssGrade} ({selectedParcel[activeTab].css}점)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${
                            selectedParcel[activeTab].cssGrade === '상' ? 'bg-rose-500' :
                            selectedParcel[activeTab].cssGrade === '중' ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`} style={{ width: `${selectedParcel[activeTab].css}%` }} />
                        </div>
                        <p className="text-[9px] text-ink-secondary mt-1 leading-relaxed">
                          * 주민 민원 가능성 및 교육/의료시설 반경 인접도를 수치화한 갈등 지표입니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 하단 내비게이션 컨트롤 (모든 단계 단일 행 배치) */}
          <div className="flex justify-between items-center border-t border-hairline pt-3 mt-1 flex-none">
            {/* 1. 이전 단계 이동 버튼 - 글자 줄 바꿈 방지를 위해 whitespace-nowrap 및 가로폭을 w-[70px]로 확장 */}
            {pipelineStep > 1 ? (
              <button 
                onClick={() => setPipelineStep(prev => Math.max(1, prev - 1))}
                className="btn-secondary text-xs py-1.5 w-[70px] text-center whitespace-nowrap shrink-0"
              >
                ◀ 이전
              </button>
            ) : (
              <div className="w-[70px] shrink-0" /> /* 단일 행 정렬 균형 유지를 위한 고정폭 투명 스페이스 */
            )}

            {/* 2. 프로세스별 핵심 확인 및 실행 액션 영역 */}
            <div className="flex-1 flex justify-center px-2">
              {pipelineStep === 1 && (
                <span className="text-[10px] text-ink-secondary font-bold">
                  CSV 파일을 업로드한 뒤 다음 단계로 이동하세요
                </span>
              )}
              {pipelineStep === 2 && (
                <button 
                  onClick={handleHitlCommit}
                  className="btn-primary bg-amber-500 hover:bg-amber-600 text-xs py-1.5 px-4 rounded-lg font-semibold truncate"
                >
                  데이터 확정
                </button>
              )}
              {pipelineStep === 3 && (
                <div className="flex gap-1.5">
                  <button
                    onClick={handleAhpLock}
                    disabled={crValue >= 0.1 || Object.keys(ahpWeights).length === 0}
                    className="btn-primary text-xs py-1.5 px-3.5 font-semibold disabled:opacity-30 rounded-lg truncate"
                  >
                    🔒 가중치 확정
                  </button>
                  {isAhpLocked && (
                    <button
                      onClick={() => {
                        setIsAhpLocked(false);
                        setPipelineStep(3);
                        alert("AHP 가중치 잠금이 해제되었습니다.");
                      }}
                      className="btn-secondary text-[11px] py-1.5 px-2 rounded-lg"
                    >
                      🔓 해제
                    </button>
                  )}
                </div>
              )}
              {pipelineStep === 4 && (
                <button 
                  onClick={runAllSimulation}
                  className="btn-primary text-xs py-1.5 px-4 rounded-lg font-semibold shadow-md truncate"
                  title="3개 추천 후보지 일괄 시뮬레이션 동시 실행"
                >
                  모든 조건 심의 실행
                </button>
              )}
              {pipelineStep === 5 && (
                <button 
                  onClick={handleDownloadPdf}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs py-1.5 px-4 rounded-lg font-semibold shadow-md truncate"
                  title="WeasyPrint PDF 보고서 다운로드"
                >
                  📝 PDF 다운로드
                </button>
              )}
            </div>

            {/* 3. 다음 단계 이동 버튼 - 글자 줄 바꿈 방지를 위해 whitespace-nowrap 및 가로폭을 w-[70px]로 확장 */}
            {pipelineStep < 5 ? (
              <button 
                onClick={() => {
                  // 단계 진행 시 화면 깨짐 방지를 위해 기본 데이터 셋업
                  if (pipelineStep === 1 && !isAuditComplete) {
                    setAuditReason("[목업] 인근 대중교통 인프라 접점 및 소방 안전 확보 규정 검토 필요");
                    setUserIntent("[목업] 스마트 쉼터 부스 설치를 위한 유동 인구 밀집도 분석 및 적합 필지 탐색");
                    setAhpWeights({
                      "대중교통 접근성": 7,
                      "소방 통로 확보": 5,
                      "생활인구 밀집도": 8,
                      "민원 발생 빈도": 4
                    });
                    setIsAuditComplete(true);
                  }
                  setPipelineStep(prev => Math.min(5, prev + 1));
                }}
                className="btn-primary text-xs py-1.5 w-[70px] text-center whitespace-nowrap shrink-0"
              >
                다음 ▶
              </button>
            ) : (
              <div className="w-[70px] shrink-0" /> /* 단일 행 정렬 균형 유지를 위한 고정폭 투명 스페이스 */
            )}
          </div>
        </div>
      )}

      {/* 5. 비동기식 이력 대시보드 뷰 영역 (Dashboard Subview Container) */}
      <div className={activeView === 'dashboard' ? 'block pt-16 min-h-screen bg-canvas-soft' : 'hidden'}>
        <Dashboard isSubView={true} />
      </div>

      {/* AI 시뮬레이션 모달 팝업 (실시간 모의 심의 토론 - 일괄/개별 대응 및 삼분할 뷰 포트 구성) */}
      {showSimModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-glass-crisp animate-fadeIn">
          <div className={`${simMode === 'all' ? 'w-[1180px]' : 'w-[800px]'} h-[580px] glass-panel-deep p-6 flex flex-col justify-between rounded-2xl transition-all duration-500`}>
            {/* 모달 상단 헤더 영역 */}
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">OMS-01-03-001 | AI 에이전트 실시간 모의 심의 토론</h3>
                <p className="text-[10px] text-ink-secondary">
                  {simMode === 'all' ? "3개 추천 후보지 동시 일괄 시뮬레이션 실행" : `Target PNU: ${selectedParcel[simTarget].pnu}`}
                </p>
              </div>
              <button 
                onClick={() => setShowSimModal(false)}
                className="text-ink-secondary hover:text-ink text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* 터미널 영역 - 일괄(3분할 세로 터미널)과 개별(단일 터미널) 렌더링 분기 */}
            <div className="flex-1 my-4 flex gap-4 overflow-hidden h-[380px]">
              {simMode === 'all' ? (
                // 1) 모든 조건 일괄 심의 모드 (삼분할 세로 터미널 스택 구조)
                ['top1', 'top2', 'top3'].map(tab => (
                  <div key={tab} className="flex-1 flex flex-col gap-1.5 h-full">
                    <span className="text-[10px] font-bold text-ink-secondary truncate">
                      [{tab.toUpperCase()}] {selectedParcel[tab].jibun.split(' ')[0]} ...
                    </span>
                    <div className="flex-1 bg-secondary rounded-xl p-3 overflow-y-auto font-mono text-[10px] flex flex-col gap-2.5 border border-indigo-950 shadow-inner text-white">
                      {simLogs[tab].map((log, index) => (
                        <div key={index} className="flex flex-col gap-0.5 border-b border-white/5 pb-1">
                          <span className={`font-semibold shrink-0 ${
                            log.sender.startsWith('시스템') ? 'text-cyan-300' :
                            log.sender.includes('반대') ? 'text-rose-300' :
                            log.sender.includes('찬성') ? 'text-emerald-300' : 'text-indigo-200'
                          }`}>
                            [{log.sender}]
                          </span>
                          <span className="text-gray-200 leading-relaxed">{log.text}</span>
                        </div>
                      ))}
                      {isSimulating && simLogs[tab].length === 0 && (
                        <div className="text-indigo-300 animate-pulse">심의 연결 대기 중...</div>
                      )}
                      {isSimulating && simLogs[tab].length > 0 && (
                        <div className="text-indigo-200 animate-pulse text-[9px]">● 에이전트 분석 진행 중...</div>
                      )}
                      <div ref={tab === 'top1' ? simEndRefTop1 : tab === 'top2' ? simEndRefTop2 : simEndRefTop3} />
                    </div>
                  </div>
                ))
              ) : (
                // 2) 개별 심의 모드 (단일 넓은 터미널 뷰 구조)
                <div className="flex-1 flex flex-col gap-1.5 h-full">
                  <span className="text-[10px] font-bold text-ink-secondary">
                    [{simTarget.toUpperCase()}] {selectedParcel[simTarget].jibun}
                  </span>
                  <div className="flex-1 bg-secondary rounded-xl p-4 overflow-y-auto font-mono text-xs flex flex-col gap-3 border border-indigo-950 shadow-inner text-white">
                    {simLogs[simTarget].map((log, index) => (
                      <div key={index} className="flex gap-2">
                        <span className={`font-semibold shrink-0 ${
                          log.sender.startsWith('시스템') ? 'text-cyan-300' :
                          log.sender.includes('반대') ? 'text-rose-300' :
                          log.sender.includes('찬성') ? 'text-emerald-300' : 'text-indigo-200'
                        }`}>
                          [{log.sender}]
                        </span>
                        <span className="text-gray-100">{log.text}</span>
                      </div>
                    ))}
                    {isSimulating && (
                      <div className="text-indigo-200 animate-pulse">... 에이전트 심의 분석 진행 중 ...</div>
                    )}
                    <div ref={simTarget === 'top1' ? simEndRefTop1 : simTarget === 'top2' ? simEndRefTop2 : simEndRefTop3} />
                  </div>
                </div>
              )}
            </div>

            {/* 하단 제어 바 영역 */}
            <div className="flex justify-between items-center border-t border-hairline pt-3">
              <span className="text-[10px] text-ink-secondary">
                {simMode === 'all' ? "* 모든 후보지의 모의 토론이 독립 채널을 통해 동시 진행됩니다." : `도로점용료 예상액: ₩ ${Math.round(selectedParcel[simTarget].area * selectedParcel[simTarget].price * 0.02 * (365/365)).toLocaleString()} / 년`}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSimModal(false);
                    setPipelineStep(5); // 심의 완료 후 Step 5 최종 보고서 탭으로 즉시 자동 이동
                  }}
                  disabled={isSimulating}
                  className="btn-primary text-xs px-6 py-2.5 disabled:opacity-40"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 공무원 로그인 & 회원가입 통합 인증 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-glass-crisp">
          <div className="w-[400px] glass-panel-deep p-6 flex flex-col gap-4 rounded-2xl">
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <h3 className="text-sm font-semibold text-ink">
                {authMode === 'login' ? '🔑 도시행정망 실무자 인증' : '📝 신규 실무자 계정 등록'}
              </h3>
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  setEmail('');
                  setPassword('');
                  setUsername('');
                }} 
                className="text-ink-secondary hover:text-ink text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* 로그인 / 회원가입 전환 탭 */}
            <div className="flex gap-2 border-b border-hairline pb-3">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setPassword('');
                }}
                className={`flex-1 text-[11px] py-2 rounded-lg font-semibold transition-all cursor-pointer border ${
                  authMode === 'login' 
                    ? 'bg-primary/10 text-primary border-primary/20' 
                    : 'bg-transparent text-ink-secondary hover:text-ink border-transparent'
                }`}
              >
                로그인 모드
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setPassword('');
                }}
                className={`flex-1 text-[11px] py-2 rounded-lg font-semibold transition-all cursor-pointer border ${
                  authMode === 'register' 
                    ? 'bg-primary/10 text-primary border-primary/20' 
                    : 'bg-transparent text-ink-secondary hover:text-ink border-transparent'
                }`}
              >
                회원가입 모드
              </button>
            </div>

            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-ink-secondary">소속 자치구 / 부서</span>
                <select 
                  value={department} 
                  onChange={(e) => setDepartment(e.target.value)}
                  className="text-input-notion w-full"
                >
                  <option value="용산구 스마트도시과">용산구 스마트도시과</option>
                  <option value="용산구 도시계획과">용산구 도시계획과</option>
                  <option value="용산구 보건위생과">용산구 보건위생과</option>
                </select>
              </div>

              {authMode === 'register' && (
                <div className="flex flex-col gap-1 text-xs">
                  <span className="text-ink-secondary">실무자 이름</span>
                  <input 
                    type="text" 
                    placeholder="홍길동 주무관"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="text-input-notion"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1 text-xs">
                <span className="text-ink-secondary">행정 이메일</span>
                <input 
                  type="email" 
                  placeholder="admin@yongsan.go.kr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-input-notion"
                />
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <span className="text-ink-secondary">행정망 비밀번호</span>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-input-notion"
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full text-xs py-2.5"
              >
                {authMode === 'login' ? '행정망 접속 승인' : '신규 실무자 등록 신청'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 조례 RAG 관리 모달 */}
      {showRegulationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 text-glass-crisp">
          <div className="w-[550px] glass-panel-deep p-6 flex flex-col gap-5 border border-hairline rounded-2xl">
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">⚖️ 법규 RAG 지식베이스 관리</h3>
                <p className="text-[10px] text-ink-secondary mt-0.5">RAG에 활용될 조례 PDF 목록을 관리하고 다중 업로드합니다.</p>
              </div>
              <button 
                onClick={() => setShowRegulationModal(false)} 
                className="text-ink-secondary hover:text-ink text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* 다중 파일 드롭존 / 업로드 영역 */}
            <div className="bg-white/50 border border-hairline p-4 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-ink-secondary">조례 PDF 다중 업로드</span>
                <span className="text-[10px] text-ink-secondary font-mono">PDF 파일만 허용</span>
              </div>
              <div className="relative border-2 border-dashed border-hairline hover:border-primary rounded-lg p-5 text-center cursor-pointer transition-all bg-white/40">
                <input 
                  type="file" 
                  multiple 
                  accept=".pdf"
                  onChange={handleRegulationUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
                <p className="text-xs text-ink font-medium">📁 PDF 파일 일괄 드래그 또는 클릭</p>
                <p className="text-[10px] text-ink-secondary mt-1">동일 파일명 업로드 시 중복 방지 가드가 작동합니다.</p>
              </div>
              {isUploading && <p className="text-[10px] text-primary animate-pulse text-center">조례 분석 및 RAG 임베딩 텍스트 파싱 중...</p>}
            </div>

            {/* 조례 리스트 테이블 */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-ink-secondary">📋 적재된 조례 목록 ({regulationsList.length}건)</span>
              <div className="max-h-[220px] overflow-y-auto bg-white/50 rounded-xl border border-hairline p-2">
                {regulationsList.length === 0 ? (
                  <p className="text-center text-xs text-ink-secondary py-6">적재된 조례 문서가 없습니다.</p>
                ) : (
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-hairline text-ink-secondary font-medium">
                        <th className="pb-2 pl-2">파일명</th>
                        <th className="pb-2">크기 (KB)</th>
                        <th className="pb-2 text-right pr-2">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regulationsList.map((item, idx) => (
                        <tr key={idx} className="border-b border-hairline hover:bg-gray-100 text-ink">
                          <td className="py-2 pl-2 max-w-[280px] truncate" title={item.filename}>{item.filename}</td>
                          <td className="py-2">{(item.size / 1024).toFixed(1)} KB</td>
                          <td className="py-2 text-right pr-2">
                            <button 
                              onClick={() => handleRegulationDelete(item.filename)}
                              className="text-rose-500 hover:text-rose-600 font-bold hover:scale-110 transition-all cursor-pointer"
                              title="조례 및 RAG 캐시 삭제"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
