/**
 * The live-mode switch. URL and anon key are public by design — every
 * visitor's browser receives them; row-level security in the database is
 * what actually guards the data.
 *
 * Demo mode remains reachable at /app/?demo — the seeded walkthrough,
 * untouched, for showing the product without touching real records.
 */
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://gqgqnognxdcwgkwtxknf.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZ3Fub2dueGRjd2drd3R4a25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjYyMjYsImV4cCI6MjEwMTQwMjIyNn0.J4YjmJw4EDFRGkB8eHlROGEO3s_4op-eV6-gPTajVGU";

// ?demo enters demo mode and it sticks for the tab (router redirects strip
// the query string); ?live leaves it.
const demoFlag = (() => {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.search.includes("live")) sessionStorage.removeItem("pmcc-demo");
    else if (window.location.search.includes("demo")) sessionStorage.setItem("pmcc-demo", "1");
    return Boolean(sessionStorage.getItem("pmcc-demo"));
  } catch {
    return window.location.search.includes("demo");
  }
})();

export const IS_LIVE = typeof window !== "undefined" && !demoFlag;

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/**
 * Create an account for someone else WITHOUT touching the current session:
 * a throwaway client signs the new user up and is discarded. Requires
 * "Confirm email" to be off in the project's auth settings — accounts here
 * are cut by PMCC and handed over, not self-served.
 */
export async function createAccount(email, password) {
  const tmp = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await tmp.auth.signUp({ email, password });
  if (error) throw error;
}

/** A password a human can read over the phone: word-word-digits. */
const WORDS = ["cedar", "stone", "ridge", "pine", "terrace", "garden", "summit", "valley", "arch", "beam"];
export function suggestPassword() {
  const w = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${w()}-${w()}-${Math.floor(1000 + Math.random() * 9000)}`;
}
