"use client";

import Head from "next/head";
import * as Sentry from "@sentry/nextjs";

export default function Page() {
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <Head>
        <title>Sentry Onboarding</title>
      </Head>

      <main style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h1>Sentry Test Page</h1>
        <p>이 버튼을 클릭하면 Sentry로 에러가 발송됩니다.</p>
        <button
          onClick={() => {
            throw new Error("Sentry Test Error from OmniSite Frontend!");
          }}
          style={{
            padding: "10px 20px",
            backgroundColor: "#e1567c",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          에러 강제 발생시키기 (Throw Error)
        </button>
      </main>
    </div>
  );
}
