'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

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

  // 4. AI 시뮬레이션 상태
  const [showSimModal, setShowSimModal] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simLogs, setSimLogs] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // 5. 로그인 모달 상태
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [municipalId, setMunicipalId] = useState('');
  const [department, setDepartment] = useState('스마트도시과');

  // 조례 RAG 관리 모달 관련 상태
  const [showRegulationModal, setShowRegulationModal] = useState(false);
  const [regulationsList, setRegulationsList] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const simEndRef = useRef(null);

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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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
  }, [leafletLoaded, pipelineStep]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 최종 시뮬레이션 결과 단독 로드 API
  const fetchSimulationResults = async (parcelId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/simulation/results/${parcelId}`);
      if (res.ok) {
        const data = await res.json();
        // 백엔드 통계 데이터로 해당 필지 상태 갱신
        setSelectedParcel(prev => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
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

  // AI 모의 심의 대사 인입 시 터미널 스크롤 최하단 자동 갱신
  useEffect(() => {
    if (simEndRef.current) {
      simEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simLogs]);

  // AI 시뮬레이션 개시 (EventSource SSE 실시간 연동)
  const runSimulation = () => {
    setShowSimModal(true);
    setSimStep(0);
    setSimLogs([]);
    setIsSimulating(true);

    const activeParcel = selectedParcel[activeTab];
    const parcelId = activeParcel.id;

    // EventSource 커넥션 생성
    const eventSource = new EventSource(`http://localhost:8000/api/v1/simulation/stream?parcel_id=${parcelId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 실시간 대사 누적 및 스텝 갱신
        setSimLogs(prev => [...prev, { sender: data.sender, text: data.text }]);
        setSimStep(prev => prev + 1);

        // 마지막 패킷 수신 시 연결 종료 및 최종 결과 로드
        if (data.is_finished) {
          eventSource.close();
          setIsSimulating(false);
          fetchSimulationResults(parcelId);
        }
      } catch (err) {
        console.error("SSE 파싱 에러:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE 통신 에러 (서버 연결 실패 또는 종료):", err);
      eventSource.close();
      setIsSimulating(false);
      // 에러 시 폴백 시뮬레이션 결과라도 갱신
      fetchSimulationResults(parcelId);
    };
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

  // 로그인 처리
  const handleLogin = (e) => {
    e.preventDefault();
    if (!municipalId.trim()) {
      alert('공무원 ID를 입력해주세요.');
      return;
    }
    setIsLoggedIn(true);
    setShowLoginModal(false);
  };

  // Step 1 파일 드롭 모사 및 AI 감리 수행 (실물 CSV API 연동)
  const triggerFileAudit = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext !== 'csv') {
        alert('⚠️ 파일 유형 제한: Step 1 사전 감리 파이프라인에는 오직 CSV 파일만 업로드할 수 있습니다.');
        return;
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
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
          alert('AI 사전 감리가 완료되었습니다. 추출된 감사 사유 및 사용자 의도를 Step 2에서 확인하십시오.');
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
    <div className="relative min-h-screen overflow-hidden text-slate-100 font-sans">
      
      {/* 1. 상단 글로벌 네비게이션 헤더 */}
      <header className="absolute top-0 left-0 right-0 h-16 glass-panel rounded-none border-t-0 border-x-0 z-45 px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-white">OmniSite</span>
          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">B2G SDSS v1.0</span>
        </div>
        <nav className="flex items-center gap-8 text-xs font-semibold">
          <Link href="/" className="text-white border-b-2 border-blue-500 pb-1">입지분석 메인 (Map)</Link>
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition-all pb-1">이력 대시보드 (Analytics)</Link>
          <button 
            onClick={() => setShowRegulationModal(true)} 
            className="text-slate-400 hover:text-white transition-all pb-1 cursor-pointer flex items-center gap-1.5"
          >
            ⚖️ 법규 RAG 관리
          </button>
        </nav>
        <div>
          {isLoggedIn ? (
            <span className="text-xs text-slate-300 font-medium">{department} | {municipalId}</span>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold cursor-pointer transition-all"
            >
              공무원 로그인
            </button>
          )}
        </div>
      </header>

      {/* 2. 인터랙티브 Leaflet GIS 3D 맵 공간 영역 (Map Container) */}
      <div id="interactive-map" className="map-container w-full h-full" />

      {/* 3. 좌측 플로팅 패널: 일괄 업로드 및 AHP 가중치 제어 (Upload & AHP Control Panel) */}
      <div className="floating-overlay left-6 top-20 w-96 glass-panel p-6 flex flex-col gap-6 max-h-[82vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-white mb-0.5">입지선정 기준 설정</h2>
            <p className="text-[10px] text-slate-400">데이터 적재 및 가중치 의사결정 수립</p>
          </div>
          <span className="text-xs bg-blue-600/20 text-blue-400 px-2.5 py-1 rounded-full font-bold">
            Step {pipelineStep} / 5
          </span>
        </div>

        {/* [Step 1] 데이터 일괄 업로드 및 AI 감리 의도 검증 */}
        <div className={`flex flex-col gap-3 transition-all duration-300 ${pipelineStep !== 1 ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-300">Step 1. CSV 수집 & AI 감리</label>
            <span className="text-[10px] text-blue-400 font-mono">CSV 파일 전용</span>
          </div>

          {!isAuditComplete ? (
            <div 
              onClick={triggerFileAudit}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-5 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-900/30"
            >
              <p className="text-xs text-slate-300 font-semibold">📁 CSV 파일 일괄 드래그앤드롭</p>
              <p className="text-[10px] text-slate-500 mt-1">AI 감리 및 가중치 추출 개시</p>
            </div>
          ) : (
            /* AI 감리 결과 판독 및 실무자 의도 승인 루프 */
            <div className="bg-slate-950/60 p-4 rounded-xl border border-blue-500/30 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                <span className="text-[11px] text-blue-400 font-bold">✓ AI 사전 감리 완료</span>
                <span className="text-[10px] text-slate-500">LLM 의도 매핑 성공</span>
              </div>
              <div className="text-[11px] flex flex-col gap-2 text-slate-300 leading-relaxed">
                <p><strong className="text-slate-400">감리 사유:</strong> {auditReason}</p>
                <p><strong className="text-slate-400">추출된 의도:</strong> {userIntent}</p>
              </div>
              <button
                onClick={() => setPipelineStep(2)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold py-2 rounded-lg transition-all"
              >
                추출 의도 확인 및 검증 단계 진입 (Approve)
              </button>
            </div>
          )}
        </div>

        {/* [Step 3] AHP 슬라이더 컨트롤러 */}
        <div className={`flex flex-col gap-4 border-t border-slate-800/80 pt-4 transition-all duration-300 ${pipelineStep < 3 ? 'opacity-20 pointer-events-none' : ''} ${pipelineStep > 3 ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-300">Step 3. AHP 인자별 상대 가중치</label>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold transition-all ${Object.keys(ahpWeights).length === 0 ? 'bg-slate-500/20 text-slate-400' : crValue < 0.1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              C.R. = {Object.keys(ahpWeights).length === 0 ? '-' : crValue} ({Object.keys(ahpWeights).length === 0 ? '대기' : crValue < 0.1 ? '만족' : '위배'})
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {Object.keys(ahpWeights).map(key => (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{key}</span>
                  <span className="font-mono text-white">{ahpWeights[key]}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="9"
                  disabled={isAhpLocked || pipelineStep !== 3}
                  value={ahpWeights[key]}
                  onChange={(e) => handleSliderChange(key, e.target.value)}
                  className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none"
                />
              </div>
            ))}
          </div>

          {/* AHP 잠금 버튼 -> 입지 분석 트리거 */}
          <button
            onClick={handleAhpLock}
            disabled={crValue >= 0.1 || pipelineStep !== 3 || Object.keys(ahpWeights).length === 0}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-30"
          >
            🔒 AHP 가중치 확정 및 추천 입지 연산 (Lock)
          </button>

          {isAhpLocked && (
            <button
              onClick={() => {
                setIsAhpLocked(false);
                setPipelineStep(3);
                alert("AHP 가중치 잠금이 해제되었습니다. 가중치를 재조정한 뒤 다시 Lock을 걸어 공간 차집합 연산을 가동하십시오.");
              }}
              className="w-full mt-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-slate-700/80"
            >
              🔓 AHP 가중치 잠금 해제 (Unlock)
            </button>
          )}
        </div>
      </div>

      {/* 4. 우측 플로팅 패널: 후보지 탭 및 속성 정보 카드 (Information & HITL Panel) */}
      <div className="floating-overlay right-6 top-20 w-96 glass-panel p-6 flex flex-col gap-5 max-h-[82vh] overflow-y-auto">
        
        {/* [Step 2] 하이브리드 HITL: 탐색 의도 및 물리 좌표 동시 보정 영역 */}
        {pipelineStep === 2 && (
          <div className="flex flex-col gap-3">
            <div className="border-b border-slate-800 pb-2">
              <h2 className="text-xs font-bold text-amber-500">Step 2. 하이브리드 공간 및 의도 보정 (HITL)</h2>
              <p className="text-[10px] text-slate-400 font-medium">지도의 주황색 핀을 드래그하거나 아래 폼에서 피드백을 보정하세요.</p>
            </div>
            
            <div className="bg-slate-950/40 p-4 rounded-xl border border-amber-500/30 flex flex-col gap-3">
              {/* 1. 탐색 의도 보정 */}
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400 font-semibold">1. 정보 탐색 의도 및 목적 수정</span>
                <textarea 
                  rows={3}
                  value={userIntent} 
                  onChange={(e) => setUserIntent(e.target.value)} 
                  className="bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
                <span className="text-[9px] text-slate-500">* 의도 데이터는 로컬 브라우저 세션에만 보안 격리 저장됩니다.</span>
              </div>

              {/* 2. 지번 및 위경도 보정 */}
              <div className="flex flex-col gap-2.5 border-t border-slate-800/80 pt-2.5">
                <span className="text-[11px] text-slate-400 font-semibold">2. 공간 좌표 및 임시 지번 보정</span>
                
                <div className="flex flex-col gap-1 text-xs">
                  <span className="text-slate-500">지번 주소</span>
                  <input 
                    type="text" 
                    value={hitlJibun} 
                    onChange={(e) => setHitlJibun(e.target.value)} 
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs outline-none focus:border-amber-500"
                  />
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1 flex flex-col gap-1 text-[11px]">
                    <span className="text-slate-500">경도(Lng)</span>
                    <input type="number" step="0.000001" value={hitlLng} onChange={(e) => setHitlLng(parseFloat(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1 text-[11px]">
                    <span className="text-slate-500">위도(Lat)</span>
                    <input type="number" step="0.000001" value={hitlLat} onChange={(e) => setHitlLat(parseFloat(e.target.value))} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs" />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleHitlCommit}
                className="w-full mt-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 rounded-lg transition-all cursor-pointer"
              >
                보정 완료 및 데이터 확정 (Commit)
              </button>
            </div>
          </div>
        )}

        {/* [Step 4 & 5] 최적 추천 후보지 리스트 정보 */}
        {pipelineStep >= 4 ? (
          <div className="flex flex-col gap-5">
            {/* Top 1 ~ Top 3 탭 */}
            <div className="flex bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
              {['top1', 'top2', 'top3'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {/* 필지 속성 카드 */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-slate-300">Step 4. 추천지 속성 정보</h3>
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/40 flex flex-col gap-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">지번 / 소유 구분</span>
                  <span className="text-white font-semibold">{selectedParcel[activeTab].jibun}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">면적(㎡)</span>
                  <span className="font-mono text-white">{selectedParcel[activeTab].area} ㎡</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">공시지가</span>
                  <span className="font-mono text-emerald-400">₩ {selectedParcel[activeTab].price.toLocaleString()} / ㎡</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-slate-900 pt-2 text-slate-500">
                  <span>위도/경도 좌표</span>
                  <span className="font-mono">{selectedParcel[activeTab].lat}, {selectedParcel[activeTab].lng}</span>
                </div>
              </div>
            </div>

            {/* 갈등 민감도 카드 */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">지역 갈등 민감도 (CSS)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedParcel[activeTab].cssGrade === '상' ? 'bg-rose-500/20 text-rose-400' :
                  selectedParcel[activeTab].cssGrade === '중' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  등급: {selectedParcel[activeTab].cssGrade} ({selectedParcel[activeTab].css}점)
                </span>
              </div>

              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${
                  selectedParcel[activeTab].cssGrade === '상' ? 'bg-rose-500' :
                  selectedParcel[activeTab].cssGrade === '중' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`} style={{ width: `${selectedParcel[activeTab].css}%` }} />
              </div>
            </div>

            {/* [Step 5] AI 모의 토론 및 WeasyPrint PDF 발급 */}
            <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-300">Step 5. 의사결정 시뮬레이션</span>
              <button 
                onClick={() => {
                  setPipelineStep(5);
                  runSimulation();
                }}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-900/30"
              >
                {activeTab.toUpperCase()} 갈등 심의 시뮬레이터 실행 (GPT-4o)
              </button>
            </div>
          </div>
        ) : (
          pipelineStep !== 2 && (
            <div className="text-center py-20 text-slate-500 text-xs">
              [Step 1] 데이터 적재 및 <br />
              [Step 3] AHP 가중치 잠금을 진행하시면<br />
              이곳에 공간 차집합 추천 결과가 출력됩니다.
            </div>
          )
        )}
      </div>

      {/* AI 시뮬레이션 모달 팝업 */}
      {showSimModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="w-[800px] h-[550px] glass-panel p-6 flex flex-col justify-between">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">OMS-01-03-001 | AI 에이전트 실시간 모의 심의 토론</h3>
                <p className="text-[10px] text-slate-500">Target PNU: {selectedParcel[activeTab].pnu}</p>
              </div>
              <button 
                onClick={() => setShowSimModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* 터미널 대화 스크롤 */}
            <div className="flex-1 my-4 bg-slate-950/70 rounded-xl p-4 overflow-y-auto font-mono text-xs flex flex-col gap-3 border border-slate-900/80">
              {simLogs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className={`font-semibold shrink-0 ${
                    log.sender.startsWith('시스템') ? 'text-blue-400' :
                    log.sender.includes('반대') ? 'text-rose-400' :
                    log.sender.includes('찬성') ? 'text-emerald-400' : 'text-slate-300'
                  }`}>
                    [{log.sender}]
                  </span>
                  <span className="text-slate-200">{log.text}</span>
                </div>
              ))}
              {isSimulating && (
                <div className="text-slate-500 animate-pulse">... 에이전트 심의 분석 진행 중 ...</div>
              )}
              <div ref={simEndRef} />
            </div>

            {/* 하단 제어 바 (보고서 다운로드 포함) */}
            <div className="flex justify-between items-center border-t border-slate-800 pt-3">
              <span className="text-[10px] text-slate-500">
                도로점용료 예상액: ₩ {Math.round(selectedParcel[activeTab].area * selectedParcel[activeTab].price * 0.02 * (365/365)).toLocaleString()} / 년
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isSimulating}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  📝 WeasyPrint PDF 보고서 다운로드
                </button>
                <button
                  onClick={() => setShowSimModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 공무원 로그인 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="w-[400px] glass-panel p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-300">도시행정망 실무자 인증</h3>
              <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">소속 자치구 / 부서</span>
                <select 
                  value={department} 
                  onChange={(e) => setDepartment(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="용산구 스마트도시과">용산구 스마트도시과</option>
                  <option value="용산구 도시계획과">용산구 도시계획과</option>
                  <option value="용산구 보건위생과">용산구 보건위생과</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">공무원 행정 ID</span>
                <input 
                  type="text" 
                  placeholder="admin_yongsan"
                  value={municipalId}
                  onChange={(e) => setMunicipalId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-lg transition-all"
              >
                행정망 접속 승인
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 조례 RAG 관리 모달 */}
      {showRegulationModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="w-[550px] glass-panel p-6 flex flex-col gap-5 border border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">⚖️ 법규 RAG 지식베이스 관리</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">RAG에 활용될 조례 PDF 목록을 관리하고 다중 업로드합니다.</p>
              </div>
              <button 
                onClick={() => setShowRegulationModal(false)} 
                className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* 다중 파일 드롭존 / 업로드 영역 */}
            <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-slate-300">조례 PDF 다중 업로드</span>
                <span className="text-[10px] text-slate-500 font-mono">PDF 파일만 허용</span>
              </div>
              <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-lg p-5 text-center cursor-pointer transition-all bg-slate-900/40">
                <input 
                  type="file" 
                  multiple 
                  accept=".pdf"
                  onChange={handleRegulationUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
                <p className="text-xs text-slate-300 font-medium">📁 PDF 파일 일괄 드래그 또는 클릭</p>
                <p className="text-[10px] text-slate-500 mt-1">동일 파일명 업로드 시 중복 방지 가드가 작동합니다.</p>
              </div>
              {isUploading && <p className="text-[10px] text-blue-400 animate-pulse text-center">조례 분석 및 RAG 임베딩 텍스트 파싱 중...</p>}
            </div>

            {/* 조례 리스트 테이블 */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-slate-300">📋 적재된 조례 목록 ({regulationsList.length}건)</span>
              <div className="max-h-[220px] overflow-y-auto bg-slate-950/60 rounded-xl border border-slate-800/80 p-2">
                {regulationsList.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">적재된 조례 문서가 없습니다.</p>
                ) : (
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-medium">
                        <th className="pb-2 pl-2">파일명</th>
                        <th className="pb-2">크기 (KB)</th>
                        <th className="pb-2 text-right pr-2">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regulationsList.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-900/50 hover:bg-slate-900/30 text-slate-300">
                          <td className="py-2 pl-2 max-w-[280px] truncate" title={item.filename}>{item.filename}</td>
                          <td className="py-2">{(item.size / 1024).toFixed(1)} KB</td>
                          <td className="py-2 text-right pr-2">
                            <button 
                              onClick={() => handleRegulationDelete(item.filename)}
                              className="text-rose-400 hover:text-rose-500 font-bold hover:scale-110 transition-all cursor-pointer"
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
