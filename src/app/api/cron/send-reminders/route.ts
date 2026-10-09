import { createClient } from "@supabase/supabase-js";
import * as webPush from "web-push";

export const runtime = "nodejs";

type BackupRecords = {
  tasks: Array<{ id: string; title: string; dueAt: string | null; completedAt: string | null; reminderMinutesBefore?: 10 | 30 | 60 | null }>;
  classes: Array<{ id: string; subjectId: string | null; dayOfWeek: number; startTime: string; reminderMinutesBefore?: 10 | 30 | 60 | null }>;
  calendarEntries: Array<{ id: string; kind: "exam" | "event"; title: string; startsAt: string; reminderMinutesBefore?: 10 | 30 | 60 | null }>;
  subjects: Array<{ id: string; name: string }>;
};
type Subscription = { endpoint: string; p256dh: string; auth: string };
type Reminder = { key: string; title: string; body: string; url: string };
type AdminClient = ReturnType<typeof createClient<any>>;

const TIME_ZONE = process.env.STUDENT_TRACKER_TIME_ZONE || "Asia/Manila";
const SUMMARY_HOUR = 7;
const DEFAULT_REMINDER_MINUTES = 10;
const REMINDER_WINDOW_MINUTES = 6;

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function localHour(date: Date, timeZone: string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date));
}

function dayOfWeek(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dateKeyAfter(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function zonedDateTime(dateKey: string, time: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let estimate = desired;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(estimate));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
    const correction = desired - represented;
    estimate += correction;
    if (correction === 0) break;
  }
  return new Date(estimate);
}

function reminderOffset(value: number | null | undefined) {
  if (value === null) return null;
  return value === 10 || value === 30 || value === 60 ? value : DEFAULT_REMINDER_MINUTES;
}

function reminderWindowIsOpen(startsAt: Date, offset: number | null, now: Date) {
  if (offset === null || !Number.isFinite(startsAt.getTime())) return false;
  const minutesUntilStart = (startsAt.getTime() - now.getTime()) / 60_000;
  return minutesUntilStart > offset - REMINDER_WINDOW_MINUTES && minutesUntilStart <= offset;
}

function reminderLeadLabel(minutes: number) {
  return minutes === 60 ? "1 hour" : `${minutes} minutes`;
}

function nextClassStart(classItem: BackupRecords["classes"][number], now: Date) {
  const today = localDateKey(now, TIME_ZONE);
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const dateKey = dateKeyAfter(today, dayOffset);
    if (dayOfWeek(dateKey) !== classItem.dayOfWeek) continue;
    const startsAt = zonedDateTime(dateKey, classItem.startTime, TIME_ZONE);
    if (startsAt > now) return startsAt;
  }
  return null;
}

function isBackup(value: unknown): value is { app: "student-tracker"; records: BackupRecords } {
  if (typeof value !== "object" || value === null) return false;
  const backup = value as { app?: unknown; records?: unknown };
  if (backup.app !== "student-tracker" || typeof backup.records !== "object" || backup.records === null) return false;
  const records = backup.records as Record<string, unknown>;
  return ["tasks", "classes", "calendarEntries", "subjects"].every((key) => Array.isArray(records[key]));
}

