/**
 * The front door. Deliberately austere: a monogram, a phone field, nothing
 * else — if you don't hold a contract, there is nothing here for you.
 * Demo: any phone works; the code is 000000; the two chips pre-fill either
 * role so a reviewer can walk both faces in seconds.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { Mark, Btn } from "../ui";
import { IS_LIVE, sb } from "../lib/supabase";

export default function SignIn() {
  const { dispatch } = useStore();
  const nav = useNavigate();
  const [phone, setPhone] = useState(""); // live mode: this field holds the email
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState("phone"); // demo only: phone | code
  const [code, setCode] = useState("");
  const [role, setRole] = useState("owner");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInLive() {
    const email = phone.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password) {
      setErr("Enter the email and password PMCC gave you.");
      return;
    }
    setErr("");
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      console.error("[signin]", error);
      setErr("Email or password incorrect. If you've lost your access, contact PMCC.");
    }
    // Success: the auth listener in App boots the record and redirects.
  }

  function next() {
    if (phone.replace(/\D/g, "").length < 6) {
      setErr("Enter the phone number on your contract.");
      return;
    }
    setErr("");
    setStage("code");
  }

  function verify() {
    if (code !== "000000") {
      setErr("That code didn't match. Demo code: 000000");
      return;
    }
    dispatch({
      type: "signin",
      session: role === "team" ? { role: "team", name: "Site office" } : { role: "owner", name: "Rami K." },
    });
    nav(role === "team" ? "/team" : "/", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col justify-between px-6 pb-10 pt-16">
      <div className="rise">
        <Mark className="h-14 w-14 text-2xl" />
        <h1 className="type-display mt-10 text-4xl text-bone">
          The private portal
          <br />
          <em className="type-display-it text-stone">for PMCC owners.</em>
        </h1>
        <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-smoke">
          Access is by contract. Sign in with the {IS_LIVE ? "email address" : "phone number"} on
          your sale agreement.
        </p>
      </div>

      <div className="rise-2 rise">
        {IS_LIVE ? (
          <>
            <label className="block">
              <span className="type-eyebrow text-smoke">Email address</span>
              <input
                type="email"
                inputMode="email"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full border border-seam bg-transparent px-4 py-4 font-sans text-base text-bone outline-none placeholder:text-smoke/50 focus:border-stone"
              />
            </label>
            <label className="mt-3 block">
              <span className="type-eyebrow text-smoke">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signInLive()}
                placeholder="••••••••"
                className="mt-2 w-full border border-seam bg-transparent px-4 py-4 font-sans text-base text-bone outline-none placeholder:text-smoke/50 focus:border-stone"
              />
            </label>
            {err && <p className="mt-3 font-sans text-xs text-pmcc">{err}</p>}
            <Btn full className="mt-4" onClick={signInLive} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Btn>
            <p className="mt-6 text-center font-sans text-xs text-smoke">
              Your access was created by PMCC when your contract was signed.{" "}
              <a href="?demo" className="underline underline-offset-4">
                View the demo instead
              </a>
            </p>
          </>
        ) : stage === "phone" ? (
          <>
            <label className="block">
              <span className="type-eyebrow text-smoke">Phone number</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+961 3 616 222"
                className="mt-2 w-full border border-seam bg-transparent px-4 py-4 font-sans text-base text-bone outline-none placeholder:text-smoke/50 focus:border-stone"
              />
            </label>
            {err && <p className="mt-3 font-sans text-xs text-pmcc">{err}</p>}
            <Btn full className="mt-4" onClick={next} disabled={busy}>
              Continue
            </Btn>
            {(
              <>
                <div className="mt-6 flex items-center gap-3">
                  <span className="rule flex-1" />
                  <span className="font-sans text-[0.65rem] uppercase tracking-wideish text-smoke">Demo access</span>
                  <span className="rule flex-1" />
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setRole("owner"); setPhone("+961 3 000 001"); setErr(""); }}
                    className={`flex-1 border px-3 py-3 font-sans text-xs transition-colors ${role === "owner" && phone === "+961 3 000 001" ? "border-stone text-bone" : "border-seam text-smoke"}`}
                  >
                    Owner — Rami K.
                    <span className="mt-0.5 block text-[0.65rem] opacity-70">The Roof Residence</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRole("team"); setPhone("+961 3 616 222"); setErr(""); }}
                    className={`flex-1 border px-3 py-3 font-sans text-xs transition-colors ${role === "team" ? "border-stone text-bone" : "border-seam text-smoke"}`}
                  >
                    PMCC team
                    <span className="mt-0.5 block text-[0.65rem] opacity-70">Site console</span>
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <label className="block">
              <span className="type-eyebrow text-smoke">Code sent to {phone}</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="mt-2 w-full border border-seam bg-transparent px-4 py-4 text-center font-sans text-2xl tracking-[0.5em] text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
              />
            </label>
            {!IS_LIVE && <p className="mt-3 font-sans text-xs text-smoke">Demo code: 000000</p>}
            {IS_LIVE && (
              <p className="mt-3 font-sans text-xs text-smoke">
                Check your inbox (and spam, the first time) for a message from Supabase Auth.
              </p>
            )}
            {err && <p className="mt-2 font-sans text-xs text-pmcc">{err}</p>}
            <Btn full className="mt-4" onClick={verify} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Btn>
            <button
              type="button"
              onClick={() => setStage("phone")}
              className="mt-4 w-full text-center font-sans text-xs text-smoke"
            >
              Use a different number
            </button>
          </>
        )}
        <p className="mt-10 text-center font-sans text-[0.65rem] leading-relaxed text-smoke/70">
          PMCC S.A.R.L. · Since 1996 · By invitation only
        </p>
      </div>
    </div>
  );
}
