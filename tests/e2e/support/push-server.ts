import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface ReceivedPush {
  path: string;
  payload: { title: string; body: string; url: string; tag?: string };
}

/**
 * A stand-in push service. With PUSH_FAKE=1 the app POSTs each push as JSON to the subscription
 * endpoint (src/lib/push.ts), so pointing a subscription here lets a test count pushes. A path
 * starting /gone answers 410, like a push service for an expired subscription.
 */
export async function startPushServer() {
  const received: ReceivedPush[] = [];
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const path = req.url ?? "/";
      if (path.startsWith("/gone")) {
        res.writeHead(410).end();
        return;
      }
      received.push({ path, payload: JSON.parse(body) });
      res.writeHead(201).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path: string) => `http://127.0.0.1:${port}${path}`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
