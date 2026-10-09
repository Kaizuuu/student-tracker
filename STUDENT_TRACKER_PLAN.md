# Student Tracker: Project Plan and Progress Tracker

> Single source of truth for the whole project. Put this file in the repo root.
> Codex: read this file at the start of every session and update it at the end.

## Goal
A free, mobile-first PWA that works like a real tracker. It reminds the user of tasks, classes, exams, and events, and helps build habits and routines. Used on iPhone (Safari -> Add to Home Screen). Personal use only, so everything must stay free.

## Tech stack
- Next.js (App Router), TypeScript, Tailwind CSS
- Local storage in IndexedDB (`idb` library). No login in Phases 1-2.
- PWA: manifest, service worker, offline support, iOS standalone meta tags
- Hosting: Vercel (free Hobby plan) + GitHub
- Phase 3 only: Supabase free tier, free scheduler (e.g. cron-job.org)

## Rules for Codex (read before working)
1. Work on **one task at a time**, in order, starting from "Next up".
2. Do not start the next phase until every task in the current phase is in **Done**.
3. When a task is finished and tested (app runs, no TypeScript errors):
   - Move its line from **Not yet done** to **Done**.
   - Change `[ ]` to `[x]` and add the date and a short note (what was built, key files).
   - Update **Next up** to the first remaining task.
4. If a task is partly finished, leave it in Not yet done and add a sub-note on what remains.
5. If a task is blocked or changes, write the reason under **Notes and decisions**.
6. Keep the code modular so later phases can be added without rewrites.
7. Everything must stay free. Do not add paid services.
8. Mobile first: large touch targets, bottom tab navigation, dark mode.

---

## Next up
**P3-05: Mood/energy check-in**

---

