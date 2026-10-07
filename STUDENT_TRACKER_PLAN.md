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
**P1-15: Deploy to Vercel and test install on iPhone via Add to Home Screen**

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

---

## Not yet done

### Phase 1: Core
- [x] P1-13: Backup (export all data to JSON, import it back)
- [x] P1-14: PWA setup (manifest, icons, service worker, offline, iOS meta tags)
- [ ] P1-15: Deploy to Vercel and test install on iPhone via Add to Home Screen
  - Preflight build passes. Deployment still needs a Vercel CLI sign-in and project link; the iPhone install check needs Safari on a physical iPhone.
- [ ] P1-16: Weekly Calendar — one week-at-a-glance page showing classes, tasks, exams, and events together.
- [ ] P1-17: Guided entry wizard — replace long, scroll-heavy forms with short steps, progress, back navigation, optional details, and a review before saving.

### Phase 2: Habits and smart features
- [ ] P2-01: Habits (daily check-off) with forgiving streaks (one missed day does not reset)
- [ ] P2-02: Small-version habits (e.g. "read 1 page" still counts)
- [ ] P2-03: Morning and night routines (ordered checklists)
- [ ] P2-04: Streak calendar (monthly heat map of habit completion)
- [ ] P2-05: Quick capture parser (type "Math quiz Friday 9am" -> creates the item)
- [ ] P2-06: Weekly review screen (done, overdue, next week's load)
- [ ] P2-07: Exam study reminders (auto-add prep items 7, 3, and 1 days before)
- [ ] P2-08: Notes per subject (links, room numbers, teacher info)
- [ ] P2-09: Focus timer (Pomodoro) linked to a task, with study time logged per subject
- [ ] P2-10: Habits and routines added to the Today screen

### Phase 3: Extras
- [ ] P3-01: Supabase project setup (free tier) and optional sync across devices
- [ ] P3-02: Web push notifications (iOS requires Home Screen install, iOS 16.4+)
- [ ] P3-03: Scheduler for push (free cron service) and daily summary ("3 things today")
- [ ] P3-04: Themes and light/dark customization
- [ ] P3-05: Mood/energy check-in (one tap per day) with weekly chart
- [ ] P3-06: Home screen widget workaround via the Scriptable app (needs synced data)

---

## Notes and decisions
- P1-15 is pending: this workspace has no Vercel CLI authentication or linked project, and the iPhone install check must be completed on a physical iPhone in Safari.
- Small-screen layouts reflow with the device width; long labels wrap at word boundaries, and compact controls avoid cutting words off on phone screens.
- Native iOS app was ruled out: it needs the $99/year Apple Developer account, or weekly re-signing for free sideloading.
- iOS PWAs cannot make true home screen widgets. Calendar export puts events in the built-in iOS Calendar widget.
- Exact-time reminders: use the .ics export (iOS Calendar handles alerts, even offline). Web push is a bonus in Phase 3.
- iOS can clear web storage, so keep the JSON backup feature visible in Settings.
- Vercel free plan cron runs once per day only. Use an external free scheduler for per-minute checks.

## Out of scope (for now)
Social features, grades/GPA, complicated statistics, paid services.
