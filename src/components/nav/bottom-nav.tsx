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

/** unreadAudits badges the AI Audit tab (M6.10): the fallback when a push didn't arrive. */
export function BottomNav({ unreadAudits = 0 }: { unreadAudits?: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const badge = href === "/audit" && unreadAudits > 0 ? unreadAudits : 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-1 transition-colors ${
                isActive
                  ? "text-emerald-600 font-semibold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-600 stroke-[2.5]" : ""}`} />
                {badge > 0 && (
                  <span
                    id="audit-badge"
                    aria-label={`${badge} unread ${badge === 1 ? "report" : "reports"}`}
                    className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-[18px] text-center"
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span className="text-[11px] mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
