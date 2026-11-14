import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, AlertCircle, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { configureAccessTokenProvider, getApiMode } from "../api/client";
import { getAuthClient } from "./client";

type Mode = "local" | "demo" | "live";
interface AuthContextValue { mode: Mode; user: User | null; signOut: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be called under AuthGate.");
  return value;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | "loading" | "unavailable" | "unconfigured">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let current = true;
    let unsubscribe: (() => void) | undefined;
    setMode("loading");
    setError("");
    void (async () => {
      try {
        const apiMode = await getApiMode();
        if (!current) return;
        if (apiMode !== "live") {
          configureAccessTokenProvider(async () => null);
          setMode(apiMode);
          return;
        }

        const client = getAuthClient();
        if (!client) {
          setMode("unconfigured");
          return;
        }

        // The session library handles refreshing browser tokens. FastAPI still validates
        // the bearer on every protected request and scopes results to the user ID.
        configureAccessTokenProvider(async () => {
          const { data, error: sessionError } = await client.auth.getSession();
          return sessionError ? null : data.session?.access_token || null;
        });
        const { data: listener } = client.auth.onAuthStateChange((event, session) => {
          if (!current) return;
          if (event === "SIGNED_OUT") setUser(null);
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            setUser(session?.user || null);
          }
        });
        unsubscribe = () => listener.subscription.unsubscribe();

        // Check the authenticating server, not just a user object from browser storage.
        const { data, error: userError } = await client.auth.getUser();
        if (!current) return;
        setUser(userError ? null : data.user);
        setMode("live");
      } catch (issue) {
        if (!current) return;
        setError(issue instanceof Error ? issue.message : "The API could not be reached.");
        setMode("unavailable");
      }
    })();
    return () => { current = false; unsubscribe?.(); };
  }, [retry]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getAuthClient();
    if (!client) return;
    setBusy(true);
    setLoginError("");
    try {
      const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      const { data, error: userError } = await client.auth.getUser();
      if (userError || !data.user) throw new Error("Could not verify the signed-in session.");
      setUser(data.user);
      setPassword("");
    } catch (issue) {
      setPassword("");
      setLoginError(issue instanceof Error ? issue.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const client = getAuthClient();
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) throw new Error("Sign-out failed. Please retry.");
    setUser(null);
    setEmail("");
    setPassword("");
  }

  if (mode === "local" || mode === "demo" || (mode === "live" && user)) {
    return <AuthContext.Provider value={{ mode, user, signOut }}>{children}</AuthContext.Provider>;
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-logo"><ShieldCheck size={26} /><div><strong>VULNFLOW</strong><span>SECURITY INVESTIGATION WORKBENCH</span></div></div>
      {mode === "loading" ? <div className="auth-message" role="status"><LoaderCircle size={22} /><h1>Connecting to the API</h1><p>Checking the backend mode and your session.</p></div>
      : mode === "unavailable" ? <div className="auth-message" role="alert"><AlertCircle size={23} /><h1>API unavailable</h1><p>{error || "Cannot reach FastAPI."} No local-demo fallback was activated.</p><button className="button button-primary" onClick={() => setRetry((value) => value + 1)}>Retry connection</button></div>
      : mode === "unconfigured" ? <div className="auth-message" role="alert"><AlertCircle size={23} /><h1>Live authentication not configured</h1><p>Configure the browser-safe VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for the same Supabase project used by FastAPI. Never use a service-role or secret key.</p><button className="button button-secondary" onClick={() => setRetry((value) => value + 1)}>Recheck configuration</button></div>
      : <div className="auth-form-wrap">
        <div className="auth-section-heading"><span className="eyebrow">AUTHORIZED REVIEWERS ONLY</span><h1>Sign in to continue</h1><p>Your account is verified by Supabase Auth. FastAPI enforces access on every request.</p></div>
        <form onSubmit={(event) => void signIn(event)} className="auth-form">
          <label className="field-label" htmlFor="auth-email">Email address</label>
          <input id="auth-email" type="email" required autoComplete="username" placeholder="reviewer@organization.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
          <label className="field-label" htmlFor="auth-password">Password</label>
          <input id="auth-password" type="password" required autoComplete="current-password" placeholder="Your account password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          {loginError && <div className="form-error" role="alert">{loginError}</div>}
          <button type="submit" className="button button-primary button-large" disabled={busy}>{busy ? <><LoaderCircle size={16} /> Signing in…</> : <><LockKeyhole size={16} /> Sign in <ArrowRight size={16} /></>}</button>
        </form>
        <p className="auth-footnote">Use an existing authorized account. No self-service registration or permission escalation is provided.</p>
      </div>}
    </section>
  </main>;
}