function remindersForBackup(records: BackupRecords, now: Date, dateKey: string): Reminder[] {
  const reminders: Reminder[] = [];
  const todayWeekday = dayOfWeek(dateKey);
  const subjectNames = new Map(records.subjects.map((subject) => [subject.id, subject.name]));

  for (const task of records.tasks) {
    if (!task || typeof task.id !== "string" || typeof task.title !== "string" || task.completedAt || !task.dueAt) continue;
    const due = new Date(task.dueAt);
    const offset = reminderOffset(task.reminderMinutesBefore);
    if (reminderWindowIsOpen(due, offset, now)) {
      reminders.push({
        key: `task:${task.id}:${task.dueAt}:before:${offset}`,
        title: "Task reminder",
        body: `${task.title} is due in ${reminderLeadLabel(offset!)}.`,
        url: "/tasks",
      });
    }
  }

  for (const entry of records.calendarEntries) {
    if (!entry || typeof entry.id !== "string" || typeof entry.title !== "string") continue;
    const startsAt = new Date(entry.startsAt);
    const offset = reminderOffset(entry.reminderMinutesBefore);
    if (reminderWindowIsOpen(startsAt, offset, now)) {
      const kind = entry.kind === "exam" ? "Exam" : "Event";
      reminders.push({
        key: `${kind.toLowerCase()}:${entry.id}:${entry.startsAt}:before:${offset}`,
        title: `${kind} reminder`,
        body: `${entry.title} starts in ${reminderLeadLabel(offset!)}.`,
        url: "/calendar",
      });
    }
  }

  for (const classItem of records.classes) {
    if (!classItem || typeof classItem.id !== "string" || !Number.isInteger(classItem.dayOfWeek) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(classItem.startTime)) continue;
    const startsAt = nextClassStart(classItem, now);
    const offset = reminderOffset(classItem.reminderMinutesBefore);
    if (!startsAt || !reminderWindowIsOpen(startsAt, offset, now)) continue;
    const subject = classItem.subjectId ? subjectNames.get(classItem.subjectId) : undefined;
    const classLabel = subject ? `${subject} class` : "Class";
    reminders.push({
      key: `class:${classItem.id}:${startsAt.toISOString()}:before:${offset}`,
      title: "Class reminder",
      body: `${classLabel} starts in ${reminderLeadLabel(offset!)}.`,
      url: "/classes",
    });
  }

  if (localHour(now, TIME_ZONE) === SUMMARY_HOUR) {
    const todayItems: Array<{ sort: string; label: string }> = [];
    for (const task of records.tasks) {
      if (!task || typeof task.id !== "string" || typeof task.title !== "string" || task.completedAt || !task.dueAt) continue;
      const due = new Date(task.dueAt);
      if (Number.isFinite(due.getTime()) && localDateKey(due, TIME_ZONE) === dateKey) {
        todayItems.push({ sort: due.toISOString(), label: task.title });
      }
    }
    for (const classItem of records.classes) {
      if (!classItem || typeof classItem.id !== "string" || classItem.dayOfWeek !== todayWeekday) continue;
      const subject = classItem.subjectId ? subjectNames.get(classItem.subjectId) : undefined;
      todayItems.push({ sort: `${dateKey}T${classItem.startTime || "23:59"}`, label: subject ? `${subject} class` : "Class" });
    }
    for (const entry of records.calendarEntries) {
      if (!entry || typeof entry.id !== "string" || typeof entry.title !== "string") continue;
      const startsAt = new Date(entry.startsAt);
      if (Number.isFinite(startsAt.getTime()) && localDateKey(startsAt, TIME_ZONE) === dateKey) {
        todayItems.push({ sort: startsAt.toISOString(), label: `${entry.kind === "exam" ? "Exam" : "Event"}: ${entry.title}` });
      }
    }
    todayItems.sort((left, right) => left.sort.localeCompare(right.sort));
    const threeThings = todayItems.slice(0, 3).map((item) => item.label);
    if (threeThings.length) {
      reminders.push({
        key: `daily-summary:${dateKey}`,
        title: "Your 3 things today",
        body: threeThings.join(" · "),
        url: "/",
      });
    }
  }

  return reminders;
}

async function sendOnce(
  supabase: AdminClient,
  userId: string,
  subscriptions: Subscription[],
  reminder: Reminder,
) {
  const { error: reserveError } = await supabase
    .from("push_delivery_log")
    .insert({ user_id: userId, delivery_key: reminder.key });
  if (reserveError) {
    if (reserveError.code === "23505") return { delivered: 0, skipped: 1, stale: [] as string[] };
    throw new Error("Could not reserve notification delivery.");
  }

  const stale: string[] = [];
  let delivered = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({ ...reminder, tag: reminder.key }),
        { TTL: 60 * 60 },
      );
      delivered += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
      if (statusCode === 404 || statusCode === 410) stale.push(subscription.endpoint);
    }
  }));

  if (stale.length) await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  if (!delivered) {
    await supabase.from("push_delivery_log").delete().eq("user_id", userId).eq("delivery_key", reminder.key);
  }
  return { delivered, skipped: 0, stale };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret) return Response.json({ error: "The scheduler is not configured." }, { status: 503 });
  if (authorization !== `Bearer ${cronSecret}`) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey || !subject) {
    return Response.json({ error: "The scheduled push service is not fully configured." }, { status: 503 });
  }

  try {
    webPush.setVapidDetails(subject, publicKey, privateKey);
    const supabase = createClient<any>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: backups, error: backupError } = await supabase.from("user_backups").select("user_id, data");
    if (backupError) throw backupError;
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth");
    if (subscriptionError) throw subscriptionError;

    const subscriptionsByUser = new Map<string, Subscription[]>();
    for (const row of subscriptions ?? []) {
      const list = subscriptionsByUser.get(row.user_id) ?? [];
      list.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
      subscriptionsByUser.set(row.user_id, list);
    }

    const now = new Date();
    const dateKey = localDateKey(now, TIME_ZONE);
    let delivered = 0;
    let skipped = 0;
    let usersChecked = 0;
    for (const backup of backups ?? []) {
      const userSubscriptions = subscriptionsByUser.get(backup.user_id) ?? [];
      if (!userSubscriptions.length || !isBackup(backup.data)) continue;
      usersChecked += 1;
      for (const reminder of remindersForBackup(backup.data.records, now, dateKey)) {
        const result = await sendOnce(supabase, backup.user_id, userSubscriptions, reminder);
        delivered += result.delivered;
        skipped += result.skipped;
      }
    }

    await supabase.from("push_delivery_log").delete().lt("created_at", new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString());
    return Response.json({ ok: true, usersChecked, delivered, skipped, timeZone: TIME_ZONE });
  } catch {
    return Response.json({ error: "Scheduled reminders could not be processed." }, { status: 500 });
  }
}
