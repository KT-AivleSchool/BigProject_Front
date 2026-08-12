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
 *    같은 이유로 점수층의 블러는 **보이기용**이지 해상도가 아니다 — 자세한 것은
 *    `draw()` 2번 주석. 블러 밖에 있는 것(배제 셀·Top-N 마커)이 정확한 값이다.
 *
 * 🔴 좌표계는 저장 규약대로 EPSG:4326 이다(`score_grid.crs` 로 확인한다).
 *    다른 값이 오면 그리지 않고 그 사실을 화면에 띄운다 — 좌표계 추측은
 *    이 프로젝트에서 실제로 사고가 났던 지점이다(공간조인 0건 → 지표 전부 0).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ExclusionDoc,
  GeoPolygon,
  ScoreGridDoc,
  TopNCsvRow,
} from "@/lib/omnisite/types";

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

/**
 * 면만 받는다. 점·선·null 이면 `null` — **면으로 지어내지 않는다.**
 *
 * 실측(`r_20260812_007`)은 5개 전부 `MultiPolygon` 이었지만, 관측 5건으로
 * 타입을 좁히면 다음 도메인에서 다른 게 왔을 때 `coordinates` 를 폴리곤으로
 * 읽어 **좌표가 뒤죽박죽인 도형**이 그려진다 — 예외가 안 나고 모양만 틀린다.
 *
 * 🔴 `export` 인 이유는 **범례가 같은 판정을 써야 하기 때문**이다. 「실제 형상」이라고
 *    적을지 「격자 근사」라고 적을지는 여기서 몇 장이 면으로 인정됐는가로 갈린다 —
 *    설명하는 쪽이 따로 세면 그리는 것과 적히는 것이 조용히 갈린다.
 */
export function polygonsOf(
  g: { type: string; coordinates: unknown } | null,
): GeoPolygon[] | null {
  if (!g) return null;
  if (g.type === "MultiPolygon") return g.coordinates as GeoPolygon[];
  if (g.type === "Polygon") return [g.coordinates as GeoPolygon];
  return null;
}

