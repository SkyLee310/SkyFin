import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { todayMYT } from "../../../src/lib/dates";

type SupabaseSession = ReturnType<typeof createCookieJarClient>["supabase"];

// A Supabase client that keeps its cookies in memory, so a test can hand them to the browser with
// context.addCookies(). Uses only the local publishable key from playwright.config.ts.
function createCookieJarClient(baseURL: string) {
  const jar = new Map<string, string>();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) =>
          cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
      },
    },
  );
  const cookies = () => [...jar].map(([name, value]) => ({ name, value, url: baseURL }));
  return { supabase, cookies };
}

const newEmail = () => `e2e-${randomUUID()}@skyfin.test`;

// Signs up a fresh user on the local stack, where email confirmation is off, and returns the
// session cookies. A new user each time starts with a zero budget. `supabase` is the same
// authenticated client, for tests that need to arrange rows (e.g. insertExpense, setBudget)
// through RLS exactly as the signed-in user would, rather than bypassing it.
export async function createSignedInUser(baseURL: string) {
  const { supabase, cookies } = createCookieJarClient(baseURL);
  const email = newEmail();
  const { data, error } = await supabase.auth.signUp({ email, password: randomUUID() });
  if (error) throw error;
  if (cookies().length === 0) throw new Error("Sign-up returned no session. Is email confirmation on locally?");

  return { email, userId: data.user!.id, supabase, cookies: cookies() };
}

// Inserts an expense dated today (so it always lands in "this month") against one of the
// user's seeded categories. Amount is sen, converted the same way src/lib/money.ts would.
export async function insertExpense(supabase: SupabaseSession, userId: string, amountSen: number) {
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("kind", "expense")
    .limit(1)
    .single();
  if (categoryError) throw categoryError;

  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    category_id: category.id,
    amount: (amountSen / 100).toFixed(2),
    type: "expense",
    payment_method: "Cash",
  });
  if (error) throw error;
}

// Sets a user's budget directly, for tests that need one already in place before the page loads.
export async function setBudget(supabase: SupabaseSession, userId: string, budgetSen: number) {
  const { error } = await supabase
    .from("profiles")
    .update({ monthly_budget: (budgetSen / 100).toFixed(2) })
    .eq("id", userId);
  if (error) throw error;
}

// Starts a PKCE sign-in the way the app does, but by email, since Google can't run in a test.
// Returns the cookies holding the PKCE verifier and the URL Supabase sends the browser back to,
// which carries the one-time code for /auth/callback.
export async function startEmailSignIn(baseURL: string) {
  const { supabase, cookies } = createCookieJarClient(baseURL);
  const email = newEmail();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${baseURL}/auth/callback` },
  });
  if (error) throw error;

  // Opening the emailed link is what a user's tap does: Supabase verifies it and redirects.
  const response = await fetch(await readSignInLink(email), { redirect: "manual" });
  const callbackURL = response.headers.get("location");
  if (!callbackURL) throw new Error(`The sign-in link didn't redirect (HTTP ${response.status}).`);

  return { email, cookies: cookies(), callbackURL };
}

// The local stack delivers email to Mailpit; read the link from the newest message to `email`.
async function readSignInLink(email: string) {
  const mailpit = process.env.MAILPIT_URL!;
  const query = encodeURIComponent(`to:"${email}"`);
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = (await (await fetch(`${mailpit}/api/v1/search?query=${query}`)).json()) as {
      messages: { ID: string }[];
    };
    const [message] = search.messages;
    if (message) {
      const { HTML } = (await (await fetch(`${mailpit}/api/v1/message/${message.ID}`)).json()) as {
        HTML: string;
      };
      const href = HTML.match(/href="([^"]+)"/)?.[1];
      if (!href) throw new Error("The sign-in email has no link.");
      return href.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email for ${email} reached Mailpit.`);
}

type Session = Awaited<ReturnType<typeof createSignedInUser>>;

// Inserts rows as the signed-in user (RLS applies), bypassing the app's accounting check, so a
// test can arrange a month and then trigger the check on purpose. Amounts in sen.
export async function insertRows(
  user: Pick<Session, "supabase" | "userId">,
  rows: {
    amountSen: number;
    category: string;
    date?: string;
    type?: "expense" | "income";
    payment?: "Cash" | "eWallet" | "Card";
    essential?: boolean;
    merchant?: string | null;
    itemLabel?: string | null;
    receiptGroupId?: string | null;
  }[],
) {
  const { data: categories, error } = await user.supabase.from("categories").select("id, name, kind");
  if (error) throw error;
  const idOf = (name: string, kind: string) => {
    const found = categories!.find((c) => c.name === name && c.kind === kind);
    if (!found) throw new Error(`No ${kind} category ${name}`);
    return found.id as string;
  };
  const { error: insertError } = await user.supabase.from("transactions").insert(
    rows.map((r) => ({
      user_id: user.userId,
      category_id: idOf(r.category, r.type ?? "expense"),
      amount: (r.amountSen / 100).toFixed(2),
      type: r.type ?? "expense",
      payment_method: r.payment ?? "Cash",
      is_essential: r.essential ?? true,
      merchant: r.merchant ?? null,
      item_label: r.itemLabel ?? null,
      receipt_group_id: r.receiptGroupId ?? null,
      // Always set: a bulk insert sends the union of the rows' keys, so leaving it out on one
      // row would send null for it rather than the column default.
      date: r.date ?? todayMYT(),
    })),
  );
  if (insertError) throw insertError;
}

/** Calls the daily cron the way Vercel does, with the test-only ?date= and ?user= overrides. */
export async function runCron(baseURL: string, params: { date?: string; user?: string } = {}, token = process.env.CRON_SECRET) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const response = await fetch(`${baseURL}/api/cron/daily?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}
