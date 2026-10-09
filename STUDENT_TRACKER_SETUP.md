# Student Tracker: Setup Tutorial (Windows)

Covers the front end, database, hosting, and the Phase 3 back end. Everything here is free.
Commands may change over time, so if one fails, check the official docs for that tool.

## Stack at a glance
| Part | Tool | Phase |
|---|---|---|
| Front end | Next.js + TypeScript + Tailwind (PWA) | 1 |
| Database (on phone) | IndexedDB via `idb` | 1 |
| Code storage | Git + GitHub | 1 |
| Hosting | Vercel (free Hobby plan) | 1 |
| Back end | Next.js API routes (on Vercel) | 3 |
| Cloud database / sync | Supabase (free tier) | 3 |
| Push notifications | `web-push` + free scheduler (cron-job.org) | 3 |

---

## Part 1: Install your tools (one time)

1. **Node.js (LTS)**: download from nodejs.org, or in PowerShell:
   ```
   winget install OpenJS.NodeJS.LTS
   ```
2. **Git**:
   ```
   winget install Git.Git
   ```
3. **VS Code**:
   ```
   winget install Microsoft.VisualStudioCode
   ```
4. Close and reopen PowerShell, then check:
   ```
   node -v
   npm -v
   git --version
   ```
5. Set your Git identity:
   ```
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
6. Create free accounts: **GitHub** (github.com) and **Vercel** (vercel.com, sign up with GitHub).

---

## Part 2: Create the project (front end)

1. In PowerShell, go to the folder where you keep projects, then run:
   ```
   npx create-next-app@latest student-tracker
   ```
   Choose: TypeScript **Yes**, ESLint **Yes**, Tailwind **Yes**, `src/` directory **Yes**, App Router **Yes**, Turbopack **Yes**, import alias **No** (keep default).
2. Go into the folder and start it:
   ```
   cd student-tracker
   npm run dev
   ```
3. Open http://localhost:3000 to confirm it works.
4. Put `STUDENT_TRACKER_PLAN.md` in the project root folder.

---

## Part 3: Database on the phone (IndexedDB)

1. Install the helper library:
   ```
   npm install idb
   ```
2. Create `src/lib/db.ts`. It opens one versioned database with stores for `subjects`, `classes`, `tasks`, `subtasks`, and `calendarEntries` (exams and events).
3. Define shared record shapes in `src/types/records.ts`. Every screen reads and writes through `src/lib/db.ts` so storage can be swapped for Supabase sync in Phase 3.
4. Useful extras for later phases:
   ```
   npm install date-fns
   ```
   (date handling for countdowns, recurring classes, and quick capture)

**Important:** iOS can clear web storage. Use **More -> Backup and restore** to download a JSON copy or restore one later.

---

## Part 4: Make it a PWA

1. **Manifest:** `src/app/manifest.ts` defines the app identity, standalone display, colors, scope, and install icons.
2. **Icons:** `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and `apple-touch-icon.png` provide standard, maskable, and iOS home-screen artwork.
3. **iOS meta tags:** `src/app/layout.tsx` sets `appleWebApp` metadata and a `viewport` with `viewport-fit=cover`.
4. **Service worker:** `public/sw.js` precaches the app shell and offline page, saves successful document navigations and hashed Next.js assets for later use, and clears old app caches on activation. `src/components/ServiceWorkerRegistration.tsx` registers it only in production. User data remains in IndexedDB and is never copied into the HTTP cache.
5. **Test:** run `npm run build` then `npm start`, open in Chrome, press F12 -> **Application** tab, and check Manifest and Service Workers. Turn off the network to verify the offline page and previously opened pages.

---

## Part 5: Put it on GitHub

1. In the project folder:
   ```
   git add .
   git commit -m "Initial commit"
   ```
2. On github.com, click **New repository**, name it `student-tracker` (private is fine), and do **not** add a README.
3. Copy the two commands GitHub shows and run them:
   ```
   git remote add origin https://github.com/YOUR-USERNAME/student-tracker.git
   git push -u origin main
   ```

---

## Part 6: Deploy on Vercel (hosting)

1. Go to vercel.com -> **Add New -> Project**.
2. Import the `student-tracker` repository.
3. Leave the defaults (Next.js is detected automatically) and click **Deploy**.
4. You get a link like `student-tracker.vercel.app`. Every `git push` redeploys automatically.
5. The Hobby plan is for personal, non-commercial use, which fits this project.

---

## Part 7: Install it on the iPhone

1. On the iPhone, open the Vercel link in **Safari** (it must be Safari).
2. Tap **Share -> Add to Home Screen -> Add**.
3. Open it from the new icon. It should run full screen with no browser bar.
4. No iPhone for testing? Use Chrome on your PC: F12 -> device toolbar icon -> choose "iPhone". This tests layout only, not iOS install behavior.

