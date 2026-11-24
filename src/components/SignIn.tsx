import { useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Sign in with email + password, or with an emailed link / one-time code.
 * The code matters on iPhone: a Home Screen app doesn't share sign-in with Safari,
 * so tapping the emailed link signs in Safari instead. Typing the code (or a password)
 * signs in right here.
 */
export function SignIn() {
  const [mode, setMode] = useState<"password" | "email">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<string | null>) {
    setErr(null);
    setBusy(true);
    try {
      setErr(await fn());
    } finally {
      setBusy(false);
    }
  }

  const signInWithPassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (!error) return null;
      return /invalid login/i.test(error.message)
        ? "Wrong email or password. If you haven't set a password yet, use “Email me a link or code” below, then set one in Settings."
        : error.message;
    });
  };

  const sendEmail = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(async () => {
      const { error } = await supabase!.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) return error.message;
      setSent(true);
      return null;
    });
  };

  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error } = await supabase!.auth.verifyOtp({ email, token: code.trim(), type: "email" });
      return error ? (/expired|invalid/i.test(error.message) ? "That code is wrong or expired. Send a new one." : error.message) : null;
    });
  };

  const emailField = (
    <label className="field">
      <span>Email</span>
      <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
    </label>
  );

  return (
    <div className="center-page">
      <div className="card signin">
        <img src="icon.svg" alt="" width={48} height={48} />
        <h1>LoveYourTemple</h1>

        {mode === "password" && (
          <form className="stack tight" onSubmit={signInWithPassword}>
            {emailField}
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button className="btn primary big" disabled={busy}>Sign in</button>
            <button type="button" className="link" onClick={() => { setMode("email"); setErr(null); }}>
              First time, or forgot your password? Email me a link or code
            </button>
          </form>
        )}

        {mode === "email" && !sent && (
          <form className="stack tight" onSubmit={sendEmail}>
            {emailField}
            <button className="btn primary big" disabled={busy}>Email me a link or code</button>
            <button type="button" className="link" onClick={() => { setMode("password"); setErr(null); }}>
              I have a password
            </button>
          </form>
        )}

        {mode === "email" && sent && (
          <form className="stack tight" onSubmit={verifyCode}>
            <p>
              We emailed <strong>{email}</strong>. Type the code from the email here, or tap the link in it.
            </p>
            <label className="field">
              <span>Code</span>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="btn primary big" disabled={busy}>Sign in</button>
            <p className="hint">On iPhone, use the code when signing in to the Home Screen app. The link opens Safari instead.</p>
            <button type="button" className="link" onClick={() => sendEmail()} disabled={busy}>Send a new email</button>
            <button type="button" className="link" onClick={() => { setSent(false); setCode(""); setErr(null); }}>Use a different email</button>
          </form>
        )}

        {err && <p className="error-text">{err}</p>}
      </div>
    </div>
  );
}
