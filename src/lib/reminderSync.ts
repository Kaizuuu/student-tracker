import { createBackup, MAX_BACKUP_FILE_BYTES } from "@/lib/backup";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let activeSync: Promise<void> | null = null;
let syncAgain = false;

async function syncOnce() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration || !(await registration.pushManager.getSubscription())) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return;

  const backup = await createBackup();
  const encoded = JSON.stringify(backup);
  if (new Blob([encoded]).size > MAX_BACKUP_FILE_BYTES) {
    throw new Error("This planner is too large to sync for background reminders.");
  }

  const { error } = await supabase.from("user_backups").upsert({
    user_id: session.user.id,
    data: backup,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Uploads the latest planner snapshot when this browser has push enabled. */
export async function syncReminderBackupNow() {
  if (activeSync) {
    syncAgain = true;
    await activeSync;
    return;
  }

  activeSync = (async () => {
    do {
      syncAgain = false;
      await syncOnce();
    } while (syncAgain);
  })();

  try {
    await activeSync;
  } finally {
    activeSync = null;
  }
}

/** Coalesces a burst of local edits into one latest-snapshot upload. */
export function queueReminderBackupSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    void syncReminderBackupNow().catch(() => {
      // Local planner changes remain saved; the next edit or app open retries the upload.
    });
  }, 800);
}
