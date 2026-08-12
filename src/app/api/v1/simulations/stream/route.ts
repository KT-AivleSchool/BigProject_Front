import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const backendUrl = `${process.env.OMNISITE_API_ORIGIN ?? "http://127.0.0.1:8000"}/api/v1/simulations/stream`;
  
  const response = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body,
  });

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
