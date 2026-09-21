import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";

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
// session cookies. A new user each time starts with a zero budget.
export async function createSignedInUser(baseURL: string) {
  const { supabase, cookies } = createCookieJarClient(baseURL);
  const email = newEmail();
  const { error } = await supabase.auth.signUp({ email, password: randomUUID() });
  if (error) throw error;
  if (cookies().length === 0) throw new Error("Sign-up returned no session. Is email confirmation on locally?");

  return { email, cookies: cookies() };
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
