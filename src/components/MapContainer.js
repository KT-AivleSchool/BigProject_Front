import React, { useState, useEffect, useRef } from 'react';

export default function MapContainer({
  activeView,
  pipelineStep,
  hitlLat,
  hitlLng,
  setHitlLat,
  setHitlLng,
  selectedParcel,
  activeTab,
  setActiveTab
}) {
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const geojsonLayerRef = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const isValidCoordinate = (lat, lng) => {
    if (lat === null || lat === undefined || isNaN(lat) || lat === 0) return false;
    if (lng === null || lng === undefined || isNaN(lng) || lng === 0) return false;
    if (lat < 33.0 || lat > 39.0 || lng < 124.0 || lng > 132.0) return false;
    return true;
  };


  const fetchScreenedLands = async (districtId = 1) => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    try {
      const res = await fetch(`http://localhost:8000/api/v1/lands/screen-candidate?district_id=${districtId}&exclusion_meters=10.0`);
      if (!res.ok) {
        console.error("지적도 가용 필지 스크리닝 로드 실패");
        return;
      }
      const data = await res.json();
      const candidates = data.candidates || [];

      if (geojsonLayerRef.current) {
        map.removeLayer(geojsonLayerRef.current);
      }

      const bounds = map.getBounds();
      
      const geojsonFeatures = candidates
        .filter(c => {
          if (!c.usable_geometry) return false;
          if (c.usable_geometry.type === "Polygon") {
            const coords = c.usable_geometry.coordinates[0][0];
            if (coords && coords.length >= 2) {
              const latLng = L.latLng(coords[1], coords[0]);
              return bounds.contains(latLng);
            }
          }
          return true;
        })
        .map(c => ({
          type: "Feature",
          properties: {
            land_id: c.land_id,
            pnu: c.pnu,
            jibun: c.jibun,
            original_area: c.original_area_m2
          },
          geometry: c.usable_geometry
        }));

      const geojsonLayer = L.geoJSON(geojsonFeatures, {
        style: {
          color: "hsl(28, 91%, 54%)",
          weight: 1.5,
          fillColor: "hsl(28, 91%, 54%)",
          fillOpacity: 0.15,
          dashArray: "3"
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(`
            <div style="font-size:11px; padding:2px; color:#111;">
              <strong>지번:</strong> ${feature.properties.jibun}<br/>
              <strong>PNU:</strong> ${feature.properties.pnu}<br/>
              <strong>면적:</strong> ${feature.properties.original_area} ㎡
            </div>
          `);
        }
      }).addTo(map);

      geojsonLayerRef.current = geojsonLayer;
    } catch (err) {
      console.error("지적도 데이터 페이징 렌더링 에러:", err);
    }
  };

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

  useEffect(() => {
    if (!leafletLoaded) return;
    const L = window.L;
    if (!L) return;

    if (!mapRef.current) {
      const map = L.map('interactive-map', {
        zoomControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true
      }).setView([37.5302, 126.9724], 14);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);

      mapRef.current = map;
      
      map.on('moveend', () => {
        fetchScreenedLands(1);
      });
      fetchScreenedLands(1);

    }

    const map = mapRef.current;
    if (map) {
      map.dragging.enable();
      if (map.touchZoom) map.touchZoom.enable();
      if (map.doubleClickZoom) map.doubleClickZoom.enable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
      if (map.boxZoom) map.boxZoom.enable();
      if (map.keyboard) map.keyboard.enable();
      
      if (activeView === 'map') {
        setTimeout(() => {
          map.invalidateSize();
        }, 50);
      }
    }

    Object.values(markersRef.current).forEach(m => {
      if (m && typeof m.remove === 'function') {
        m.remove();
      }
    });
    markersRef.current = {};

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

      const marker = L.marker([hitlLat, hitlLng], {
        icon: markerIcon,
        draggable: true,
        autoPan: false
      }).addTo(map);

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

      marker.on('dragstart', () => {
        map.dragging.disable();
      });

      marker.isWarning = false;

      marker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        const distSubway = pos.distanceTo(L.latLng(37.5290, 126.9680));
        const distSchool = pos.distanceTo(L.latLng(37.5315, 126.9740));
        const distMilitary = pos.distanceTo(L.latLng(37.5240, 126.9650));

        const shouldWarn = (distSubway < 30 || distSchool < 200 || distMilitary < 400);

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

      marker.on('dragend', () => {
        map.dragging.enable();
        const newPos = marker.getLatLng();
        const distSubway = newPos.distanceTo(L.latLng(37.5290, 126.9680));
        const distSchool = newPos.distanceTo(L.latLng(37.5315, 126.9740));
        const distMilitary = newPos.distanceTo(L.latLng(37.5240, 126.9650));

        if (distSubway < 30 || distSchool < 200 || distMilitary < 400) {
          alert('⚠️ 경고: 해당 지점은 법정 금역 구역(지하철/학교/군사보호구역)에 침범합니다. 안전한 구역으로 위치를 복원합니다.');
          marker.setLatLng([hitlLat, hitlLng]);
          marker.setIcon(markerIcon);
          marker.isWarning = false;
          return;
        }

        setHitlLat(parseFloat(newPos.lat.toFixed(4)));
        setHitlLng(parseFloat(newPos.lng.toFixed(4)));
      });

      markersRef.current['temp'] = marker;
      markersRef.current['subway'] = subwayBuffer;
      markersRef.current['school'] = schoolBuffer;
      markersRef.current['military'] = militaryBuffer;
      map.panTo([hitlLat, hitlLng]);

    } else if (pipelineStep >= 4) {
      Object.keys(selectedParcel).forEach(key => {
        const parcel = selectedParcel[key];

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

  return (
    <div 
      id="interactive-map" 
      className="map-container w-full h-full transition-opacity duration-300" 
      style={{ 
        opacity: activeView === 'map' ? 1 : 0, 
        pointerEvents: activeView === 'map' ? 'auto' : 'none', 
        zIndex: activeView === 'map' ? 1 : -1 
      }} 
    />
  );
}
