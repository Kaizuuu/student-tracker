"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Feedback = { type: "error" | "success" | "info"; text: string };
type SerializedSubscription = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function toApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function PushNotificationsManager() {
  const [user, setUser] = useState<User | null>(null);
  const [supported, setSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [iosInstallNeeded, setIosInstallNeeded] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const configured = isSupabaseConfigured();

  const refreshSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const activeSubscription = registration ? await registration.pushManager.getSubscription() : null;
    setSubscription(activeSubscription);
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const canPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(canPush);
    setIosInstallNeeded(isIOS() && !isInstalled());
    if (!canPush) return;
    void refreshSubscription().catch(() => setFeedback({ type: "error", text: "Push notification status could not be checked." }));

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshSubscription]);

  async function saveSubscription(activeUser: User, activeSubscription: PushSubscription) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Push reminders are not connected to Supabase.");
    const serialized = activeSubscription.toJSON() as SerializedSubscription;
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
      throw new Error("This browser returned an incomplete push subscription. Try enabling notifications again.");
    }
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: activeUser.id,
      endpoint: serialized.endpoint,
      p256dh: serialized.keys.p256dh,
      auth: serialized.keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw error;
  }

  async function enableNotifications() {
    setFeedback(null);
    if (!user) {
      setFeedback({ type: "info", text: "Sign in to your private sync account first. Push subscriptions are saved to that account." });
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setFeedback({ type: "error", text: "Push notifications need the public VAPID key in this environment." });
      return;
    }

    setWorking(true);
    try {
      let nextPermission = Notification.permission;
      if (nextPermission === "default") nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setFeedback({ type: "info", text: nextPermission === "denied" ? "Notifications are blocked in browser settings. Allow them there, then try again." : "Notification permission was not granted." });
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration("/") ??
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const activeSubscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(VAPID_PUBLIC_KEY),
        });
      await saveSubscription(user, activeSubscription);
      setSubscription(activeSubscription);
      setFeedback({ type: "success", text: "Push reminders are enabled for this browser and linked to your private account." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push reminders could not be enabled.";
      setFeedback({ type: "error", text: message.includes("push_subscriptions") ? "Run the push subscription SQL setup in Supabase, then try again." : message });
    } finally {
      setWorking(false);
    }
  }

  async function disableNotifications() {
    if (!user || !subscription) return;
    setWorking(true);
    setFeedback(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Push reminders are not connected to Supabase.");
      const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      if (error) throw error;
      await subscription.unsubscribe();
      setSubscription(null);
      setFeedback({ type: "success", text: "Push reminders are turned off for this browser." });
    } catch {
      setFeedback({ type: "error", text: "Push reminders could not be turned off. Check the connection and try again." });
    } finally {
      setWorking(false);
    }
  }

  async function sendTestNotification() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setWorking(true);
    setFeedback(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again to send a test notification.");
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "A test notification could not be sent.");
      setFeedback({ type: "success", text: "Test notification sent. Check this browser or device." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "A test notification could not be sent.";
      setFeedback({ type: "error", text: message });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section aria-labelledby="push-heading" className="mt-4 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Optional · device reminders</p>
          <h2 id="push-heading" className="mt-1 text-xl font-semibold">Push notifications</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Get reminders for tasks, classes, exams, and events even when the planner is closed. Choose 10 minutes, 30 minutes, or 1 hour before each item. Upload your latest planner in Sync across devices after changes so scheduled reminders stay current.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subscription ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-accent/10 text-accent"}`}>
          {subscription ? "Enabled" : supported ? "Not enabled" : "Unavailable"}
        </span>
      </div>

      {iosInstallNeeded && <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted">On iPhone, first use Safari’s Share menu to add Student Tracker to your Home Screen, then open it from the new icon to enable push notifications.</p>}
      {!supported && <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted">This browser does not support web push notifications.</p>}
      {supported && !user && <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted">Sign in to your sync account to save this browser’s private push subscription. <Link href="/more#sync-heading" className="font-semibold text-accent underline decoration-accent/40 underline-offset-2">Open sync settings</Link>.</p>}
      {supported && permission === "denied" && <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted">Notifications are blocked by this browser. Allow them in the site settings before enabling reminders.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!subscription ? <button type="button" onClick={() => void enableNotifications()} disabled={working || !supported || !configured || !user || iosInstallNeeded || permission === "denied"} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">{working ? "Please wait…" : "Enable notifications"}</button> : <>
          <button type="button" onClick={() => void sendTestNotification()} disabled={working || !user} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:cursor-wait disabled:opacity-50">{working ? "Please wait…" : "Send a test notification"}</button>
          <button type="button" onClick={() => void disableNotifications()} disabled={working || !user} className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground disabled:cursor-wait disabled:opacity-50">Turn off</button>
        </>}
      </div>

      {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${feedback.type === "error" ? "bg-red-500/5 text-red-700 dark:text-red-300" : feedback.type === "info" ? "bg-background text-muted" : "bg-accent/10 text-foreground"}`}>{feedback.text}</p>}
    </section>
  );
}
