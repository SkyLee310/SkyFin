import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportView } from "@/components/audit/report-view";
import { type AuditContent, reportFigures, rmAmountsIn } from "@/lib/agents/audit-content";

// M7.9: every RM figure in a rendered report is one of the pre-computed stats figures; none
// comes from the model. The check reads the markup's text, the way a person reads the page.

function textOf(markup: string): string {
  return markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
}

const weekly: AuditContent = {
  version: 1,
  kind: "weekly",
  language: "en",
  source: "ai",
  period: { start: "2026-09-21", end: "2026-09-27" },
  headline: "Boba ran your week: RM 34.00 across 4 cups.",
  stats: {
    count: 6,
    total_sen: 6600,
    needs_sen: 3200,
    wants_sen: 3400,
    wants_pct: 52,
    top_categories: [
      { name: "Food & Drinks", sen: 4600, pct: 70 },
      { name: "Transport", sen: 2000, pct: 30 },
    ],
    micro_expenses: [{ label: "boba", count: 4, total_sen: 3400, monthly_sen: 14571 }],
    previous: { total_sen: 6000, wants_pct: 50 },
  },
  tips: [
    { title: "Halve the boba", detail: "Every other cup, or brew teh at home.", saving_sen: 7286 },
    { title: "Mamak over café", detail: "Same kopi, a third of the price.", saving_sen: 4371 },
    { title: "One no-spend day", detail: "Campus bus and packed lunch on Wednesdays.", saving_sen: 1414 },
  ],
};

const monthly: AuditContent = {
  ...weekly,
  kind: "monthly",
  source: "stats",
  period: { start: "2026-09-01", end: "2026-09-30" },
  headline: "You spent RM 66.00, and 52% of it went on wants.",
  budget: { suggested_budget_sen: 67000, previous_budget_sen: 80000, for_month: "2026-10", applied_at: "2026-10-01T14:00:00Z" },
};

describe("ReportView", () => {
  it.each([
    ["weekly", weekly],
    ["monthly", monthly],
  ])("every RM figure in the rendered %s report matches the stats JSON", (_, content) => {
    const text = textOf(renderToStaticMarkup(<ReportView content={content} />));
    const shown = rmAmountsIn(text);
    expect(shown.length).toBeGreaterThan(10);
    const allowed = reportFigures(content);
    expect(shown.filter((amount) => !allowed.has(amount))).toEqual([]);
  });

  it("shows the headline, the boba micro-expense with its monthly projection and exactly 3 tips with savings", () => {
    const text = textOf(renderToStaticMarkup(<ReportView content={weekly} />));
    expect(text).toContain("Boba ran your week");
    expect(text).toContain("boba 4× = RM 34.00, ≈ RM 145.71/month");
    expect(text).toContain("RM 6.00 more than last week · Wants 52% (last week 50%)");
    expect(text.match(/Could save ≈ RM [\d.,]+\/month/g)).toHaveLength(3);
  });

  it("a monthly review shows next month's suggested budget and what it replaced", () => {
    const text = textOf(renderToStaticMarkup(<ReportView content={monthly} />));
    expect(text).toContain("Budget for October 2026");
    expect(text).toContain("RM 670.00");
    expect(text).toContain("it replaced RM 800.00");
  });

  it("catches a figure that isn't in the stats", () => {
    const tampered = { ...weekly, headline: "You wasted RM 99.99." };
    const shown = rmAmountsIn(textOf(renderToStaticMarkup(<ReportView content={tampered} />)));
    expect(shown.filter((amount) => !reportFigures(tampered).has(amount))).toEqual(["RM 99.99"]);
  });
});
