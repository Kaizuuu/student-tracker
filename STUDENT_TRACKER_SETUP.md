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

### 8.1 Supabase (cloud database + optional login)
1. Go to supabase.com, sign in with GitHub, and create a **New project** (free plan).
2. Copy the **Project URL** and **anon public key** from Project Settings -> API.
3. Install the client:
   ```
   npm install @supabase/supabase-js
   ```
4. Create `.env.local` in the project root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Add the same variables in Vercel: Project -> Settings -> Environment Variables.
6. Create tables in the Supabase SQL editor for synced data and for `push_subscriptions`. Turn on **Row Level Security** and add policies so each user only sees their own rows.
7. Make sure `.env.local` is in `.gitignore` (create-next-app does this by default).

### 8.2 Push notifications
1. Install:
   ```
   npm install web-push
   ```
2. Generate keys once:
   ```
   npx web-push generate-vapid-keys
   ```
3. Save them as environment variables (locally and in Vercel):
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:you@example.com
   ```
4. In the app, add an "Enable notifications" button. It must be triggered by a **tap**, then call the browser's push subscription and save the result to Supabase.
5. Add a `push` event handler to `public/sw.js` to show the notification.
6. Create an API route (for example `src/app/api/send-reminders/route.ts`) that finds items due soon and sends pushes with `web-push`. Protect it with a secret key in the request header.
7. **iOS rule:** push works only after the app is added to the Home Screen (iOS 16.4+) and the user allows notifications.

### 8.3 Scheduler (free)
1. Vercel's free plan only runs cron jobs once a day, so use **cron-job.org** (free).
2. Create a job that calls your `/api/send-reminders` URL every 5 minutes, with the secret key in a header.
3. Test by creating a task due in 10 minutes.

### 8.4 Widget (optional)
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
