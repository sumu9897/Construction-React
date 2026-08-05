import { Navigate, Route, Routes, useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useStore } from "./store";
import { TabBar, Icon, Mark, Btn } from "./ui";
import { IS_LIVE, sb } from "./lib/supabase";
import { loadOwner, loadTeam } from "./live/load";
import { touchPresence } from "./live/sync";
import SignIn from "./screens/SignIn";
import { Home, Diary, Plan, Money, More } from "./screens/owner/Tabs";
import { Risks, Selections, Variations, Visits, Documents, Questions } from "./screens/owner/Sub";
import Ask from "./screens/owner/Ask";
import { Today, Publish, PlanEditor, MoneyDesk, InboxDesk, RisksDesk, OwnersDesk, ProjectDesk, NewProject, LogDesk } from "./screens/team/Console";
import Copilot from "./screens/team/Copilot";
import Report from "./screens/team/Report";

function Guard({ role, children }) {
  const { state } = useStore();
  if (!state.session) return <Navigate to="/signin" replace />;
  if (role && state.session.role !== role)
    return <Navigate to={state.session.role === "team" ? "/team" : "/"} replace />;
  return children;
}

const OWNER_TABS = [
  { to: "/", label: "Home", icon: Icon.home, end: true },
  { to: "/diary", label: "Diary", icon: Icon.diary },
  { to: "/plan", label: "Plan", icon: Icon.plan },
  { to: "/money", label: "Money", icon: Icon.money },
  { to: "/more", label: "More", icon: Icon.more },
];

const TEAM_TABS = [
  { to: "/team", label: "Today", icon: Icon.home, end: true },
  { to: "/team/publish", label: "Publish", icon: Icon.camera },
  { to: "/team/copilot", label: "Copilot", icon: Icon.chat },
  { to: "/team/plan", label: "Plan", icon: Icon.plan },
  { to: "/team/inbox", label: "Inbox", icon: Icon.inbox },
];

/** Full-screen states used only while live mode establishes itself. */
function Splash({ children }) {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-6 px-8 text-center">
      <Mark className="h-12 w-12 text-xl" />
      {children}
    </div>
  );
}

export default function App() {
  const { state, dispatch } = useStore();
  const { pathname } = useLocation();
  const role = state.session?.role;
  const isTeam = pathname.startsWith("/team");
  const onAsk = pathname === "/ask";
  // live: checking → ready | anon | noaccess
  const [live, setLive] = useState(IS_LIVE ? "checking" : "off");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!IS_LIVE) return undefined;
    const boot = async (session) => {
      if (!session) {
        dispatch({ type: "signout" });
        setLive("anon");
        return;
      }
      try {
        const { data: profile } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        if (!profile) {
          setLive("noaccess");
          return;
        }
        const slices = profile.role === "team" ? await loadTeam() : await loadOwner(profile);
        dispatch({ type: "boot", slices });
        dispatch({ type: "signin", session: { role: profile.role, name: profile.full_name } });
        touchPresence();
        setLive("ready");
      } catch (e) {
        console.error("[live-boot]", e);
        setLive("noaccess");
      }
    };
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") boot(session);
      if (event === "SIGNED_OUT") {
        dispatch({ type: "signout" });
        setLive("anon");
      }
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (live === "checking")
    return (
      <Splash>
        <p className="type-eyebrow text-smoke">Opening your record…</p>
      </Splash>
    );
  if (live === "noaccess")
    return (
      <Splash>
        <p className="type-display text-2xl text-bone">This portal is by contract.</p>
        <p className="max-w-xs font-sans text-sm leading-relaxed text-smoke">
          Your sign-in worked, but no residence is linked to this email yet. If you hold a contract
          with PMCC, contact us and we'll connect your account.
        </p>
        <Btn tone="ghost" onClick={() => sb.auth.signOut()}>Use a different email</Btn>
      </Splash>
    );

  return (
    <>
      <div className="grain" />
      <Routes>
        <Route path="/signin" element={state.session ? <Navigate to={role === "team" ? "/team" : "/"} replace /> : <SignIn />} />

        <Route path="/" element={<Guard role="owner"><Home /></Guard>} />
        <Route path="/diary" element={<Guard role="owner"><Diary /></Guard>} />
        <Route path="/plan" element={<Guard role="owner"><Plan /></Guard>} />
        <Route path="/money" element={<Guard role="owner"><Money /></Guard>} />
        <Route path="/more" element={<Guard role="owner"><More /></Guard>} />
        <Route path="/risks" element={<Guard role="owner"><Risks /></Guard>} />
        <Route path="/selections" element={<Guard role="owner"><Selections /></Guard>} />
        <Route path="/variations" element={<Guard role="owner"><Variations /></Guard>} />
        <Route path="/visits" element={<Guard role="owner"><Visits /></Guard>} />
        <Route path="/documents" element={<Guard role="owner"><Documents /></Guard>} />
        <Route path="/questions" element={<Guard role="owner"><Questions /></Guard>} />
        <Route path="/ask" element={<Guard role="owner"><Ask /></Guard>} />

        <Route path="/team" element={<Guard role="team"><Today /></Guard>} />
        <Route path="/team/publish" element={<Guard role="team"><Publish /></Guard>} />
        <Route path="/team/plan" element={<Guard role="team"><PlanEditor /></Guard>} />
        <Route path="/team/money" element={<Guard role="team"><MoneyDesk /></Guard>} />
        <Route path="/team/inbox" element={<Guard role="team"><InboxDesk /></Guard>} />
        <Route path="/team/risks" element={<Guard role="team"><RisksDesk /></Guard>} />
        <Route path="/team/owners" element={<Guard role="team"><OwnersDesk /></Guard>} />
        <Route path="/team/project" element={<Guard role="team"><ProjectDesk /></Guard>} />
        <Route path="/team/copilot" element={<Guard role="team"><Copilot /></Guard>} />
        <Route path="/team/new" element={<Guard role="team"><NewProject /></Guard>} />
        <Route path="/team/log" element={<Guard role="team"><LogDesk /></Guard>} />
        <Route path="/team/report" element={<Guard role="team"><Report /></Guard>} />

        <Route path="*" element={<Navigate to={state.session ? (role === "team" ? "/team" : "/") : "/signin"} replace />} />
      </Routes>

      {state.session && role === "owner" && !onAsk && (
        <Link
          to="/ask"
          aria-label="Ask PMCC"
          className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-pmcc text-bone shadow-xl shadow-black/50 transition-transform active:scale-95"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <Icon.chat className="h-6 w-6" />
        </Link>
      )}
      {state.session && (role === "team" ? isTeam : true) && !onAsk && pathname !== "/signin" && (
        <TabBar tabs={role === "team" ? TEAM_TABS : OWNER_TABS} />
      )}
    </>
  );
}
