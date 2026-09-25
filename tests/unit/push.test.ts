import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendPush, type PushSender } from "@/lib/push";

// A minimal stand-in for the admin client: one user's subscriptions, and a record of deletes.
function fakeClient(endpoints: string[]) {
  const deleted: string[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: endpoints.map((endpoint) => ({ endpoint, p256dh: "p", auth: "a" })), error: null }),
      }),
      delete: () => ({
        eq: async (_: string, endpoint: string) => {
          deleted.push(endpoint);
          return { error: null };
        },
      }),
    }),
  };
  return { client: client as never, deleted };
}

const payload = { title: "SkyFin", body: "Half your budget is used", url: "/" };

describe("sendPush", () => {
  it("sends to every subscription and counts deliveries", async () => {
    const { client, deleted } = fakeClient(["https://push/a", "https://push/b"]);
    const send = vi.fn<PushSender>().mockResolvedValue(201);
    await expect(sendPush(client, "u", payload, send)).resolves.toBe(2);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push/a" }), JSON.stringify(payload));
    expect(deleted).toEqual([]);
  });

  it("deletes a subscription the push service answers 404 or 410 for (F11-2)", async () => {
    const { client, deleted } = fakeClient(["https://push/gone", "https://push/missing", "https://push/ok", "https://push/busy"]);
    const status: Record<string, number> = {
      "https://push/gone": 410,
      "https://push/missing": 404,
      "https://push/ok": 201,
      "https://push/busy": 429,
    };
    const send: PushSender = async (s) => status[s.endpoint]!;
    await expect(sendPush(client, "u", payload, send)).resolves.toBe(1);
    expect(deleted).toEqual(["https://push/gone", "https://push/missing"]);
  });

  it("keeps going when one send throws", async () => {
    const { client } = fakeClient(["https://push/a", "https://push/b"]);
    const send = vi.fn<PushSender>().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(201);
    await expect(sendPush(client, "u", payload, send)).resolves.toBe(1);
  });
});