---

## Part 8: Phase 3 back end and notifications

Only start this after Phases 1-2 are done.

### 8.1 Supabase (optional cloud sync)
1. Go to [supabase.com](https://supabase.com), sign in, and create a **New project** on the free plan, or select the existing free project you want to use.
2. In Project Settings -> API Keys (or the project Connect dialog), copy the **Project URL** and a **publishable key**. A legacy `anon` key also works. Never put a `secret` or `service_role` key in the app; browser keys are safe only when Row Level Security is enabled and correctly configured.
3. Copy `.env.example` to `.env.local` in the project root, then fill in the URL and publishable key. Keep `.env.local` out of Git; it is ignored by this repository:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
4. In Supabase -> SQL Editor, run [`supabase/user_backups.sql`](supabase/user_backups.sql). It creates the one-row-per-user JSON backup table and policies that restrict each signed-in user to their own data.
5. In Authentication -> URL Configuration, set the Site URL to the production app URL `https://student-tracker-git-main-rence6.vercel.app/more`. Add these redirect URLs (include the port you actually use locally):
   ```
   http://localhost:3000/more
   http://localhost:3003/more
   https://student-tracker-git-main-rence6.vercel.app/more
   ```
   Keep Email provider enabled. Sign-up may require the user to confirm their email before signing in.
   The configured project's Site URL now points to the production app, so confirmation links without a matching per-request redirect return to Student Tracker instead of localhost.
6. Restart the local dev server after editing `.env.local`. In Vercel -> Project -> Settings -> Environment Variables, add the same URL and publishable key for Production, Preview, and Development, then redeploy after the latest source is in the connected Git branch so the client bundle receives them. This workspace has already added these two public client variables to the `student-tracker` Vercel project.
7. Open More -> Sync across devices. Create an account once, then sign in with that email and password on each device. Upload and restore are manual. Upload replaces the cloud snapshot; restore replaces local data only after confirmation. Local-only use and offline access continue to work.

The app stores each synced dataset as a validated Student Tracker backup, so new record types remain compatible with the existing backup/restore format. The browser uses the Supabase publishable key and authenticated user session; database Row Level Security is what restricts access to the signed-in user.
This repository is already configured with a `.gitignore` rule for `.env.local`. The connected Supabase project has email sign-up enabled and requires email confirmation by default. The local configuration uses the project's publishable key; never use a secret or `service_role` key in the browser app.

### 8.2 Push notifications
1. Install the server-side sender and types:
   ```
   npm install web-push
   npm install --save-dev @types/web-push
   ```
2. Generate a VAPID key pair once:
   ```
   npx web-push generate-vapid-keys
   ```
3. Save the public key and subject in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_SUBJECT`; save the private key in `VAPID_PRIVATE_KEY`. Keep the private key server-only and store it in ignored `.env.local` locally. Add the variables to Vercel for Production, Preview, and Development before deploying. In Vercel, store `VAPID_PRIVATE_KEY` as a Secret; the public key and subject can be Config variables:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=https://your-app-domain.example
   ```
   The values for the `student-tracker` Vercel project have been added for all three environments. A new deployment is required before they take effect.
4. Run [`supabase/push_subscriptions.sql`](supabase/push_subscriptions.sql) in Supabase. It stores one browser subscription per endpoint and restricts access to its signed-in owner with RLS.
   The push-subscription table and its owner-only RLS policies were applied successfully to the configured Supabase project on 2026-10-09.
5. In More -> Push notifications, sign in to the private sync account and tap **Enable notifications**. The permission prompt must follow a user tap. Use **Send a test notification** to verify delivery; the authenticated endpoint sends to that user's saved browsers only.
6. `public/sw.js` displays incoming push messages and opens the app when a notification is tapped. The subscription interface is in `src/components/PushNotificationsManager.tsx`; the authenticated test sender is `src/app/api/push/test/route.ts`.
7. **iOS rule:** push works only after the app is added to the Home Screen (iOS 16.4+) and the user allows notifications. The scheduler for due reminders is a separate P3-03 task.

### 8.3 Scheduler (free)
The scheduled sender is `GET /api/cron/send-reminders`. It reads each private synced backup on the server and sends one push per item at its selected reminder time: **10 minutes**, **30 minutes**, **1 hour**, **1 day**, or **No reminder**. This applies to unfinished tasks with a due time, the next occurrence of each weekly class, and exams/events. The job checks every 5 minutes, so an alert can arrive up to about 5 minutes after the selected lead time. It also sends a daily “Your 3 things today” push at 7:00 AM in `STUDENT_TRACKER_TIME_ZONE` (defaults to `Asia/Manila`); the daily list can include tasks, classes, and exams/events. Devices need notifications enabled, and the latest planner snapshot must be uploaded in More -> Sync across devices after adding or changing an item.

The **Send a test notification** button verifies device push delivery only; it does not exercise item timing. To test the scheduled reminder, create a real item for a few minutes ahead, choose a lead time whose window is approaching, upload the latest snapshot, and let the next five-minute job run.

1. Apply [`supabase/push_delivery_log.sql`](supabase/push_delivery_log.sql) in Supabase SQL Editor. This private table prevents duplicate sends when the scheduler retries.
2. In Vercel -> Project -> Settings -> Environment Variables, add `SUPABASE_SERVICE_ROLE_KEY` as a **Secret** for Production. Find the service-role/secret key in Supabase Project Settings -> API Keys. It is used only by the server route to read private backups and must never use a `NEXT_PUBLIC_` name or be added to client code. Add `CRON_SECRET` as a **Secret** too. Generate a random value locally, for example in PowerShell:
   ```powershell
   $bytes = New-Object byte[] 32
   [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
   [Convert]::ToBase64String($bytes)
   ```
   If you want a timezone other than Manila, set `STUDENT_TRACKER_TIME_ZONE` to a valid IANA zone such as `America/Los_Angeles`. Redeploy after adding environment variables.
3. In cron-job.org, create an enabled job for `https://student-tracker-eight-xi.vercel.app/api/cron/send-reminders`, schedule it every 5 minutes, and set the request header `Authorization` to `Bearer <the same CRON_SECRET value>`. Do not include the secret in the URL. The production job is configured in the signed-in cron-job.org account. Use this verified public production domain; `student-tracker-rence6.vercel.app` and the Git branch URL redirect to Vercel sign-in and cannot be called by the scheduler.
4. Verify the endpoint in cron-job.org History. A successful request returns JSON with `ok: true`; the first scheduled request returned HTTP 200 on 2026-10-09. For an end-to-end reminder check, enable push, add a task/class/exam/event with a 10-minute reminder, upload the latest snapshot, and let the next scheduled run occur within the reminder window. The notification is sent once per item occurrence; the daily summary sends once per user/day. An expired browser subscription is removed automatically.

Vercel Hobby cron only runs once per day, so the free external scheduler is needed for the 5-minute task reminder window. The Production Vercel project has `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` saved as Secrets. The enabled five-minute cron-job.org job has returned HTTP 200 from the public production domain.

### 8.4 Android notification behavior

The service worker requests a brief vibration and keeps the notification in the shade until dismissed. Web apps cannot select a custom notification sound or force a heads-up banner; Android/Xiaomi notification settings control those behaviors. On the phone, long-press a Student Tracker notification -> open its settings -> choose **Alerting** (not Silent), enable **Pop on screen** or **Floating notifications**, and choose the sound you prefer if the device offers a sound setting for that notification category. Check Do Not Disturb and Xiaomi battery/background restrictions if alerts remain delayed. Menu names vary by MIUI/HyperOS version.

### 8.5 Install the app

On Android Chrome, open `https://student-tracker-eight-xi.vercel.app/`, then use the ⋮ menu and choose **Install app** or **Add to Home screen**. The Git branch URL redirects to Vercel sign-in, so do not use that URL for installation. If an older shortcut is already installed, remove that old icon and add Student Tracker again so Android fetches the versioned blue folder artwork from the manifest. On iPhone, open the site in Safari -> Share -> Add to Home Screen. The More page now includes an install button when the browser offers its native prompt.

### 8.6 Widget (optional)
Use the free **Scriptable** app on iPhone to build a home screen widget that reads data from Supabase. This is an extra, not required.

---

## Part 9: Daily workflow

1. Open the project in VS Code, run `npm run dev`.
2. Work with Codex one task at a time from `STUDENT_TRACKER_PLAN.md`.
3. Test on your PC, then:
   ```
   git add .
   git commit -m "Describe what you built"
   git push
   ```
4. Vercel redeploys in about a minute. Refresh the app on the phone to get the update. If it looks stale, close and reopen it so the new service worker takes over.

## Troubleshooting
- **Update not showing on iPhone:** close the app fully and reopen; if needed, bump the cache version in `sw.js`.
- **Can't install:** make sure she used Safari, and the site is on HTTPS (Vercel is by default).
- **Data disappeared:** iOS cleared storage. Restore from the JSON backup.
- **Push not arriving:** check it was added to the Home Screen first, the permission is allowed in iPhone Settings, and the VAPID keys match in Vercel.
- **Build fails on Vercel:** run `npm run build` locally to see the same error.
