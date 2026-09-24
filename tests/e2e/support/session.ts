import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";

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
