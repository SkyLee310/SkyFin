import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BottomNav } from "@/components/nav/bottom-nav";

// M8.12: the tab bar's capsule follows the page that is showing, and moves to a tapped tab
// while its page loads. The movement itself is CSS (globals.css, .tab-bar); these tests pin
// the markup that CSS keys on.

const nav = vi.hoisted(() => ({ pathname: "/", pendingHref: null as string | null }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

// A plain <a> that tells useLinkStatus its href, so a test can say which link is pending.
vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const LinkHref = React.createContext<string | null>(null);
  function Link({ href, children, ...rest }: { href: string; children?: ReactNode }) {
    return React.createElement(
      LinkHref.Provider,
      { value: href },
      React.createElement("a", { href, ...rest }, children),
    );
  }
  return {
    default: Link,
    useLinkStatus: () => {
      const href = React.useContext(LinkHref);
      return { pending: nav.pendingHref !== null && href === nav.pendingHref };
    },
  };
});

function render(pathname: string, unreadAudits = 0) {
  nav.pathname = pathname;
  return renderToStaticMarkup(<BottomNav unreadAudits={unreadAudits} />);
}

/** Each tab link's data-tab index and whether it holds the aria-current or pending marker. */
function linksIn(markup: string) {
  return [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs = "", inner = ""]) => ({
    tab: attrs.match(/data-tab="(\d+)"/)?.[1],
    current: attrs.includes('aria-current="page"'),
    pending: inner.includes("data-pending"),
  }));
}

beforeEach(() => {
  nav.pendingHref = null;
});

describe("BottomNav", () => {
  it.each([
    ["/", 0],
    ["/chat", 1],
    ["/history", 2],
    ["/audit", 3],
    ["/audit/5f0c2a4e-1b9d-4c1a-9d57-0e3f9a2b7c11", 3],
  ])("on %s, puts the capsule on tab %i and marks only that link current", (pathname, tab) => {
    const markup = render(pathname);
    expect(markup).toContain(`style="--tab:${tab}"`);
    expect(linksIn(markup).filter((link) => link.current).map((link) => link.tab)).toEqual([
      String(tab),
    ]);
  });

  it("draws the capsule after the links, so it paints over them, and hides it from screen readers", () => {
    const markup = render("/history");
    const pill = markup.match(/<span[^>]*class="tab-pill [^"]*"[^>]*>/)?.[0];
    expect(pill).toContain('aria-hidden="true"');
    expect(markup.indexOf("tab-pill")).toBeGreaterThan(markup.lastIndexOf("</a>"));
  });

  it("draws no capsule on a page outside the tabs", () => {
    const markup = render("/not-a-tab");
    expect(markup).not.toContain("tab-pill");
    expect(linksIn(markup).some((link) => link.current)).toBe(false);
  });

  it.each(["/", "/audit"])("on %s, gives the unread badge one id and one label", (pathname) => {
    const markup = render(pathname, 2);
    expect(markup.match(/id="audit-badge"/g)).toHaveLength(1);
    expect(markup.match(/aria-label="2 unread reports"/g)).toHaveLength(1);
    expect(render(pathname, 0)).not.toContain("audit-badge");
  });

  it("marks the tapped link while its page loads, before the page changes", () => {
    nav.pendingHref = "/chat";
    const markup = render("/");
    expect(markup).toContain('style="--tab:0"');
    expect(linksIn(markup).filter((link) => link.pending).map((link) => link.tab)).toEqual(["1"]);
  });

  it("marks no link when nothing is loading", () => {
    expect(render("/history")).not.toContain("data-pending");
  });

  it("has a globals.css rule that moves the capsule to each tab it draws", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)),
      "utf8",
    );
    const tabs = linksIn(render("/")).map((link) => link.tab);
    expect(tabs).toEqual(["0", "1", "2", "3"]);
    for (const tab of tabs) {
      expect(css).toContain(`.tab-bar:has([data-tab="${tab}"] [data-pending])`);
    }
  });
});