## Done
- [x] P1-01: Project setup. 2026-10-07. Branded the starter app, documented the stack and workflow, and added the base source folders; production build and local server verified.
- [x] P1-02: Data layer with IndexedDB. 2026-10-07. Added typed subject, class, task, subtask, and exam/event records plus versioned IndexedDB schema and shared CRUD helpers in `src/lib/db.ts`; build and local server verified.
- [x] P1-03: App shell with bottom tab navigation and dark mode. 2026-10-07. Added shared responsive shell, four tab routes, and persisted/system-aware theme toggle in `src/components` and `src/lib/theme.ts`; production build and all routes verified.
- [x] P1-04: Subjects (name + color), linked to classes, tasks, and exams. 2026-10-07. Added subject create/edit/remove with color selection, linked item counts, and atomic unlinking in `src/components/SubjectsManager.tsx` and `src/lib/db.ts`; production build and pages verified.
- [x] P1-05: Class schedule and weekly view. 2026-10-07. Added recurring weekly classes with subject, day, time, room, and teacher editing plus a seven-day schedule view in `src/components/ClassesManager.tsx`; production build and schedule routes verified.
- [x] P1-06: Tasks with subtasks and progress. 2026-10-07. Added task create/edit/complete/remove, due date/time, subject, priority, notes, subtask checklists, and progress bars in `src/components/TasksManager.tsx`; task removal deletes its subtasks atomically in `src/lib/db.ts`. Production build and browser route verified.
- [x] P1-07: Exams/events with countdowns. 2026-10-07. Added create/edit/remove for dated exams and events, optional subject/location/notes, upcoming and past sections, local-date countdown labels, and a link from More in `src/components/CalendarEntriesManager.tsx`, `src/app/calendar/page.tsx`, and `src/app/more/page.tsx`; production build and phone-width browser route verified.
- [x] P1-08: Today dashboard. 2026-10-07. Added next-up selection across today's classes, timed tasks, and calendar entries; today's classes and due tasks; upcoming exams/events; and an overdue task panel in red in `src/components/TodayDashboard.tsx` and `src/app/page.tsx`; production build and phone-width routes verified.
- [x] P1-09: Quick add. 2026-10-07. Added a floating app-wide plus button with task, exam, and event choices, concise forms, sensible date/time defaults, and IndexedDB saving in `src/components/QuickAdd.tsx` and `src/components/AppShell.tsx`; production build and all three phone-width forms verified.
- [x] P1-10: Overdue rescue. 2026-10-07. Added per-task move-to-tomorrow and confirmed bulk rescheduling from Today; atomic IndexedDB updates preserve each task's local time in `src/components/TodayDashboard.tsx` and `src/lib/db.ts`; production build and phone-width dashboard verified.
- [x] P1-11: Due-date color coding. 2026-10-07. Added shared local-date tones for overdue (red), due today (orange), upcoming (calm), and completed/no-date items (muted) across task cards, the Today dashboard, and exam/event countdowns in `src/lib/dueDateTone.ts`, `src/components/TasksManager.tsx`, `src/components/TodayDashboard.tsx`, and `src/components/CalendarEntriesManager.tsx`; production build and phone-width pages verified.
- [x] P1-12: Add to Calendar export. 2026-10-07. Added per-task and per-exam/event `.ics` downloads with UTC event times, escaped/folded text, and default 1-day and 1-hour display alarms in `src/lib/ics.ts`, `src/components/TasksManager.tsx`, and `src/components/CalendarEntriesManager.tsx`; production build and phone-width pages verified.
- [x] P1-13: Backup and restore. 2026-10-07. Added consistent JSON export for subjects, classes, tasks, subtasks, and exams/events plus validated atomic merge or confirmed replace import in `src/lib/backup.ts`, `src/lib/db.ts`, and `src/components/BackupManager.tsx`, linked from More; production build and phone-width UI verified.
- [x] P1-14: PWA setup. 2026-10-07. Added the App Router manifest, branded 192/512 and maskable/iOS icons, production-only service worker registration, offline fallback and conservative app-shell/static caching, plus iOS standalone and safe-area metadata in `src/app/manifest.ts`, `public/sw.js`, `public/offline.html`, and `src/components/ServiceWorkerRegistration.tsx`; production build and manifest, icon, worker, and metadata endpoints verified.
- [x] P1-15: Deploy to Vercel. 2026-10-09. Connected the GitHub `main` branch to Vercel, verified production deployment and PWA endpoints at `https://student-tracker-eight-xi.vercel.app/`; the physical iPhone install check is tracked separately as P1-18.
- [x] P1-16: Weekly Calendar. 2026-10-07. Reworked the calendar into Daily, swipeable Weekly, and compact Monthly views with activity-type filters, Low/Mid/High task-priority filters, responsive day cards capped at three previews with a “View all” action, and category dots in `src/components/WeeklyCalendar.tsx`; production build and local `/week` route verified.
- [x] P1-17: Guided entry wizard. 2026-10-07. Replaced the long task, class, and exam/event forms with shared essentials, optional-details, and review steps, including progress, back/next navigation, validation, and save actions in `src/components/EntryWizard.tsx`, `src/components/TasksManager.tsx`, `src/components/ClassesManager.tsx`, and `src/components/CalendarEntriesManager.tsx`; production build and TypeScript validation passed.
- [x] P2-01: Habits with forgiving streaks. 2026-10-07. Added local daily habit creation/check-off and one-missed-day streaks, with history stored in IndexedDB v2 and included in backup/restore in `src/components/HabitsManager.tsx`, `src/lib/habits.ts`, `src/lib/db.ts`, and `src/lib/backup.ts`; production build and local `/habits` route verified.
- [x] P2-02: Small-version habits. 2026-10-07. Added optional small-version text when creating and editing habits, separate Full and small check-in actions, and records which version was completed while preserving P2-01 history/backup compatibility in `src/components/HabitsManager.tsx`, `src/lib/db.ts`, `src/lib/backup.ts`, and `src/types/records.ts`; production build and local `/habits` route verified.
- [x] P2-03: Morning and night routines. 2026-10-07. Added ordered daily checklists with create, edit, reorder, check-off, and delete actions in `src/components/RoutinesManager.tsx`, with IndexedDB v3 schema and backup/restore support in `src/lib/db.ts`, `src/lib/backup.ts`, and `src/types/records.ts`; linked from More and verified build and local `/routines` route.
- [x] P2-04: Streak calendar. 2026-10-07. Added a month heat map showing daily habit check-ins, month navigation, completion intensity, and a selected-day completion summary in `src/components/HabitStreakCalendar.tsx`, included on the habits page; production build and local `/habits` route verified.
- [x] P2-05: Quick capture parser. 2026-10-07. Added a Today capture flow that parses relative/named/numeric dates, 12/24-hour times, and priority phrases into an editable task preview before saving in `src/lib/quickCapture.ts` and `src/components/QuickCapture.tsx`; wired it to refresh Today in `src/components/TodayDashboard.tsx`; production build and local Today route verified.
- [x] P2-06: Weekly review screen. 2026-10-07. Added a More-linked weekly summary of completed tasks and habit/routine check-ins, overdue tasks, and next week’s classes/tasks/exams/events grouped by day in `src/components/WeeklyReview.tsx` and `src/app/review/page.tsx`; production build and local `/review` route verified.
- [x] P2-07: Exam study reminders. 2026-10-07. Exams now create linked prep tasks 7, 3, and 1 local calendar days before; existing exams are backfilled once, future reminders follow edited exam dates, and generated tasks are marked in `src/lib/examReminders.ts`, `src/components/CalendarEntriesManager.tsx`, `src/components/TodayDashboard.tsx`, `src/components/TasksManager.tsx`, `src/types/records.ts`, and `src/lib/backup.ts`; production build passed.
- [x] P2-08: Notes per subject. 2026-10-07. Subjects now store and display room, teacher, notes, and up to 15 validated web links; older records remain compatible and backup import/export preserves the fields in `src/components/SubjectsManager.tsx`, `src/types/records.ts`, and `src/lib/backup.ts`; production build passed.
- [x] P2-09: Focus timer. 2026-10-07. Added persistent 25/5 and 50/10 Pomodoro timers linked to tasks, focus-session logging and today/all-time totals by subject, plus IndexedDB v4 and backward-compatible backup v4 support in `src/components/FocusTimer.tsx`, `src/app/focus/page.tsx`, `src/app/more/page.tsx`, `src/lib/db.ts`, `src/lib/backup.ts`, and `src/types/records.ts`; production build passed.
- [x] P2-10: Habits and routines on Today. 2026-10-08. Added a compact Today rhythm card with daily habit check-ins, forgiving streaks, full/small versions, morning/night routine switching, progress, and direct IndexedDB completion updates in `src/components/TodayRhythm.tsx` and `src/components/TodayDashboard.tsx`; production build passed.
- [x] P3-01: Supabase project setup and optional sync across devices. 2026-10-09. Configured the existing free project, private `user_backups` table with per-user RLS, email auth and redirects, ignored local environment values, and Vercel public client variables; production build passed. The user confirmed sign-in and cross-device sync work between the computer and Xiaomi Chrome.
- [x] P3-02: Web push notifications. 2026-10-09. Added per-device enable/disable, account-private subscription storage, service-worker notifications and click handling, plus an authenticated test-push route. VAPID settings are saved in Vercel; the user confirmed a test push works on their Xiaomi phone in Chrome.
- [x] P3-03: Scheduler for push, per-item timing, and daily summary. 2026-10-09. `GET /api/cron/send-reminders` sends an automatic advance reminder one day before plus the user's selected 10-minute, 30-minute, or 1-hour alert for unfinished tasks, recurring classes, exams, and events. “No reminder” disables both. The one-day alert is not a selectable option; legacy 1-day-only backup values now receive the default 10-minute alert too. The enabled cron-job.org job runs every minute in Asia/Manila from the verified public production domain and returned HTTP 200 after the latest deployment. A daily “Your 3 things today” summary runs at 7:00 AM. The scheduler reads the latest uploaded cloud backup; setup is documented in `STUDENT_TRACKER_SETUP.md`.
- [x] P3-04: Themes and light/dark customization. 2026-10-08 to 2026-10-09. Applied the user's pastel-blue and white visual theme across the app, retained the light/dark toggle, and improved muted text and pastel surfaces for legibility in light mode. Updated `src/app/globals.css`, `src/components/ThemeToggle.tsx`, `src/lib/theme.ts`, app metadata, and PWA colors/icons; production build and phone screenshots verified.
- [x] P3-07: Import classes from a schedule screenshot. 2026-10-08; mobile review refinement 2026-10-09. Added in-browser OCR, editable day/time/subject suggestions, existing-subject matching, new-subject creation, duplicate warnings, weekday-grouped selection, unassigned-day handling, and a confirm-before-save flow in `src/components/ScheduleImageImport.tsx` and `src/components/ClassesManager.tsx`; production build passed.
- [x] P3-08: Premium subject, option, date, time, and text-entry controls. 2026-10-08. Replaced native dropdowns and date fields with shared themed pickers across classes, tasks, calendar entries, focus setup, backup import, and quick capture; unified input/textarea surfaces, placeholder contrast, and focus styling in `src/components/ChoicePicker.tsx`, `src/components/DatePicker.tsx`, `src/components/DateTimePicker.tsx`, `src/components/TimePicker.tsx`, and `src/app/globals.css`; production build passed.
- [x] P3-09: Premium motion polish. 2026-10-09. Added short page transitions, an animated choice-picker opening, and smoother touch feedback with reduced-motion support in `src/app/globals.css`, `src/components/AppShell.tsx`, and `src/components/ChoicePicker.tsx`; production build passed and the update is deployed.
- [x] P3-10: App branding and install experience. 2026-10-09. Applied the user's blue-folder logo with a transparent background to the app header and PWA, Apple touch, maskable, and browser-tab icons; added install guidance and a native install action where supported, and versioned icon/cache assets so installed apps can update. Updated `src/components/AppShell.tsx`, `src/components/PwaInstallCard.tsx`, `src/components/PwaInstallProvider.tsx`, `src/app/manifest.ts`, `public/sw.js`, and the icon assets.
- [x] P3-11: Mobile layout and notification refinements. 2026-10-09. Fixed narrow/enlarged-screen wrapping in screenshot-import and backup flows, improved responsive action sizing, and tuned push notifications to remain visible with vibration while leaving sound and heads-up behavior to Android/Xiaomi settings. Updated `src/components/ScheduleImageImport.tsx`, `src/components/BackupManager.tsx`, `src/components/AppShell.tsx`, and `public/sw.js`; verified on the user's phone screenshots and push test.
- [x] P3-12: Mobile overflow, reminder choices, and calendar date focus. 2026-10-09. Constrained wizard controls and grid children to the available viewport, hid scrollbar chrome without disabling touch scrolling, made day-before reminders automatic with 10-minute/30-minute/1-hour user choices, and made Weekly center the selected day while Daily opens today (or the tapped weekly date). Updated `src/app/globals.css`, `src/components/EntryWizard.tsx`, `src/components/WeeklyCalendar.tsx`, `src/components/ReminderPicker.tsx`, and the reminder scheduler; production build and TypeScript validation passed.
- [x] P3-13: In-app and browser reminder delivery. 2026-10-09. Added a local IndexedDB reminder monitor for open app sessions and a dismissible in-app reminder surface; service-worker push alerts now also appear inside the open app while retaining system/browser notifications. Closed-app scheduled push still reads the latest explicitly uploaded cloud snapshot. Updated `src/components/ReminderCenter.tsx`, `src/components/AppShell.tsx`, `src/components/PushNotificationsManager.tsx`, `public/sw.js`, and notification guidance.

