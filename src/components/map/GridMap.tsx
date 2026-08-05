"use client";

/**
 * 점수 격자 + Top-N 지도 — **의존성 없이 canvas 로 직접 그린다.**
 * ==============================================================
 * 왜 Leaflet 을 안 썼나. 세 가지다.
 *
 *  1. **폐쇄망.** B2G 납품 환경에서 외부 타일 서버가 열려 있으리라 가정할 수
 *     없다. 라이브러리를 깔면 배경지도가 없을 때 화면이 통째로 비어 보인다.
 *     여기서는 배경지도를 **꺼도** 격자와 후보지가 그대로 보인다.
 *  2. **셀이 6,797개다.** 실측 `score_grid.count`. Leaflet 의 `Rectangle` 은
 *     하나가 DOM 요소 하나라 수천 개를 놓으면 팬/줌이 죽는다. canvas 는 한 장이다.
 *  3. 필요한 건 사각형 채우기와 원 찍기뿐이다. 그걸 위해 패키지를 늘리지 않는다.
 *
 * 🔴 격자는 산출물에 **중심점만** 있다(`cells[i] = [경도, 위도, 점수, 배제여부]`).
 *    사각형은 `spacing_m` 으로 **여기서** 만든다. 산출물에 없는 폴리곤을
 *    있는 것처럼 취급하지 않는다.
 *
 * 🔴 좌표계는 저장 규약대로 EPSG:4326 이다(`score_grid.crs` 로 확인한다).
 *    다른 값이 오면 그리지 않고 그 사실을 화면에 띄운다 — 좌표계 추측은
 *    이 프로젝트에서 실제로 사고가 났던 지점이다(공간조인 0건 → 지표 전부 0).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScoreGridDoc, TopNCsvRow } from "@/lib/omnisite/types";

const TILE_SIZE = 256;
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;

/** OSM 표준 타일. 폐쇄망이면 못 뜬다 — 그래서 끌 수 있고, 못 뜨면 말해 준다. */
const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

// ── 웹 메르카토르 ────────────────────────────────────────────────
function lonToWorldX(lon: number, z: number): number {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** z;
}
function latToWorldY(lat: number, z: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE_SIZE * 2 ** z;
}
function worldXToLon(x: number, z: number): number {
  return (x / (TILE_SIZE * 2 ** z)) * 360 - 180;
}
function worldYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * 2 ** z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
/** 이 위도·줌에서 1픽셀이 몇 m 인가. 격자 사각형 크기를 여기서 낸다. */
function metersPerPixel(lat: number, z: number): number {
  return (156543.03392804097 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

/** 점수 → 색. 낮음(연회색) → 높음(파랑). 배제 셀은 이 램프를 안 쓴다. */
function scoreColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  // #e9edf2 → #0075de 선형 보간. 단조롭게 밝기만 바꾼다(색맹 안전).
  const r = Math.round(233 + (0 - 233) * c);
  const g = Math.round(237 + (117 - 237) * c);
  const b = Math.round(242 + (222 - 242) * c);
  return `rgb(${r},${g},${b})`;
}

interface View {
  lon: number;
  lat: number;
  z: number;
}

/**
 * 격자 전체가 들어가는 시점. 격자가 없거나 크기를 아직 모르면 null.
 *
 * 🔴 이걸 **effect 안에서 `setView`** 로 하고 있었다(`if (view) return;` 가드).
 *    React 19 의 `react-hooks/set-state-in-effect` 가 이걸 잡는데, 규칙이
 *    까다로워서가 아니라 실제로 렌더를 한 번 더 돌리고 그 사이 **빈 화면이
 *    한 프레임 지나간다.** 초기 시점은 `grid`·`size` 로부터 **계산되는 값**이지
 *    상태가 아니다. 사람이 팬/줌 한 것만 상태로 둔다(`userView`).
 *    그래서 `view = userView ?? fit(...)` 이고, 격자가 바뀌면 자동으로 다시 맞춰진다.
 */
function fitView(grid: ScoreGridDoc, size: { w: number; h: number }): View | null {
  if (grid.cells.length === 0 || size.w === 0) return null;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const c of grid.cells) {
    if (c[0] < minLon) minLon = c[0];
    if (c[0] > maxLon) maxLon = c[0];
    if (c[1] < minLat) minLat = c[1];
    if (c[1] > maxLat) maxLat = c[1];
  }
  let z = MAX_ZOOM;
  while (z > MIN_ZOOM) {
    const w = lonToWorldX(maxLon, z) - lonToWorldX(minLon, z);
    const h = latToWorldY(minLat, z) - latToWorldY(maxLat, z);
    if (w <= size.w * 0.92 && h <= size.h * 0.92) break;
    z -= 1;
  }
  return { lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2, z };
}

export interface GridMapProps {
  grid: ScoreGridDoc;
  topn: TopNCsvRow[];
  /** 선택된 순위(1-based). null 이면 선택 없음. */
  selected: number | null;
  onSelect: (rank: number | null) => void;
  showExcluded: boolean;
  showGrid: boolean;
  basemap: boolean;
  /** 배경지도 타일을 한 장도 못 받았을 때 알린다. */
  onTileError: () => void;
}