/** `cv` 와 같은 크기의 오프스크린을 확보한다. 매 프레임 새로 만들지 않는다. */
function offscreenLike(
  ref: { current: HTMLCanvasElement | null },
  cv: HTMLCanvasElement,
): HTMLCanvasElement {
  let off = ref.current;
  if (!off) {
    off = document.createElement("canvas");
    ref.current = off;
  }
  if (off.width !== cv.width) off.width = cv.width;
  if (off.height !== cv.height) off.height = cv.height;
  return off;
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
  /**
   * 배제 구역의 **실제 형상**(`exclusion.geojson`). 있으면 이걸 그리고,
   * `null` 이면 격자 사각형으로 떨어진다(아래 4번). 🔴 `null` 은 조용한 실패가
   * 아니다 — 부른 쪽이 범례에 「격자 근사」라고 적는다.
   */
  exclusion: ExclusionDoc | null;
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
  exclusion,
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
  /** 점수층 전용 오프스크린. 여기 그린 뒤 **한 번만** 블러해서 합성한다(아래 2번). */
  const heatRef = useRef<HTMLCanvasElement | null>(null);
  /** 배제층 전용 오프스크린. 겹침이 진해지지 않게 하는 장치다(아래 3번). */
  const exclRef = useRef<HTMLCanvasElement | null>(null);
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
    // 🔴 `size.h` 도 본다. 좁은 폭에서 지도 칸이 **0 높이로 접히는** 순간이
    //    실제로 있고(415px 뷰포트 실측: 컨테이너 350×0), 그때 캔버스는
    //    350×0 이 된다. 예전엔 아무것도 안 그려져 조용히 넘어갔지만, 아래
    //    2번이 그 크기로 오프스크린을 만들면 `drawImage` 가 **빈 원본**을
    //    받는다 — 크로뮴에서 렌더러가 통째로 죽었다(빈 화면도 아니고
    //    "This page couldn't load"). 폭만 보던 검사가 원인이었다.
    if (!cv || !view || size.w === 0 || size.h === 0) return;
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
    //
    // 예전엔 이 사각형을 그대로 칠해서 50m 블록이 눈에 그대로 보였다. 지금은
    // 같은 사각형을 **오프스크린에 그린 뒤 한 번만 블러**해서 합성한다.
    // 안 고른 방법과 이유 —
    //  · 셀마다 방사형 그라디언트: 6,797개면 팬·줌에서 프레임이 죽는다.
    //  · 격자 인덱스로 보간(저해상 캔버스 업스케일): 산출물에 `row`/`col`/`origin`
    //    이 **없어서** 경위도로 역산해야 하는데, 역산이 틀려도 화면은 그럴듯해
    //    보인다. 없는 것을 역산하지 않는다.
    //
    // 🔴 블러는 **값을 섞는다.** 화면의 색은 그 지점의 실측 점수가 아니라 주변
    //    셀이 번진 결과다 — 그래서 이건 **배경 히트맵**이고 범례에 그렇게 적었다.
    //    고르는 행위는 블러 밖의 Top-N 마커(4번)로만 한다.
    //
    // ⚠ `side` 는 아래 3번(배제 격자 대체안)도 쓰므로 블록 밖에 둔다.
    const mpp = metersPerPixel(view.lat, z);
    const side = Math.max(1.5, grid.spacing_m / mpp);

    if (showGrid) {
      const span = Math.max(1e-9, grid.score_max - grid.score_min);
      // 한 변의 절반. 이웃 셀까지만 번진다 — 더 키우면 지형이 통째로 뭉개진다.
      const blur = Math.min(20, Math.max(1, side * 0.5));
      // 🔴 화면 밖 셀도 블러 반경만큼은 그려야 한다. 안 그리면 팬 할 때
      //    뷰포트 가장자리에 **직선 이음매**가 생긴다.
      const pad = side + blur * 3;

      const heat = offscreenLike(heatRef, cv);
      const hx = heat.getContext("2d");
      if (hx) {
        hx.setTransform(dpr, 0, 0, dpr, 0, 0);
        hx.clearRect(0, 0, size.w, size.h);
        for (const c of grid.cells) {
          if (c[3] === 1) continue; // 배제는 블러에 안 넣는다 — 범주 플래그다
          const x = px(c[0]) - side / 2;
          const y = py(c[1]) - side / 2;
          if (x < -pad || y < -pad || x > size.w + pad || y > size.h + pad) continue;
          hx.fillStyle = scoreColor((c[2] - grid.score_min) / span);
          hx.fillRect(x, y, side, side);
        }
        // ⚠ `ctx.filter` 를 안 지원하는 브라우저에서는 대입이 무시될 뿐이라
        //    **블러 없는 예전 모습**으로 떨어진다. 빈 화면이 되지는 않는다.
        ctx.filter = `blur(${blur.toFixed(1)}px)`;
        ctx.globalAlpha = 0.72;
        ctx.drawImage(heat, 0, 0, size.w, size.h);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
      }

    }

    // 3) 배제 구역. **산출물의 실제 형상을 그린다** — 격자 근사가 아니다.
    //
    // 점수층(2번)과 성격이 정반대다. 점수는 격자 중심점만 있어서 사각형을 여기서
    // 만들 수밖에 없지만, 배제는 `exclusion.geojson` 에 **면 자체가 들어 있다**
    // (실측 `r_20260812_007`: MultiPolygon 5장 · 링 491 · 점 6,253 · CRS84).
    // 그러니 여기서 근사할 이유가 없다. 사각형 6,797개보다 오히려 싸다.
    //
    // 🔴 왜 오프스크린을 거치나 — **레이어 5장이 심하게 겹친다**(01 금연구역과
    //    11 어린이보호구역이 둘 다 학교 필지로 번진다). 각 장을 alpha 0.32 로
    //    바로 칠하면 겹친 데가 진해져 「더 많이 배제됨」으로 읽히는데,
    //    **「반쯤 배제」도 「더 배제」도 없다.** 불투명하게 한 장에 모아 찍고
    //    합성에서 한 번만 흐리게 하면 겹쳐도 색이 평평하다.
    //
    // 🔴 왜 `evenodd` 인가 — 폴리곤의 첫 링이 바깥이고 나머지가 구멍인데, 기본
    //    nonzero 규칙은 **바깥과 구멍이 반대로 감겨 있을 때만** 구멍을 뚫는다.
    //    GeoJSON 규격(RFC 7946)은 그렇게 하라고 하지만 만든 쪽이 지켰는지는
    //    안 재봤다. 틀렸으면 구멍이 메워진 채 그려지는데 **조금 더 큰 덩어리로
    //    보일 뿐이라 아무도 못 잡는다.** `evenodd` 는 감김 방향에 안 기댄다.
    if (showExcluded) {
      const polyLayers: GeoPolygon[][] = exclusion
        ? exclusion.features
            .map((f) => polygonsOf(f.geometry))
            .filter((p): p is GeoPolygon[] => p !== null)
        : [];

      if (polyLayers.length > 0) {
        const off = offscreenLike(exclRef, cv);
        const ex = off.getContext("2d");
        if (ex) {
          ex.setTransform(dpr, 0, 0, dpr, 0, 0);
          ex.clearRect(0, 0, size.w, size.h);
          ex.fillStyle = "rgb(196,72,72)";
          ex.strokeStyle = "rgb(150,40,40)";
          ex.lineWidth = 1;
          ex.lineJoin = "round";
          for (const polys of polyLayers) {
            for (const poly of polys) {
              const outer = poly[0];
              if (!outer || outer.length === 0) continue;
              // 화면 밖 폴리곤은 건너뛴다. 바깥 링만 봐도 된다 — 구멍은 그 안이다.
              let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
              for (const [lon, lat] of outer) {
                const x = px(lon), y = py(lat);
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
              }
              if (x1 < 0 || y1 < 0 || x0 > size.w || y0 > size.h) continue;
              ex.beginPath();
              for (const ring of poly) {
                let first = true;
                for (const [lon, lat] of ring) {
                  const x = px(lon), y = py(lat);
                  if (first) {
                    ex.moveTo(x, y);
                    first = false;
                  } else ex.lineTo(x, y);
                }
                ex.closePath();
              }
              ex.fill("evenodd");
              ex.stroke();
            }
          }
          ctx.globalAlpha = 0.32;
          ctx.drawImage(off, 0, 0, size.w, size.h);
          ctx.globalAlpha = 1;
        }
      } else {
        // 4) 형상을 못 받았을 때만 예전 모습(격자 사각형). **조용히 떨어지지
        //    않는다** — 부른 쪽이 범례에 「격자 근사」라고 적는다.
        ctx.fillStyle = "rgba(190,60,60,0.30)";
        for (const c of grid.cells) {
          if (c[3] !== 1) continue;
          const x = px(c[0]) - side / 2;
          const y = py(c[1]) - side / 2;
          if (x < -side || y < -side || x > size.w || y > size.h) continue;
          ctx.fillRect(x, y, side, side);
        }
      }
    }

    // 5) Top-N 마커
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
  }, [view, size, grid, topn, exclusion, selected, showExcluded, showGrid, basemap, onTileError]);

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
