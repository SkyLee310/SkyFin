import "server-only";

import { redirect } from "next/navigation";
import { numericToSen } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export interface Profile {
  budgetSen: number;
  preferredLanguage: "en" | "zh" | "ms";
}

export async function getProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("monthly_budget, preferred_language")
    .eq("id", user.id)
    .single();

  return {
    budgetSen: profile ? numericToSen(profile.monthly_budget) : 0,
    preferredLanguage: (profile?.preferred_language as Profile["preferredLanguage"]) ?? "en",
  };
}
