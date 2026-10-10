import BackupManager from "@/components/BackupManager";
import ProfileManager from "@/components/ProfileManager";
import PushNotificationsManager from "@/components/PushNotificationsManager";
import SyncManager from "@/components/SyncManager";

export default function SettingsPage() {
  return <section className="settings-page mx-auto w-full max-w-3xl">
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Your planner</p>
    <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Settings</h1>
    <p className="mt-3 max-w-xl text-base leading-7 text-muted">Manage your profile, device reminders, and private planner backups.</p>

    <div className="mt-8 space-y-5">
      <ProfileManager />
      <SyncManager />
      <PushNotificationsManager />
      <BackupManager />
    </div>
  </section>;
}
