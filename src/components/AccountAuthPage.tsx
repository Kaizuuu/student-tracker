"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export default function AccountAuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setCurrentEmail(data.session?.user.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setCurrentEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setWorking(true);
    setFeedback(null);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/settings`,
          },
        });
        if (error) throw error;
        setPassword("");
        if (data.session) {
          router.replace("/settings");
          return;
        }
        setFeedback({ type: "success", text: "Your account is ready. Check your email to confirm it, then sign in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword("");
        router.replace("/settings");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your account request could not be completed.";
      setFeedback({ type: "error", text: message });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="account-auth-page mx-auto w-full max-w-xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Student Tracker account</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{isSignup ? "Create your profile" : "Welcome back"}</h1>
      <p className="mt-3 max-w-lg text-base leading-7 text-muted">{isSignup ? "Create an account to keep a private profile and sync your planner across devices." : "Sign in to manage your profile and private planner backup."}</p>

      {currentEmail ? <div className="mt-8 rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <p className="font-semibold">You’re already signed in</p>
        <p className="mt-2 break-all text-sm text-muted">{currentEmail}</p>
        <Link href="/settings" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground">Go to settings</Link>
      </div> : !configured ? <div role="status" className="mt-8 rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="font-semibold">Accounts aren’t connected yet</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Connect the project’s Supabase account settings to enable sign-up and sign-in.</p>
        <Link href="/settings" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Back to settings</Link>
      </div> : <form onSubmit={(event) => void submit(event)} className="mt-8 grid gap-4 rounded-3xl border border-border bg-surface p-5 sm:p-8">
        {isSignup && <div>
          <label htmlFor="account-name" className="block text-sm font-medium">Name</label>
          <input id="account-name" type="text" required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>}
        <div>
          <label htmlFor="account-email" className="block text-sm font-medium">Email</label>
          <input id="account-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>
        <div>
          <label htmlFor="account-password" className="block text-sm font-medium">Password</label>
          <input id="account-password" type="password" required minLength={8} autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>
        <p className="text-xs leading-5 text-muted">Your password is handled by Supabase Auth and isn’t saved with your planner data.</p>
        {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${feedback.type === "error" ? "bg-red-500/5 text-red-700 dark:text-red-300" : "bg-accent/10 text-foreground"}`}>{feedback.text}</p>}
        <button type="submit" disabled={working} className="min-h-12 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:cursor-wait disabled:opacity-60">{working ? "Please wait…" : isSignup ? "Create account" : "Sign in"}</button>
      </form>}

      {!currentEmail && configured && <p className="mt-5 text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New to Student Tracker? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-accent underline underline-offset-4">{isSignup ? "Sign in" : "Create an account"}</Link>
      </p>}
    </section>
  );
}
