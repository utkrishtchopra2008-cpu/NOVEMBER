import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, Bell, ChevronRight, CircleHelp, ClipboardCheck, FileText, GitBranch, GitPullRequest, LayoutDashboard, Network, ShieldEllipsis, ShieldCheck, UploadCloud } from "lucide-react";
import { getFindings, isDemoMode } from "../api/client";
import styles from "./AppShell.module.css";

const navigation = [
  { label: "OVERVIEW", items: [{ to: "/", label: "Command center", icon: LayoutDashboard }] },
  { label: "INVESTIGATION", items: [
    { to: "/intake", label: "Report intake", icon: UploadCloud },
    { to: "/matrix/VF-1042", label: "Evidence matrix", icon: ShieldCheck },
    { to: "/correlation", label: "Correlation", icon: Network },
    { to: "/review", label: "Review queue", icon: ClipboardCheck },
    { to: "/packet/VF-1042", label: "Investigation packets", icon: FileText },
  ] },
  { label: "CONTINUOUS", items: [{ to: "/impact", label: "Impact analysis", icon: GitPullRequest }] },
];
const routeLabels: Array<[RegExp, string]> = [
  [/^\/$/, "Command center"], [/^\/intake/, "Report intake"], [/^\/matrix/, "Evidence matrix"],
  [/^\/correlation/, "Correlation"], [/^\/review/, "Human review"], [/^\/packet/, "Investigation packet"], [/^\/impact/, "Impact analysis"],
];

export function AppShell() {
  const location = useLocation();
  const current = routeLabels.find(([pattern]) => pattern.test(location.pathname))?.[1] || "Command center";
  const [pinnedSha, setPinnedSha] = useState("");
  const [firstFindingId, setFirstFindingId] = useState("");
  const [queueCount, setQueueCount] = useState(0);
  useEffect(() => {
    let active = true;
    const [, section, selectedId] = location.pathname.split("/");
    const findingId = ["matrix", "review", "packet"].includes(section) ? selectedId : undefined;
    getFindings().then((findings) => {
      const selected = (findingId && findings.find((finding) => finding.id === findingId)) || findings[0];
      if (active) {
        setPinnedSha(selected?.commitSha || "");
        setFirstFindingId(findings[0]?.id || "");
        setQueueCount(findings.filter((finding) => finding.lifecycle !== "RESOLVED").length);
      }
    }).catch(() => { if (active) { setPinnedSha(""); setQueueCount(0); setFirstFindingId(""); } });
    return () => { active = false; };
  }, [location.pathname]);
  return <div className={`${styles.root} app-shell`}>
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark"><ShieldEllipsis size={22} strokeWidth={2.2} /></div><div><strong>VULNFLOW</strong><span>SECURITY WORKBENCH</span></div></div>
      <div className="workspace-switch"><div className="workspace-avatar">V</div><div><strong>{isDemoMode ? "Local Demo" : "VulnFlow Workspace"}</strong><span>{isDemoMode ? "Illustrative data" : "FastAPI configured"}</span></div><ChevronRight size={15} /></div>
      <nav className="side-nav" aria-label="Main navigation">
        {navigation.map((group) => <div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map((item) => {
          const Icon = item.icon;
          const target = item.to.startsWith("/matrix/") ? (firstFindingId ? `/matrix/${firstFindingId}` : "/intake") : item.to.startsWith("/packet/") ? (firstFindingId ? `/packet/${firstFindingId}` : "/intake") : item.to;
          const active = item.to.startsWith("/matrix") ? location.pathname.startsWith("/matrix/") : item.to.startsWith("/packet") ? location.pathname.startsWith("/packet/") : undefined;
          return <NavLink key={item.to} to={target} end={item.to === "/"} className={({ isActive }) => `nav-link ${active ?? isActive ? "nav-link-active" : ""}`}><Icon size={17} /><span>{item.label}</span>{item.label === "Review queue" && queueCount > 0 && <span className="nav-count">{queueCount}</span>}</NavLink>;
        })}</div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-status"><span className="live-dot" /><span>{isDemoMode ? "Local mock data" : "API endpoint configured"}</span><span className="status-version">v0.1</span></div>
        <button className="sidebar-help" onClick={() => window.open("https://github.com/utkrishtchopra2008-cpu/NOVEMBER", "_blank", "noopener,noreferrer")}><CircleHelp size={16} /> Project documentation <ArrowUpRight size={13} /></button>
        <div className="sidebar-user"><div className="user-avatar">SR</div><div><strong>Security Reviewer</strong><span>Reviewer workspace</span></div><Bell size={16} /></div>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <div className="breadcrumbs"><span>VulnFlow</span><ChevronRight size={14} /><strong>{current}</strong></div>
        <div className="topbar-right"><span className={isDemoMode ? "environment-pill demo" : "environment-pill connected"}><span />{isDemoMode ? "LOCAL MOCK" : "API CONFIGURED"}</span><div className="commit-pill"><GitBranch size={14} /><span>PINNED COMMIT</span><code>{pinnedSha ? pinnedSha.slice(0, 8) : "NO ANALYSIS"}</code></div><button className="icon-button topbar-bell" aria-label="Notifications"><Bell size={17} /><i /></button></div>
      </header>
      <main className="page-content"><Outlet /></main>
      <footer className="app-footer"><span>VULNFLOW // EVIDENCE-FIRST SECURITY TRIAGE</span><span>REFERENCE CHECKS ≠ EXPLOITABILITY VERDICTS</span></footer>
    </div>
  </div>;
}