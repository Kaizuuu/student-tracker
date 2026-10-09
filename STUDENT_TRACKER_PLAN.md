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
**P3-03: Scheduler for push and daily summary**

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
- [x] P3-07: Import classes from a schedule screenshot. 2026-10-08; mobile review refinement 2026-10-09. Added in-browser OCR, editable day/time/subject suggestions, existing-subject matching, new-subject creation, duplicate warnings, weekday-grouped selection, unassigned-day handling, and a confirm-before-save flow in `src/components/ScheduleImageImport.tsx` and `src/components/ClassesManager.tsx`; production build passed.
- [x] P3-08: Premium subject, option, date, time, and text-entry controls. 2026-10-08. Replaced native dropdowns and date fields with shared themed pickers across classes, tasks, calendar entries, focus setup, backup import, and quick capture; unified input/textarea surfaces, placeholder contrast, and focus styling in `src/components/ChoicePicker.tsx`, `src/components/DatePicker.tsx`, `src/components/DateTimePicker.tsx`, `src/components/TimePicker.tsx`, and `src/app/globals.css`; production build passed.

---

## Not yet done

### Phase 1: Core
- [x] P1-13: Backup (export all data to JSON, import it back)
- [x] P1-14: PWA setup (manifest, icons, service worker, offline, iOS meta tags)
- [ ] P1-15: Deploy to Vercel and test install on iPhone via Add to Home Screen
  - Deployment and PWA endpoints are verified at `https://student-tracker-git-main-rence6.vercel.app/`. Defer the physical iPhone install check until the user returns to it.

### Phase 2: Habits and smart features
- [x] P2-07: Exam study reminders (auto-add prep items 7, 3, and 1 days before)
- [x] P2-08: Notes per subject (links, room numbers, teacher info)
- [x] P2-09: Focus timer (Pomodoro) linked to a task, with study time logged per subject

### Phase 3: Extras
- [x] P3-02: Web push notifications (iOS requires Home Screen install, iOS 16.4+). 2026-10-09. Built the tap-to-enable flow, account-private subscription storage, service-worker push display/click handling, and authenticated test-push route. Applied `supabase/push_subscriptions.sql`; VAPID settings are saved in Vercel for all environments with the private key stored as a Secret. The user confirmed a test push works on their Xiaomi phone in Chrome.
- [x] P3-03: Scheduler for push (free cron service), per-item reminder timing, and daily summary ("3 things today"). 2026-10-09. `GET /api/cron/send-reminders` handles reminders for unfinished tasks, recurring classes, exams, and events at 10 minutes, 30 minutes, 1 hour, or 1 day before (10 minutes is the default); `No reminder` is also available per item. It still sends a once-daily 7:00 AM summary, with per-user delivery deduplication in `supabase/push_delivery_log.sql`. SQL is applied; Vercel Production has the server-only service-role key and cron secret; the enabled cron-job.org job runs every five minutes in Asia/Manila and has returned HTTP 200. Items must be uploaded to the synced backup after changes. Setup steps are in `STUDENT_TRACKER_SETUP.md`.
- [ ] P3-04: Themes and light/dark customization
- [ ] P3-05: Mood/energy check-in (one tap per day) with weekly chart
- [ ] P3-06: Home screen widget workaround via the Scriptable app (needs synced data)
- [x] P3-07: Import class schedules from screenshots. Completed 2026-10-08; OCR runs in the browser and suggestions are reviewed before saving.
- [x] P3-08: Replace generic choice, date, and time controls with branded pickers and unify text-entry fields. Completed 2026-10-08.

---

## Notes and decisions
- P1-15 is partly complete and deferred at the user's request: the deployed app and PWA endpoints load, but standalone installation still needs verification in Safari on a physical iPhone. The user asked to finish Phase 2 before downloading/installing, so no download or release step is being done yet.
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
- P3-03: the delivery-log table is applied in Supabase; `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are saved as Production-only Vercel Secrets. The enabled cron-job.org job “Student Tracker reminder delivery” calls the public production endpoint every five minutes in Asia/Manila with its bearer secret in the Authorization header. The first scheduled run returned HTTP 200 on 2026-10-09.
- 2026-10-09 notification/install refinement: push notifications remain visible until dismissed and request a brief vibration; Android still controls sound and heads-up behavior through the site/app notification category. Added an install card with native install action when available, Android/iPhone instructions, updated service-worker cache version, and versioned manifest icon URLs so new installs fetch the current branding.
- 2026-10-09 reminder timing: task due dates, weekly class starts, and exam/event start times support 10-minute, 30-minute, 1-hour, 1-day, or off reminders. The five-minute scheduler uses the per-item setting from the most recently uploaded cloud backup; new and legacy items default to 10 minutes.
- 2026-10-09 motion polish: added short page transitions and picker pop-in motion with reduced-motion support, plus springier touch feedback for buttons.
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