export function GridMap({
  grid,
  topn,
  selected,
  onSelect,
  showExcluded,
  showGrid,
  basemap,
  onTileError,
}: GridMapProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tiles = useRef(new Map<string, HTMLImageElement>());
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  /** 사람이 팬/줌 한 시점. 건드리기 전에는 null 이고 그동안은 자동 맞춤을 쓴다. */
  const [userView, setUserView] = useState<View | null>(null);
  const fitted = useMemo(() => fitView(grid, size), [grid, size]);
  const view = userView ?? fitted;

  // ── 크기 추적 ────────────────────────────────────────────────
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── 그리기 ───────────────────────────────────────────────────
  /**
   * 타일이 늦게 도착했을 때 다시 그리기 위한 통로.
   *
   * 🔴 원래 `img.onload = () => draw()` 였다. `draw` 자신의 본문에서 `draw` 를
   *    부르는 꼴이라 `react-hooks/immutability` 가 "선언 전 접근" 으로 잡는다.
   *    규칙을 피하려고 `setTimeout(…, 0)` 을 쓰지 않는다 — 그건 린트만 끄고
   *    같은 문제(오래된 클로저)를 남긴다. ref 에 **최신 draw** 를 넣어 두고
   *    onload 는 그때의 최신본을 부른다. onload 는 렌더 중이 아니라 이벤트라
   *    ref 를 읽어도 된다.
   */
  const drawRef = useRef<() => void>(() => {});

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !view || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== size.w * dpr || cv.height !== size.h * dpr) {
      cv.width = size.w * dpr;
      cv.height = size.h * dpr;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = "#f2f3f5";
    ctx.fillRect(0, 0, size.w, size.h);

    const { z } = view;
    // 화면 좌상단의 world 좌표.
    const originX = lonToWorldX(view.lon, z) - size.w / 2;
    const originY = latToWorldY(view.lat, z) - size.h / 2;
    const px = (lon: number) => lonToWorldX(lon, z) - originX;
    const py = (lat: number) => latToWorldY(lat, z) - originY;

    // 1) 배경 타일
    if (basemap) {
      const n = 2 ** z;
      const x0 = Math.floor(originX / TILE_SIZE);
      const y0 = Math.floor(originY / TILE_SIZE);
      const x1 = Math.floor((originX + size.w) / TILE_SIZE);
      const y1 = Math.floor((originY + size.h) / TILE_SIZE);
      for (let tx = x0; tx <= x1; tx++) {
        for (let ty = y0; ty <= y1; ty++) {
          if (ty < 0 || ty >= n) continue;
          const wx = ((tx % n) + n) % n;
          const key = `${z}/${wx}/${ty}`;
          let img = tiles.current.get(key);
          if (!img) {
            img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => drawRef.current();
            img.onerror = () => onTileError();
            img.src = TILE_URL(z, wx, ty);
            tiles.current.set(key, img);
          }
          if (img.complete && img.naturalWidth > 0) {
            ctx.globalAlpha = 0.85;
            ctx.drawImage(img, tx * TILE_SIZE - originX, ty * TILE_SIZE - originY, TILE_SIZE, TILE_SIZE);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // 2) 점수 격자. 사각형 한 변 = spacing_m / (m per px).
    if (showGrid) {
      const mpp = metersPerPixel(view.lat, z);
      const side = Math.max(1.5, grid.spacing_m / mpp);
      const span = Math.max(1e-9, grid.score_max - grid.score_min);
      for (const c of grid.cells) {
        const excluded = c[3] === 1;
        if (excluded && !showExcluded) continue;
        const x = px(c[0]) - side / 2;
        const y = py(c[1]) - side / 2;
        if (x < -side || y < -side || x > size.w || y > size.h) continue;
        if (excluded) {
          ctx.fillStyle = "rgba(190,60,60,0.30)";
        } else {
          ctx.fillStyle = scoreColor((c[2] - grid.score_min) / span);
          ctx.globalAlpha = 0.72;
        }
        ctx.fillRect(x, y, side, side);
        ctx.globalAlpha = 1;
      }
    }

    // 3) Top-N 마커
    for (const r of topn) {
      const x = px(r.경도);
      const y = py(r.위도);
      if (x < -20 || y < -20 || x > size.w + 20 || y > size.h + 20) continue;
      const on = selected === r.순위;
      const rad = on ? 14 : 11;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = on ? "#0075de" : "#ffffff";
      ctx.fill();
      ctx.lineWidth = on ? 3 : 2;
      ctx.strokeStyle = on ? "#004b8f" : "#0075de";
      ctx.stroke();
      ctx.fillStyle = on ? "#ffffff" : "#0075de";
      ctx.font = `600 ${on ? 12 : 11}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(r.순위), x, y + 0.5);
    }
  }, [view, size, grid, topn, selected, showExcluded, showGrid, basemap, onTileError]);

  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw]);

  // ── 조작 ─────────────────────────────────────────────────────
  function hitMarker(cx: number, cy: number): TopNCsvRow | null {
    if (!view) return null;
    const z = view.z;
    const originX = lonToWorldX(view.lon, z) - size.w / 2;
    const originY = latToWorldY(view.lat, z) - size.h / 2;
    for (const r of topn) {
      const dx = lonToWorldX(r.경도, z) - originX - cx;
      const dy = latToWorldY(r.위도, z) - originY - cy;
      if (dx * dx + dy * dy <= 196) return r;
    }
    return null;
  }

  function toLocal(e: React.MouseEvent): { x: number; y: number } {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  return (
    <div
      ref={boxRef}
      /* 🔴 커서를 `style={{ cursor: drag.current ? … }}` 로 정했었다 —
         렌더 중에 ref 를 읽는 것이라 React 19 가 막는다(값이 바뀌어도 리렌더가
         안 되니 어차피 안 맞는 코드였다). 드래그 상태를 state 로 승격시키면
         팬 중에 매 프레임 리렌더가 붙는다. CSS `:active` 가 같은 일을 공짜로 한다. */
      /* 🔴 여기 `map-canvas` 클래스가 붙어 있었다. `globals.css` 의 그 규칙이
         `position:absolute; inset:0` 이라 지도가 액자를 뚫고 뷰포트를 덮었다
         (레이어 밖 규칙이 Tailwind 의 `relative` 를 이긴다). 규칙째로 지웠다 —
         사유는 `globals.css` 같은 자리에 있다. 위치는 유틸리티로만 준다. */
      className="relative h-full w-full cursor-grab select-none overflow-hidden active:cursor-grabbing"
      onWheel={(e) => {
        if (!view) return;
        const dz = e.deltaY < 0 ? 1 : -1;
        const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.z + dz));
        if (z === view.z) return;
        // 커서 아래 지점을 고정한 채 확대한다.
        const { x, y } = toLocal(e);
        const oX = lonToWorldX(view.lon, view.z) - size.w / 2;
        const oY = latToWorldY(view.lat, view.z) - size.h / 2;
        const lon = worldXToLon(oX + x, view.z);
        const lat = worldYToLat(oY + y, view.z);
        const nX = lonToWorldX(lon, z) - (x - size.w / 2);
        const nY = latToWorldY(lat, z) - (y - size.h / 2);
        setUserView({ lon: worldXToLon(nX, z), lat: worldYToLat(nY, z), z });
      }}
      onMouseDown={(e) => {
        if (!view) return;
        const { x, y } = toLocal(e);
        drag.current = { x, y, cx: view.lon, cy: view.lat };
      }}
      onMouseMove={(e) => {
        if (!view) return;
        const { x, y } = toLocal(e);
        if (drag.current) {
          const z = view.z;
          const oX = lonToWorldX(drag.current.cx, z) - (x - drag.current.x);
          const oY = latToWorldY(drag.current.cy, z) - (y - drag.current.y);
          setUserView({ lon: worldXToLon(oX, z), lat: worldYToLat(oY, z), z });
          setHover(null);
          return;
        }
        const hit = hitMarker(x, y);
        setHover(
          hit
            ? { x, y, text: `${hit.순위}위 · ${hit.JIBUN} · 점수 ${hit.점수.toFixed(4)}` }
            : null,
        );
      }}
      onMouseUp={(e) => {
        const moved = drag.current;
        drag.current = null;
        if (!moved) return;
        const { x, y } = toLocal(e);
        if (Math.abs(x - moved.x) > 3 || Math.abs(y - moved.y) > 3) return; // 팬이었다
        const hit = hitMarker(x, y);
        onSelect(hit ? hit.순위 : null);
      }}
      onMouseLeave={() => {
        drag.current = null;
        setHover(null);
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/*
        방위 표시(명세 화면 4). **회전 기능이 없으므로 북쪽은 언제나 위다** —
        웹 메르카토르에서 y 축은 위도축과 나란하고, 이 지도는 팬·줌만 한다.
        그래서 각도를 계산하지 않고 고정으로 그린다. 나중에 회전을 붙이면
        이 표시가 **조용히 거짓말을 하게 되므로** 그때 같이 돌려야 한다.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-2 top-2 flex flex-col items-center rounded bg-white/85 px-1.5 py-1 text-ink-secondary"
      >
        <span className="text-[11px] leading-none">▲</span>
        <span className="text-[10px] font-semibold leading-tight">N</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded bg-black/80 px-2 py-1 text-[11px] text-white"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.text}
        </div>
      )}

      {view && (
        <div className="tnum pointer-events-none absolute bottom-2 left-2 rounded bg-white/85 px-2 py-1 text-[10px] text-ink-secondary">
          z{view.z} · {view.lat.toFixed(5)}, {view.lon.toFixed(5)} · 격자 {grid.spacing_m}m
        </div>
      )}
      {basemap && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-white/85 px-2 py-1 text-[10px] text-ink-secondary">
          © OpenStreetMap contributors
        </div>
      )}
    </div>
  );
}
