import "server-only";

import type { ParseTextPromptInput } from "./prompts/parse-text";

// D30: canned model output for E2E tests (AI_FAKE=1, never in production; see isFakeAiEnabled).
// It returns what Gemini would return, as JSON text, so the real validation and mapping still run.

function yesterday(today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function draft(fields: Record<string, unknown>) {
  return {
    client_id: null,
    type: "expense",
    payment_method: null,
    merchant: null,
    item_label: null,
    note: null,
    is_essential: true,
    ...fields,
  };
}

export function fakeParseText(input: ParseTextPromptInput): string {
  const message = input.message.trim().toLowerCase();
  const today = input.today;
  let out: { reply: string; language: string; drafts: unknown[] };

  const correction = /^actually boba rm\s?(\d+(?:\.\d{1,2})?)$/.exec(message);
  if (message === "makan nasi lemak rm8.50 pakai ewallet") {
    out = {
      reply: "Okay, nasi lemak RM8.50 with eWallet.",
      language: "ms",
      drafts: [draft({ amount: 8.5, category: "Food & Drinks", payment_method: "eWallet", item_label: "nasi lemak", date: today })],
    };
  } else if (message === "nasi lemak 8.50, boba 12") {
    out = {
      reply: "Got it: nasi lemak and boba.",
      language: "en",
      drafts: [
        draft({ amount: 8.5, category: "Food & Drinks", item_label: "nasi lemak", date: today }),
        draft({ amount: 12, category: "Food & Drinks", item_label: "boba", is_essential: false, date: today }),
      ],
    };
  } else if (correction) {
    const boba = input.sessionDrafts.find((d) => d.item_label === "boba");
    out = {
      reply: `Updated boba to RM${correction[1]}.`,
      language: "en",
      drafts: boba ? [{ ...boba, amount: Number(correction[1]), note: null }] : [],
    };
  } else if (message === "semalam grab rm15") {
    out = {
      reply: "Grab RM15 semalam, noted.",
      language: "ms",
      drafts: [draft({ amount: 15, category: "Transport", item_label: "grab ride", merchant: "Grab", date: yesterday(today) })],
    };
  } else if (message === "今天午餐 rm10 现金") {
    out = {
      reply: "好的，午餐 RM10，现金。",
      language: "zh",
      drafts: [draft({ amount: 10, category: "Food & Drinks", payment_method: "Cash", item_label: "lunch", date: today })],
    };
  } else if (message === "dapat elaun rm500") {
    out = {
      reply: "Elaun RM500 masuk.",
      language: "ms",
      drafts: [draft({ type: "income", amount: 500, category: "Allowance / PTPTN", date: today })],
    };
  } else {
    out = {
      reply: "Check the Dashboard or History tab for your spending.",
      language: "en",
      drafts: [],
    };
  }
  return JSON.stringify(out);
}

/** Width and height from a baseline or progressive JPEG's SOF marker, or null. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]! };
    }
    i += 2 + length;
  }
  return null;
}

// The E2E photos are plain canvases, so the fake reads their shape: portrait is the demo's
// 99 Speedmart receipt, square is a faded foreign receipt, landscape is "a cat".
export function fakeParseReceipt(image: Uint8Array): string {
  const size = jpegSize(image);
  const notReceipt = {
    is_receipt: false, total_amount: null, currency_is_rm: false, merchant: null, date: null,
    suggested_category: null, suggested_is_essential: false, suggested_payment_method: null,
    item_label: null, confidence: 0,
  };
  if (!size || size.width > size.height) return JSON.stringify(notReceipt);
  if (size.width === size.height) {
    return JSON.stringify({
      ...notReceipt, is_receipt: true, total_amount: 12, currency_is_rm: false, merchant: "Cold Storage SG",
      suggested_category: "Groceries", suggested_is_essential: true, item_label: "groceries", confidence: 0.55,
    });
  }
  return JSON.stringify({
    is_receipt: true, total_amount: 42.3, currency_is_rm: true, merchant: "99 Speedmart", date: null,
    suggested_category: "Groceries", suggested_is_essential: true, suggested_payment_method: "Cash",
    item_label: "groceries", confidence: 0.93,
  });
}
