"use client";

import { useEffect } from "react";
import { markReportRead } from "@/actions/audits";

/** Opening a report marks it read (M7.5), which clears it from the Audit tab badge. */
export function MarkRead({ id, read }: { id: string; read: boolean }) {
  useEffect(() => {
    if (!read) void markReportRead({ id });
  }, [id, read]);
  return null;
}
