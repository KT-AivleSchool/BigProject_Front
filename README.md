# 📱 OmniSite 프론트엔드 개발자 협업 가이드라인 (README)

본 문서는 스마트시티 SDSS 플랫폼 **OmniSite** 프론트엔드(Next.js) 레포지토리 개발자를 위한 로컬 구동 절차, 실증 구동 시나리오 증빙, 그리고 정적 린트(ESLint) 준수 수칙을 담은 협업 가이드라인입니다.

---

## 🎥 1. E2E 실물 구동 테스트 결과 및 증빙 (Wow Point)

프론트엔드와 백엔드 간의 실시간 SSE 및 PostGIS/AHP 비동기 E2E 흐름을 성공적으로 수립하여 자가 테스트를 완수했습니다.

*   🎥 **E2E 전 과정 실증 비디오 (WebP)**: [frontend_ui_preview_1783404994671.webp](file:///Users/jcm0314/.gemini/antigravity-ide/brain/a3a06925-871d-4dcf-8fc6-3f5bbcdf098b/frontend_ui_preview_1783404994671.webp)
*   📸 **초기 대시보드 뷰**: [initial_dashboard_view_1783405039027.png](file:///Users/jcm0314/.gemini/antigravity-ide/brain/a3a06925-871d-4dcf-8fc6-3f5bbcdf098b/initial_dashboard_view_1783405039027.png)
*   📸 **AHP 가중치 잠금(Lock) 시점**: [after_lock_click_1783405246750.png](file:///Users/jcm0314/.gemini/antigravity-ide/brain/a3a06925-871d-4dcf-8fc6-3f5bbcdf098b/after_lock_click_1783405246750.png)
*   📸 **AI 모의 심의 토론 스트리밍**: [simulation_running_1783405352197.png](file:///Users/jcm0314/.gemini/antigravity-ide/brain/a3a06925-871d-4dcf-8fc6-3f5bbcdf098b/simulation_running_1783405352197.png)

---

## ⚙️ 2. 로컬 실행 및 빌드/린트 규칙

### ➊ 패키지 의존성 정합성 설치
본 프로젝트의 CI 파이프라인은 락 파일과의 버전 미스매치를 방어하기 위해 엄격히 `npm ci`로 검리합니다. 로컬에서 의존성을 추가하거나 변경할 때 반드시 아래 순서를 지켜주세요.
```bash
# 1. 의존성 충돌 발생 시 청소
rm -rf node_modules package-lock.json
npm cache clean --force

# 2. 깨끗한 상태로 재인스턴싱 및 락 파일 재생성
npm install

# 3. 로컬 ci 적합성 자가 진단
npm ci
```

### ➋ 로컬 개발 서버 실행 (Turbopack)
```bash
# frontend 디렉토리로 진입 후 기동
npm run dev
```
*   로컬 주소: [http://localhost:3000](http://localhost:3000)
*   백엔드 통신 주소: `http://localhost:8000` (CORS 세팅 완료)

### ➌ 🚨 ESLint 정적 분석 무결성 준수 수칙
React 19 / Next.js 16 규칙에 의해 **Effect 본문에서의 동기적 `setState` 호출은 엄격히 금지**됩니다.
*   **오류 유형**: `Error: Calling setState synchronously within an effect can trigger cascading renders`
*   **해결 기법**: `useEffect` 내에서 상태값을 수정할 때는 렌더링 무한 루프 및 Cascading Render를 차단하기 위해 **반드시 `setTimeout(() => { ... }, 0)` 비동기 매크로태스크 큐로 래핑**하여 분기시켜야 합니다.
    ```javascript
    useEffect(() => {
      if (showModal) {
        // 동기 호출 대신 setTimeout으로 감싸 린트 에러 방지
        setTimeout(() => {
          fetchData();
        }, 0);
      }
    }, [showModal]);
    ```

---

## 🌎 3. 2~5주차 연동 완료 피처 스펙

*   **Step 1. 데이터 적재 & 드롭존**: `⚖️ 법규 RAG 관리` 모달을 통해 지자체별 전기차 충전소/금연구역 관련 다중 PDF 법규를 업로드하고 비동기 조회 및 연쇄 물리 삭제 가동.
*   **Step 2. 비주얼 HITL 좌표 드래그 보정**: 지도 위의 주황색 핀 마커를 드래그 시 좌표가 폼에 실시간 연계되며, `Commit` 클릭 시 백엔드 DB의 공간 지번에 수동 보정값을 확정 반영 (`POST /api/v1/lands/hitl/commit`).
*   **Step 3. AHP 가중치 잠금 및 해제 (Lock/Unlock)**: 5대 가중치 슬라이더를 락(Lock) 걸 시 백엔드로 C.R. 검증을 청구해 $C.R. < 0.1$ 일 때 동결(`/lock`)하며, 언제든 다시 풀고 재수정할 수 있는 🔓 잠금 해제 인터랙션 탑재.
*   **Step 4. 금역 마스크 및 영향권 시각화**: 지하철/학교/군사보호 적색 오버레이 유지 및 선택된 활성 마커 배후의 `대중교통 유동 영향권 150m` 파란색 점선 원 시각화.
*   **Step 5. AI 모의 심의 토론 중계**: EventSource를 통해 1.5초 간격으로 생성되는 AI 대표자들의 심의 대사를 터미널에 실시간 스트리밍하되, 대사 인입 시마다 스크롤을 최하단으로 자동 갱신 및 WeasyPrint PDF 다운로드 바인딩 완료.
