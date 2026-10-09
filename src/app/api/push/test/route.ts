import { createClient } from "@supabase/supabase-js";
import * as webPush from "web-push";

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!supabaseUrl || !supabaseKey || !publicKey || !privateKey || !subject) {
    return Response.json({ error: "Push notifications are not fully configured on the server." }, { status: 503 });
  }
  if (!token) return Response.json({ error: "Sign in to send a test notification." }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userResult, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userResult.user) return Response.json({ error: "Your session expired. Sign in again." }, { status: 401 });

  const { data: subscriptions, error: queryError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userResult.user.id);
  if (queryError) return Response.json({ error: "Push subscriptions could not be loaded. Check the Supabase setup." }, { status: 503 });
  if (!subscriptions?.length) return Response.json({ error: "Enable notifications on this browser first." }, { status: 404 });

  try {
    webPush.setVapidDetails(subject, publicKey, privateKey);
  } catch {
    return Response.json({ error: "The VAPID keys are invalid. Check the push setup." }, { status: 503 });
  }

  let sent = 0;
  const staleEndpoints: string[] = [];
  for (const row of subscriptions as PushSubscriptionRow[]) {
    try {
      await webPush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({ title: "Student Tracker", body: "Push notifications are working on this device.", url: "/more", tag: "student-tracker-test" }),
        { TTL: 60 * 60 },
      );
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
      if (statusCode === 404 || statusCode === 410) staleEndpoints.push(row.endpoint);
    }
  }

  if (staleEndpoints.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }
  if (!sent) return Response.json({ error: "The push service rejected this subscription. Enable notifications again on this device." }, { status: 410 });
  return Response.json({ sent });
}