---

## Not yet done

### Phase 1: Core
- [ ] P1-18: Verify Add to Home Screen installation on a physical iPhone
  - Deployment and PWA setup are complete. The user asked to finish app work before downloading/installing, so keep this device-specific check parked until they are ready.

### Phase 3: Extras
- [ ] P3-05: Mood/energy check-in (one tap per day) with weekly chart
- [ ] P3-06: Home screen widget workaround via the Scriptable app (needs synced data)

---

## Notes and decisions
- P1-18 is deferred at the user's request: deployment and PWA setup are complete, but standalone installation still needs verification in Safari on a physical iPhone. Finish app work before asking the user to install it.
- P2-01 forgiving streaks count completed check-in days and allow a gap of one local calendar day between check-ins; two missed days break the current streak.
- Today previews up to three habits and four routine steps at a time, with links to the full habit and routine screens, so large lists do not overwhelm the dashboard.
- P1-16 calendar layout follows the user's reference: keep the existing theme, use a horizontal day carousel for Weekly, a focused agenda for Daily, and a denser month grid for Monthly. Keep type and task-priority filters available.
- 2026-10-08 visual refresh: applied a unified, iOS-inspired premium visual system across the app with system typography, refined light/dark surfaces, softer card depth, accessible motion/focus states, floating glass navigation, and a Today layout with a date strip and pastel-blue agenda panel inspired by the user's reference. The app theme is now pastel blue and white, including PWA metadata and icons. Explicit light/dark utilities follow the selected app theme, and light-mode muted text uses darker blue-gray for legibility.
- P3-07 was added and completed ahead of P3-01 at the user's request. Screenshot OCR is performed in the browser; the first use downloads Tesseract OCR assets, the image itself is not uploaded, and the user reviews all proposed classes before they are saved locally.
- P3-07 mobile review refinement: suggestions are grouped into weekday tabs, each row can be selected or deselected, unclear days stay unassigned instead of defaulting to Monday, and long OCR text/details stay within the mobile layout. Review and correct the OCR day grouping against the user's timetable before importing.
- P3-08 was added and completed ahead of P3-01 at the user's request.
- P3-01 setup is complete. The existing Supabase project is connected locally and in Production; its private backup table is protected by per-user RLS. The publishable key is used in browser code; no secret/service-role key is exposed. The user confirmed account sign-in and cross-device sync from computer to Xiaomi Chrome.
- P3-02 push delivery was confirmed by the user on their Xiaomi phone in Chrome on 2026-10-09. The Supabase push subscription table and owner-only RLS policies are applied; VAPID settings are configured in Vercel. Commit `05327c1` is deployed to Production.
- P3-03 reads synced backups only on the server using the Supabase service-role key, protected by a separate bearer secret for the scheduler. The daily summary defaults to 7:00 AM Asia/Manila, configurable with `STUDENT_TRACKER_TIME_ZONE`.
- P3-03: the delivery-log table is applied in Supabase; `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are saved as Production-only Vercel Secrets. The enabled cron-job.org job “Student Tracker reminder delivery” calls the public production endpoint every minute in Asia/Manila with its bearer secret in the Authorization header. The first scheduled run returned HTTP 200 on 2026-10-09.
- 2026-10-09 notification/install refinement: push notifications remain visible until dismissed and request a brief vibration; Android still controls sound and heads-up behavior through the site/app notification category. Added an install card with native install action when available, Android/iPhone instructions, updated service-worker cache version, and versioned manifest icon URLs so new installs fetch the current branding.
- 2026-10-09 reminder timing: task due dates, weekly class starts, and exam/event start times always get an automatic day-before reminder plus the selected 10-minute, 30-minute, or 1-hour heads-up. Users can turn all reminders off. The one-minute scheduler uses the per-item setting from the most recently uploaded cloud backup; new and legacy items default to day-before plus 10 minutes.
- 2026-10-09 mobile/calendar refinement: form controls and wizard grid children are constrained to the available width; horizontal and vertical scrolling remain usable with scrollbar chrome hidden. Weekly opens centered on the selected date (today by default); Daily opens on today's date when chosen from the view switcher, while selecting a Weekly day opens that exact date in Daily.
- 2026-10-09 notification refinement: while the app is open, the device checks its local IndexedDB schedule for task, weekly class, exam, and event reminders and presents a dismissible in-app alert. Incoming Web Push also creates the browser notification and an in-app alert in a visible app tab. When the app is closed, scheduled alerts still require push enabled on that browser and a current cloud snapshot uploaded in Sync; enabling push does not silently upload planner records.
- 2026-10-09 motion polish: added short page transitions and picker pop-in motion with reduced-motion support, plus springier touch feedback for buttons in `src/app/globals.css`, `src/components/AppShell.tsx`, and `src/components/ChoicePicker.tsx`. Commit `989aa07` passed `npm run build`, was pushed to `main`, and Vercel Production reached Ready.
- 2026-10-09 scheduler verification: the cron job is enabled in Asia/Manila. Its verified public endpoint is `https://student-tracker-eight-xi.vercel.app/api/cron/send-reminders`; the scheduled request at 12:40 PM returned HTTP 200. The alternate `student-tracker-rence6.vercel.app` domain returned a 302 redirect and is not used by the scheduler.
- 2026-10-09 app branding update: replaced the header mark and PWA, Apple touch, maskable, and browser-tab icons with the user's blue folder reference. The logo PNG has a transparent background; installed icons use the app's pastel-blue tile. Updated `src/components/AppShell.tsx`, `public/icon-*.png`, `public/apple-touch-icon.png`, `src/app/favicon.ico`, and the service-worker cache version.
- 2026-10-09 phone screenshot refinement: constrained the backup/restore section and grid children to the available width and allowed action labels to wrap on narrow or enlarged layouts in `src/components/BackupManager.tsx` and `src/components/AppShell.tsx`; the production screenshot confirmed the updated header logo and responsive layout.
- Small-screen layouts reflow with the device width; long labels wrap at word boundaries, and compact controls avoid cutting words off on phone screens.
- Native iOS app was ruled out: it needs the $99/year Apple Developer account, or weekly re-signing for free sideloading.
- iOS PWAs cannot make true home screen widgets. Calendar export puts events in the built-in iOS Calendar widget.
- Exact-time reminders: use the .ics export (iOS Calendar handles alerts, even offline). Web push is a bonus in Phase 3.
- iOS can clear web storage, so keep the JSON backup feature visible in Settings.
- Vercel free plan cron runs once per day only. Use an external free scheduler for per-minute checks.

## Out of scope (for now)
Social features, grades/GPA, complicated statistics, paid services.
