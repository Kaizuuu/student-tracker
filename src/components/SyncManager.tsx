"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBackup, MAX_BACKUP_FILE_BYTES, parseBackup } from "@/lib/backup";
import { getBackupRecords, importBackupRecords } from "@/lib/db";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type CloudSnapshot = { data: unknown; updated_at: string };

function recordCount(records: object) {
  return Object.values(records).reduce((total, items) => total + (Array.isArray(items) ? items.length : typeof items === "number" ? items : 0), 0);
}

function describeTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function SyncManager() {
  const [user, setUser] = useState<User | null>(null);
  const [cloudSnapshot, setCloudSnapshot] = useState<CloudSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);
  const configured = isSupabaseConfigured();

  const refreshCloud = useCallback(async (activeUser: User) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("user_backups")
      .select("data, updated_at")
      .eq("user_id", activeUser.id)
      .maybeSingle();
    if (error) throw error;
    setCloudSnapshot(data as CloudSnapshot | null);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setFeedback({ type: "error", text: "Your sync sign-in could not be checked. Refresh and try again." });
      const activeUser = data.session?.user ?? null;
      setUser(activeUser);
      if (activeUser) void refreshCloud(activeUser).catch(() => setFeedback({ type: "error", text: "Your cloud backup could not be opened. Check the Supabase table setup and connection." }));
      setLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      setCloudSnapshot(null);
      if (activeUser) void refreshCloud(activeUser).catch(() => setFeedback({ type: "error", text: "Your cloud backup could not be opened. Check the Supabase table setup and connection." }));
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [refreshCloud]);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setWorking(true);
    setFeedback(null);
    try {
      if (createAccount) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/more` },
        });
        if (error) throw error;
        setPassword("");
        if (data.session?.user) {
          setUser(data.session.user);
          setFeedback({ type: "success", text: "Account created and signed in. Your local data is ready to sync when you choose." });
        } else {
          setCreateAccount(false);
          setFeedback({ type: "info", text: "Check your email to confirm the account, then sign in here with your password." });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword("");
        setUser(data.user);
        setFeedback({ type: "success", text: "Signed in. Choose whether to upload this device or restore your cloud backup." });
        await refreshCloud(data.user);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The sign-in request failed.";
      setFeedback({ type: "error", text: message });
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
      setUser(null);
      setCloudSnapshot(null);
      setFeedback({ type: "success", text: "Signed out. This device’s local data remains available." });
    }
  }

  async function uploadLocalData() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setWorking(true);
    setFeedback(null);
    try {
      const { data: existing, error: readError } = await supabase.from("user_backups").select("updated_at").eq("user_id", user.id).maybeSingle();
      if (readError) throw readError;
      if (existing && !window.confirm(`Replace the cloud snapshot from ${describeTime(existing.updated_at)} with this device’s current data?`)) return;

      const backup = await createBackup();
      const encoded = JSON.stringify(backup);
      if (new Blob([encoded]).size > MAX_BACKUP_FILE_BYTES) throw new Error("This snapshot is too large to sync (limit: 10 MB). Remove old records or export a local backup instead.");
      const { error } = await supabase.from("user_backups").upsert({ user_id: user.id, data: backup, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      await refreshCloud(user);
      setFeedback({ type: "success", text: `Uploaded ${recordCount(backup.records)} local records to your private cloud backup.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The cloud backup could not be uploaded.";
      setFeedback({ type: "error", text: message });
    } finally {
      setWorking(false);
    }
  }

  async function restoreCloudData() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setWorking(true);
    setFeedback(null);
    try {
      const { data: cloud, error } = await supabase.from("user_backups").select("data, updated_at").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!cloud) {
        setFeedback({ type: "info", text: "There is no cloud backup yet. Upload this device first." });
        return;
      }
      const backup = parseBackup(JSON.stringify(cloud.data));
      const localCount = recordCount(await getBackupRecords());
      const confirmation = localCount
        ? `Replace ${localCount} local records with the cloud snapshot from ${describeTime(cloud.updated_at)}? This replaces all planner data on this device.`
        : `Restore the cloud snapshot from ${describeTime(cloud.updated_at)} to this device?`;
      if (!window.confirm(confirmation)) return;
      const counts = await importBackupRecords(backup.records, "replace");
      await refreshCloud(user);
      setFeedback({ type: "success", text: `Restored ${recordCount(counts)} records to this device. Open another page to refresh its view.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The cloud backup could not be restored.";
      setFeedback({ type: "error", text: message });
    } finally {
      setWorking(false);
    }
  }

  return <section aria-labelledby="sync-heading" className="mt-5 rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Optional · private account</p>
    <div className="mt-1 flex flex-wrap items-start justify-between gap-3"><div><h2 id="sync-heading" className="text-xl font-semibold">Sync across devices</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Your planner stays on this device unless you choose to sync. Sign in on another device to upload or restore a private snapshot.</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${!configured ? "bg-background text-muted" : user ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-accent/10 text-accent"}`}>{!configured ? "Not connected" : user ? "Signed in" : "Cloud ready"}</span></div>

    {!configured ? <div className="mt-5 rounded-2xl border border-dashed border-border bg-background p-4">
      <p className="text-sm font-semibold">Connect a Supabase project to enable sync</p>
      <p className="mt-1 text-sm leading-6 text-muted">Create a free project, add its URL and anon key to <code className="rounded bg-surface px-1.5 py-0.5 text-xs">.env.local</code>, then run the supplied SQL setup. The details are in the project setup guide.</p>
      <Link href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-accent hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent">Open Supabase <span className="ml-2" aria-hidden="true">↗</span></Link>
    </div> : loading ? <p className="mt-5 rounded-2xl bg-background px-4 py-5 text-sm text-muted">Checking your sync account…</p> : !user ? <form onSubmit={(event) => void submitAuth(event)} className="mt-5 grid gap-4 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><p className="font-semibold">{createAccount ? "Create your sync account" : "Sign in to sync"}</p><p className="mt-1 text-xs leading-5 text-muted">Use the same email and password on each device. Your password is sent to Supabase Auth and is never saved in planner data.</p></div>
      <div><label htmlFor="sync-email" className="block text-sm font-medium">Email</label><input id="sync-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></div>
      <div><label htmlFor="sync-password" className="block text-sm font-medium">Password</label><input id="sync-password" type="password" required minLength={8} autoComplete={createAccount ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><button type="submit" disabled={working} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:cursor-wait disabled:opacity-60">{working ? "Please wait…" : createAccount ? "Create account" : "Sign in"}</button><button type="button" onClick={() => { setCreateAccount((current) => !current); setFeedback(null); }} className="min-h-10 rounded-xl px-3 text-sm font-medium text-accent hover:bg-accent/10">{createAccount ? "I already have an account" : "Create an account"}</button></div>
    </form> : <div className="mt-5 rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium text-muted">Signed in as</p><p className="mt-0.5 break-all font-semibold">{user.email}</p></div><button type="button" onClick={() => void signOut()} disabled={working} className="min-h-10 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface hover:text-foreground disabled:opacity-50">Sign out</button></div>
      <div className="mt-4 rounded-xl border border-border bg-surface px-3 py-3 text-sm">{cloudSnapshot ? <><p className="font-semibold">Cloud snapshot available</p><p className="mt-1 text-xs text-muted">Last uploaded {describeTime(cloudSnapshot.updated_at)}</p></> : <><p className="font-semibold">No cloud snapshot yet</p><p className="mt-1 text-xs text-muted">Upload this device to create your first copy.</p></>}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void uploadLocalData()} disabled={working} className="min-h-12 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:cursor-wait disabled:opacity-60">{working ? "Working…" : "Upload this device"}</button><button type="button" onClick={() => void restoreCloudData()} disabled={working || !cloudSnapshot} className="min-h-12 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-50">Restore cloud backup</button></div>
      <p className="mt-3 text-xs leading-5 text-muted">Sync is manual and replaces the cloud snapshot on upload. Restore replaces local data after confirmation. Your device remains usable offline.</p>
    </div>}

    {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${feedback.type === "error" ? "bg-red-500/5 text-red-700 dark:text-red-300" : feedback.type === "info" ? "bg-background text-muted" : "bg-accent/10 text-foreground"}`}>{feedback.text}</p>}
  </section>;
}
