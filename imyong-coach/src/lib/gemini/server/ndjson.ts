import "server-only";

/**
 * NDJSON 스트리밍 응답 헬퍼.
 * run 안에서 send(event)로 한 줄씩 내보내고, 클라이언트가 연결을 끊으면 signal이 abort됩니다.
 */
export function ndjsonResponse<E>(
  request: Request,
  run: (send: (event: E) => void, signal: AbortSignal) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: E) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
      try {
        await run(send, request.signal);
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* 이미 닫힘 */
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
