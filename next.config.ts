import type { NextConfig } from "next";

/**
 * 백엔드 API 오리진.
 *
 * 🔴 `NEXT_PUBLIC_` 을 쓰지 않는다 — 이 값은 브라우저 번들에 박히면 안 된다.
 *    브라우저는 항상 같은 출처(`/api/v1/pipeline/...`)로만 부르고, 실제 백엔드
 *    주소는 이 rewrite 안에서만 안다. 백엔드가 다른 호스트로 가도 프런트 코드는
 *    한 글자도 안 바뀐다.
 *
 * 기본값을 둔 이유: 도메인 값(시설명·반경 등)이 아니라 **개발 환경의 기본 포트**다.
 * 하드코딩 금지 원칙이 막는 것은 도메인 상수이지 로컬 개발 기본값이 아니다.
 * 그래도 `.env.local` 로 언제든 덮어쓸 수 있게 열어 둔다.
 */
const API_ORIGIN = process.env.OMNISITE_API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  /**
   * 워크스페이스 루트 고정.
   *
   * 부모 폴더 `D:\B_P\` 에 `package-lock.json` 이 있어서 Turbopack 이 루트를
   * 거기로 추론하고 경고를 냈다. 추론된 루트가 바뀌면 파일 추적 범위와
   * 출력 경로가 조용히 달라진다 — 경고를 끄는 게 아니라 **루트를 못박는다.**
   *
   * 🔴 `import.meta.dirname` 을 먼저 썼다가 `globals.css` 의 `@import "./theme.css"`
   *    가 프로젝트 루트에서 해석되며 resolve 에러가 났다. `package.json` 에
   *    `"type": "module"` 이 없어 이 설정 파일은 **CJS 로 로드**되고, 그때
   *    `import.meta.dirname` 은 `undefined` 다 → `root: undefined`.
   *    설정 오타 하나가 CSS 해석 실패로 나타나서 원인이 안 보였다. CJS 전역인
   *    `__dirname` 을 쓴다. 절대경로를 박지 않으므로 폴더를 옮겨도 따라온다.
   *
   * `process.cwd()` 는 답이 아니다 — `npm --prefix` 로 띄우면 cwd 가 다른 폴더다.
   */
  turbopack: { root: __dirname },

  /**
   * 동일 출처 프록시.
   *
   * 왜 CORS 직접 호출이 아닌가 — 백엔드 `main.py` 의 `allow_origins=["*"]` 는
   * **개발 단계 설정**이고 상용에서 조여진다고 주석에 적혀 있다. 그때 프런트를
   * 고쳐야 하는 구조를 지금 만들지 않는다.
   *
   * 경로를 `/api/v1/pipeline` 로 **그대로** 맞춘 이유 — `status.json` 의
   * `artifacts` 값이 `/api/v1/pipeline/runs/<id>/artifacts/<name>` 절대경로로
   * 온다. 경로를 바꾸면 프런트가 그 문자열을 조립·치환해야 하고, 그 순간
   * 계약 4절("가공하지 않고 그대로")이 프런트에서 깨진다.
   */
  async rewrites() {
    return [
      {
        source: "/api/v1/pipeline/:path*",
        destination: `${API_ORIGIN}/api/v1/pipeline/:path*`,
      },
      {
        source: "/api/v1/auth/:path*",
        destination: `${API_ORIGIN}/api/v1/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
