"use client";

import React from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, History, Sparkles } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Log & Chat", icon: MessageSquare },
  { href: "/history", label: "History", icon: History },
  { href: "/audit", label: "AI Audit", icon: Sparkles },
];

type NavItem = (typeof NAV_ITEMS)[number];

/** The index of the tab whose page is showing (/audit/[id] belongs to AI Audit), or -1. */
function currentTab(pathname: string) {
  return NAV_ITEMS.findIndex(({ href }) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href),
  );
}

/**
 * Marks its Link while that navigation is pending, so the capsule moves on the tap
 * instead of when the next page arrives (the .tab-bar:has() rules in globals.css).
 */
function PendingMarker() {
  const { pending } = useLinkStatus();
  return pending ? <span data-pending hidden /> : null;
}

/** A tab's icon, unread badge and label: drawn once on the glass and once in the capsule. */
function TabContent({
  item: { icon: Icon, label },
  badge,
  inCapsule = false,
}: {
  item: NavItem;
  badge: number;
  inCapsule?: boolean;
}) {
  return (
    <>
      <span className="relative">
        <Icon aria-hidden="true" className="size-5" strokeWidth={inCapsule ? 2.4 : 2} />
        {badge > 0 && (
          <span
            // Screen readers and tests find the copy on the glass; the capsule's is decoration.
            id={inCapsule ? undefined : "audit-badge"}
            aria-label={
              inCapsule ? undefined : `${badge} unread ${badge === 1 ? "report" : "reports"}`
            }
            className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-danger-foreground text-[10px] font-bold leading-[18px] text-center tabular-nums ring-2 ${
              inCapsule ? "ring-nav-active" : "ring-nav"
            }`}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[11px] font-semibold leading-none">{label}</span>
    </>
  );
}

/**
 * The floating tab bar: a pill of dark frosted glass above the home indicator, with the
 * current tab in a light capsule that slides to a tapped tab while its page loads. The
 * glass and the slide are the .tab-bar rules in globals.css. Its size and offset are the
 * --nav-* variables there, which the app layout and the chat composer use to stay clear of it.
 * unreadAudits badges the AI Audit tab (M6.10): the fallback when a push didn't arrive.
 */
export function BottomNav({ unreadAudits = 0 }: { unreadAudits?: number }) {
  const current = currentTab(usePathname());
  const tabs = NAV_ITEMS.map((item) => ({
    item,
    badge: item.href === "/audit" && unreadAudits > 0 ? unreadAudits : 0,
  }));

  return (
    <nav
      className="tab-bar fixed inset-x-4 bottom-(--nav-bottom) z-40 mx-auto h-(--nav-height) max-w-md rounded-full p-1.5"
      style={{ "--tab": current } as React.CSSProperties}
    >
      <div className="relative flex h-full items-stretch">
        {tabs.map(({ item, badge }, i) => (
          <Link
            key={item.href}
            href={item.href}
            data-tab={i}
            aria-current={i === current ? "page" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full text-nav-glass-muted hover:text-nav-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-foreground"
          >
            <TabContent item={item} badge={badge} />
            <PendingMarker />
          </Link>
        ))}
        {current >= 0 && (
          // After the links, so it paints over them. The capsule is a window onto a strip of
          // active-styled copies of all four tabs, which slides the opposite way to keep each
          // copy over its own tab while the capsule moves.
          <span
            aria-hidden="true"
            className="tab-pill pointer-events-none absolute inset-y-0 left-0 isolate w-1/4 overflow-hidden rounded-full bg-nav-active"
          >
            <span className="tab-strip flex h-full w-[400%]">
              {tabs.map(({ item, badge }) => (
                <span
                  key={item.href}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-nav-active-foreground"
                >
                  <TabContent item={item} badge={badge} inCapsule />
                </span>
              ))}
            </span>
          </span>
        )}
      </div>
    </nav>
  );
}
