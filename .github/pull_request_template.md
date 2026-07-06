## 📝 요약 (Summary)
이번 PR의 핵심 변경 사항과 구현 목적을 간단히 작성해 주세요.

## 🔗 관련 이슈 (Related Issues)
*   Fixes #이슈번호
*   Relates to #이슈번호

## 🛠️ 변경 종류 (Type of Change)
- [ ] ✨ 신규 기능 추가 (New Feature)
- [ ] 🐛 버그 수정 (Bug Fix)
- [ ] ♻️ 리팩토링 (Refactoring)
- [ ] 💄 스타일/UI 수정 (Style / Markup)
- [ ] 📝 문서 업데이트 (Documentation)
- [ ] ⚙️ CI/CD 및 환경 설정 변경 (CI/CD / Config)

## 🧪 테스트 및 검증 방법 (Testing)
로컬에서 검증한 방법과 명령어, 혹은 실행 화면 덤프를 공유해 주세요.
*   `npm run build` 성공 여부
*   지형도/지적도 Canvas 렌더링 60fps 정상 로드 여부

## 📋 셀프 체크리스트 (Self Checklist)
- [ ] 코드가 코딩 컨벤션 및 스타일 가이드를 준수합니다.
- [ ] 불필요한 콘솔 로그(`console.log`) 및 주석 처리가 제거되었습니다.
- [ ] Mapbox 인스턴스 해제 및 Leaflet 메모리 릭 발생 지점을 검토했습니다.
- [ ] `React.memo` 또는 `useMemo` 등을 통한 렌더링 락(Render Lock)을 구성했습니다.
- [ ] 빌드 및 린트(eslint) 에러가 없습니다.
