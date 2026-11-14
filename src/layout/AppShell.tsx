import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, Bell, ChevronDown, ClipboardCheck, FileText, GitBranch, GitPullRequest, LayoutDashboard, LogOut, Network, ShieldCheck, ShieldEllipsis, UploadCloud } from "lucide-react";
import { getFindings, isDemoMode, isLocalMockMode } from "../api/client";
import styles from "./AppShell.module.css";
import { useAuth } from "../auth/AuthGate";
import { useToast } from "../context/ToastContext";

const routeLabels: Array<[RegExp, string]> = [
  [/^\/$/, "Workspace"], [/^\/intake/, "Report intake"], [/^\/matrix/, "Claim evidence matrix"],
  [/^\/correlation/, "Duplicate correlation"], [/^\/review/, "Human review"], [/^\/packet/, "Investigation packet"], [/^\/impact/, "Change impact"],
];

export function AppShell() {
  const location = useLocation();
  const { mode, user, signOut } = useAuth();
  const { notify } = useToast();
  const current = routeLabels.find(([pattern]) => pattern.test(location.pathname))?.[1] || "Workspace";
  const triageActive = /^\/(correlation|review|packet)/.test(location.pathname);
  const [pinnedSha, setPinnedSha] = useState("");
  const [firstFindingId, setFirstFindingId] = useState("");
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    let active = true;
    const [, section, selectedId] = location.pathname.split("/");
    const findingId = ["matrix", "review", "packet"].includes(section) ? selectedId : undefined;
    getFindings().then((findings) => {
      const selected = (findingId && findings.find((finding) => finding.id === findingId)) || findings[0];
      if (!active) return;
      setPinnedSha(selected?.commitSha || "");
      setFirstFindingId(findings[0]?.id || "");
      setQueueCount(findings.filter((finding) => finding.lifecycle !== "RESOLVED").length);
    }).catch(() => {
      if (active) { setPinnedSha(""); setQueueCount(0); setFirstFindingId(""); }
    });
    return () => { active = false; };
  }, [location.pathname]);

  async function handleSignOut() {
    try { await signOut(); }
    catch (error) { notify(error instanceof Error ? error.message : "Sign-out failed.", "error"); }
  }

  return <div className={`${styles.root} app-shell`}>
    <div className="template-topline">
      <span>VULNFLOW / SECURITY INVESTIGATION WORKBENCH</span>
      <span className={`environment-pill ${isDemoMode ? "demo" : "connected"}`}><i />{isLocalMockMode ? "LOCAL MOCK" : isDemoMode ? "API DEMO" : "LIVE API"}</span>
    </div>
    <header className="brand-header">
      <NavLink className="brand-lockup" to="/" aria-label="VulnFlow workspace home">
        <span className="brand-mark"><ShieldEllipsis size={25} strokeWidth={2.2} /></span>
        <span className="brand-copy"><strong>VULNFLOW</strong><small>Evidence-first vulnerability triage</small></span>
      </NavLink>
      <div className="brand-details">
        <div className="brand-detail"><span>ACTIVE VIEW</span><strong>{current}</strong></div>
        <div className="brand-detail"><span>PINNED COMMIT</span><code>{pinnedSha ? pinnedSha.slice(0, 12) : "NO ANALYSIS"}</code></div>
        <div className="brand-user"><span className="user-avatar">{user?.email?.[0]?.toUpperCase() || "SR"}</span><span><strong>{mode === "live" ? (user?.email || "Authenticated user") : "Demo Reviewer"}</strong><small>{mode === "live" ? "Signed in" : "Demo workspace"}</small></span>
          {mode === "live" ? <button className="signout-control" onClick={() => void handleSignOut()} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button> : <Bell size={16} />}
        </div>
      </div>
    </header>
    <nav className="template-navigation" aria-label="Main navigation">
      <NavLink to="/" end className={({ isActive }) => `template-nav-link ${isActive ? "active" : ""}`}><LayoutDashboard size={16} /> Overview</NavLink>
      <NavLink to="/intake" className={({ isActive }) => `template-nav-link ${isActive || location.pathname.startsWith("/matrix/") ? "active" : ""}`}><UploadCloud size={16} /> Intake &amp; Evidence</NavLink>
      <details className={`template-nav-dropdown ${triageActive ? "active" : ""}`} open={triageActive}>
        <summary><ClipboardCheck size={16} /> Triage <ChevronDown size={15} />{queueCount > 0 && <span className="nav-count">{queueCount}</span>}</summary>
        <div className="template-dropdown-menu">
          <NavLink to="/correlation"><Network size={15} /> Correlation</NavLink>
          <NavLink to="/review"><ClipboardCheck size={15} /> Review queue</NavLink>
          <NavLink to={firstFindingId ? `/packet/${firstFindingId}` : "/intake"}><FileText size={15} /> Investigation packet</NavLink>
        </div>
      </details>
      <NavLink to="/impact" className={({ isActive }) => `template-nav-link ${isActive ? "active" : ""}`}><GitPullRequest size={16} /> Change Impact</NavLink>
      <a className="template-nav-docs" href="https://github.com/utkrishtchopra2008-cpu/NOVEMBER" target="_blank" rel="noreferrer">Project docs <ArrowUpRight size={14} /></a>
    </nav>
    <main className="page-content"><Outlet /></main>
    <footer className="app-footer"><span>VULNFLOW // EVIDENCE-FIRST SECURITY TRIAGE</span><span>REFERENCE CHECKS DO NOT PROVE EXPLOITABILITY</span></footer>
  </div>;
}
