"use client";

/**
 * 비어 있는 상태를 **말로 설명한다.**
 *
 * 이 프로젝트에서 제일 위험한 화면은 "빈 표"다. 데이터가 0건인지, 아직 안
 * 왔는지, 실패했는지 구분이 안 되면 사람이 잘못 판단한다. 그래서 빈 화면마다
 * 왜 비었는지와 다음에 뭘 하면 되는지를 같이 쓴다(절대원칙 1·4).
 */
import Link from "next/link";


function Box({
  tone,
  children,
}: {
  tone: "info" | "error" | "wait";
  children: React.ReactNode;
}) {
  const cls = {
    info: "border-hairline bg-white text-ink-secondary",
    wait: "border-primary/25 bg-primary/[0.04] text-ink-secondary",
    error: "border-red-200 bg-red-50 text-red-800",
  }[tone];
  return (
    <div className={`rounded-lg border px-5 py-6 text-[13px] leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

export function NoRun() {
  return (
    <Box tone="info">
      <p className="font-medium text-ink">아직 실행한 파이프라인이 없습니다.</p>
      <p className="mt-1">
        화면 1 에서 실행을 시작하면 이 화면이 그 실행의 산출물을 읽습니다.
      </p>
      <Link href="/" className="btn-primary mt-4 text-[13px]">
        화면 1 로 이동
      </Link>
    </Box>
  );
}

export function Running({ status }: { status: string }) {
  return (
    <Box tone="wait">
      <p className="font-medium text-ink">
        실행이 아직 끝나지 않았습니다 (상태: {status}).
      </p>
      <p className="mt-1">
        이 화면이 읽을 산출물은 해당 단계가 끝나야 생깁니다. 없는 값을 임시로
        채우지 않습니다.
      </p>
    </Box>
  );
}

export function Failed({ message }: { message: string | null }) {
  return (
    <Box tone="error">
      <p className="font-medium">실행이 실패했습니다.</p>
      {/* 서버가 준 문구를 그대로 보여준다. 요약·순화하지 않는다. */}
      <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[12px]">
        {message ?? "(서버가 사유를 남기지 않았습니다)"}
      </pre>
    </Box>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <Box tone="error">
      <p className="font-medium">산출물을 읽지 못했습니다.</p>
      <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[12px]">
        {message}
      </pre>
    </Box>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <Box tone="info">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent align-[-2px]" />
      <span className="ml-2">{what} 불러오는 중…</span>
    </Box>
  );
}

/** 값이 산출물에 없어서 못 보여주는 자리. 0 을 찍지 않는다. */
export function NotExposed({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-ink-secondary/70 underline decoration-dotted underline-offset-2"
      title="이 값은 현재 API 로 노출되는 산출물에 없습니다."
    >
      {children}
    </span>
  );
}
