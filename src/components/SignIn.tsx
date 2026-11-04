import { useState } from "react";
import { supabase } from "../lib/supabase";

/** Passwordless sign-in: Supabase emails a one-time link. */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="center-page">
      <form className="card signin" onSubmit={send}>
        <img src="icon.svg" alt="" width={48} height={48} />
        <h1>LoveYourTemple</h1>
        {sent ? (
          <p>Check <strong>{email}</strong> for a sign-in link. You can close this tab.</p>
        ) : (
          <>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn primary big">Email me a sign-in link</button>
            {err && <p className="error-text">{err}</p>}
          </>
        )}
      </form>
    </div>
  );
}
