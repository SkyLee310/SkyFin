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

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
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
              <Icon className={`w-5 h-5 ${isActive ? "text-emerald-600 stroke-[2.5]" : ""}`} />
              <span className="text-[11px] mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
