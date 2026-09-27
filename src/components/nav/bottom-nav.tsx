"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, History, Sparkles } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Log & Chat", icon: MessageSquare },
  { href: "/history", label: "History", icon: History },
  { href: "/audit", label: "AI Audit", icon: Sparkles },
];

/**
 * The floating tab bar: a dark pill above the home indicator, with the current tab in a
 * light capsule. Its size and offset are the --nav-* variables in globals.css, which the app
 * layout and the chat composer use to stay clear of it.
 * unreadAudits badges the AI Audit tab (M6.10): the fallback when a push didn't arrive.
 */
export function BottomNav({ unreadAudits = 0 }: { unreadAudits?: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-4 bottom-(--nav-bottom) z-40 mx-auto h-(--nav-height) max-w-md rounded-full bg-nav p-1.5 shadow-float">
      <div className="flex h-full items-stretch gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const badge = href === "/audit" && unreadAudits > 0 ? unreadAudits : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full ${
                isActive
                  ? "bg-nav-active text-nav-active-foreground"
                  : "text-nav-muted hover:text-nav-foreground"
              }`}
            >
              <span className="relative">
                <Icon aria-hidden="true" className="size-5" strokeWidth={isActive ? 2.4 : 2} />
                {badge > 0 && (
                  <span
                    id="audit-badge"
                    aria-label={`${badge} unread ${badge === 1 ? "report" : "reports"}`}
                    className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-danger-foreground text-[10px] font-bold leading-[18px] text-center tabular-nums ring-2 ${
                      isActive ? "ring-nav-active" : "ring-nav"
                    }`}
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
