"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { syncReminderBackupNow } from "@/lib/reminderSync";
import { defaultReminderSettings, getReminderSettings, saveReminderSettings } from "@/lib/reminderSettings";
import type { ReminderScheduleSettings } from "@/types/reminders";

type Feedback = { type: "error" | "success" | "info"; text: string };
type SerializedSubscription = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};
type ReminderTimeKey = Exclude<keyof ReminderScheduleSettings, "timeZone">;

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
  const [iosDevice, setIosDevice] = useState(false);
  const [iosInstallNeeded, setIosInstallNeeded] = useState(false);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reminderSettings, setReminderSettings] = useState<ReminderScheduleSettings>(defaultReminderSettings);
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
    setIosDevice(isIOS());
    setIosInstallNeeded(isIOS() && !isInstalled());
    setReminderSettings(getReminderSettings());
    if (!canPush) return;
    void refreshSubscription().then(() => syncReminderBackupNow()).catch(() => setFeedback({ type: "error", text: "Push status was checked, but the planner could not sync for background reminders. Check your connection and sign-in." }));

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

  function changeReminderTime(key: ReminderTimeKey, value: string) {
    const next = saveReminderSettings({ ...reminderSettings, [key]: value });
    setReminderSettings(next);
    void syncReminderBackupNow().then(() => {
      setFeedback({ type: "success", text: "Reminder time saved. It will sync to background notifications when push is enabled." });
    }).catch(() => {
      setFeedback({ type: "error", text: "Reminder time is saved on this device, but could not sync to your account. Check your connection and sign-in." });
    });
  }

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
      try {
        await syncReminderBackupNow();
        setFeedback({ type: "success", text: "Push notifications are enabled. Planner changes will sync automatically for background reminders." });
      } catch {
        setFeedback({ type: "error", text: "Push is enabled, but the planner could not sync for background reminders. Check your connection and sign-in." });
      }
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
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Tasks, classes, events, and exams use their saved schedules. Daily habits, routines, and streak nudges use the times below. A running focus timer can also alert you when it ends. With push enabled, this browser automatically uploads planner changes to your private account so reminders can arrive while the app is closed. On iPhone or iPad, use the Home Screen app from Safari on iOS/iPadOS 16.4 or later.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subscription ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-accent/10 text-accent"}`}>
          {subscription ? "Enabled" : supported ? "Not enabled" : "Unavailable"}
        </span>
      </div>

      {iosInstallNeeded && <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted">On iPhone or iPad, use Safari’s Share menu to add Student Tracker to your Home Screen (iOS/iPadOS 16.4 or later), then open it from the new icon before enabling push.</p>}
      {!supported && <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted">{iosDevice ? "iPhone and iPad push requires iOS/iPadOS 16.4 or later and Student Tracker opened from its Home Screen icon." : "This browser does not support web push notifications."}</p>}
      {supported && !user && <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted">Sign in to your sync account to save this browser’s private push subscription. <Link href="/settings#sync-heading" className="font-semibold text-accent underline decoration-accent/40 underline-offset-2">Open sync settings</Link>.</p>}
      {supported && permission === "denied" && <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 text-muted">Notifications are blocked by this browser. Allow them in the site settings before enabling reminders.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!subscription ? <button type="button" onClick={() => void enableNotifications()} disabled={working || !supported || !configured || !user || iosInstallNeeded || permission === "denied"} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">{working ? "Please wait…" : "Enable notifications"}</button> : <>
          <button type="button" onClick={() => void sendTestNotification()} disabled={working || !user} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:cursor-wait disabled:opacity-50">{working ? "Please wait…" : "Send a test notification"}</button>
          <button type="button" onClick={() => void disableNotifications()} disabled={working || !user} className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground disabled:cursor-wait disabled:opacity-50">Turn off</button>
        </>}
      </div>

      <fieldset className="mt-5 rounded-2xl border border-border bg-background p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold">Daily habit and routine reminders</legend>
        <p className="mb-4 text-xs leading-5 text-muted">Times use {reminderSettings.timeZone}. A reminder is sent only when something is still unchecked.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["habitTime", "Habit check-in"],
            ["morningRoutineTime", "Morning routine"],
            ["nightRoutineTime", "Night routine"],
            ["streakNudgeTime", "Streak nudge"],
          ] as Array<[ReminderTimeKey, string]>).map(([key, label]) => <label key={key} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium">
            <span>{label}</span>
            <input type="time" value={reminderSettings[key]} onChange={(event) => changeReminderTime(key, event.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-2 text-sm tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" aria-label={`${label} reminder time`} />
          </label>)}
        </div>
      </fieldset>

      {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${feedback.type === "error" ? "bg-red-500/5 text-red-700 dark:text-red-300" : feedback.type === "info" ? "bg-background text-muted" : "bg-accent/10 text-foreground"}`}>{feedback.text}</p>}
    </section>
  );
}
