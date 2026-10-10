"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

function profileName(user: User) {
  const value = user.user_metadata?.display_name;
  return typeof value === "string" ? value : "";
}

export default function ProfileManager() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const configured = isSupabaseConfigured();

  const applyUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);
    setName(nextUser ? profileName(nextUser) : "");
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      applyUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) applyUser(session?.user ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applyUser]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setWorking(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
      if (error) throw error;
      applyUser(data.user);
      setFeedback({ type: "success", text: "Your profile has been updated." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Your profile could not be saved." });
    } finally {
      setWorking(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setWorking(true);
    setFeedback(null);
    const { error } = await supabase.auth.signOut();
    setWorking(false);
    if (error) setFeedback({ type: "error", text: "Could not sign out. Please try again." });
    else {
      applyUser(null);
      setFeedback({ type: "success", text: "You’re signed out. This device’s planner data remains available." });
    }
  }

  return <section aria-labelledby="profile-heading" className="settings-card rounded-3xl border border-border bg-surface p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Your account</p>
        <h2 id="profile-heading" className="mt-1 text-xl font-semibold">Profile</h2>
      </div>
      {user && <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Signed in</span>}
    </div>
    {loading ? <p className="mt-5 rounded-2xl bg-background px-4 py-5 text-sm text-muted">Loading your profile…</p> : !configured ? <div className="mt-5 rounded-2xl border border-dashed border-border bg-background p-4"><p className="text-sm text-muted">Connect Supabase to create and manage an account profile.</p></div> : !user ? <div className="mt-5 rounded-2xl border border-border bg-background p-4">
      <p className="text-sm leading-6 text-muted">Sign in to edit your profile or create a new account. Your planner can still be used without an account.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground">Sign in</Link>
        <Link href="/signup" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Create account</Link>
      </div>
    </div> : <>
      <form onSubmit={(event) => void saveProfile(event)} className="mt-5 grid gap-4 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="profile-display-name" className="block text-sm font-medium">Name</label>
          <input id="profile-display-name" type="text" required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
        </div>
        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium">Email</label>
          <input id="profile-email" type="email" value={user.email ?? ""} readOnly className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-muted" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <button type="submit" disabled={working || !name.trim()} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:cursor-wait disabled:opacity-60">{working ? "Saving…" : "Save profile"}</button>
          <button type="button" onClick={() => void signOut()} disabled={working} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-surface disabled:opacity-50">Sign out</button>
        </div>
      </form>
      {user.created_at && <p className="mt-3 text-xs text-muted">Account created {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(user.created_at))}</p>}
    </>}
    {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${feedback.type === "error" ? "bg-red-500/5 text-red-700 dark:text-red-300" : "bg-accent/10 text-foreground"}`}>{feedback.text}</p>}
  </section>;
}
