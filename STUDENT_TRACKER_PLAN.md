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
**P1-01: Project setup**

---

## Done
_(Move finished tasks here. Format: `- [x] ID: task. YYYY-MM-DD. note`)_

- (nothing yet)

---

## Not yet done

### Phase 1: Core
- [ ] P1-01: Project setup (Next.js, TypeScript, Tailwind, folder structure, GitHub-ready)
- [ ] P1-02: Data layer with IndexedDB (subjects, classes, tasks, subtasks, exams/events)
- [ ] P1-03: App shell with bottom tab navigation and dark mode
- [ ] P1-04: Subjects (name + color), linked to classes, tasks, and exams
- [ ] P1-05: Class schedule (recurring weekly timetable: subject, room, teacher, day, start/end) and weekly view
- [ ] P1-06: Tasks (title, due date/time, subject, priority, notes) with subtasks and progress bar
- [ ] P1-07: Exams/events (date, time, location, notes) with days-left countdown
- [ ] P1-08: Today screen ("Next up" card, today's classes, tasks due, upcoming exams, overdue in red)
- [ ] P1-09: Quick add floating "+" button (task, event, or exam in under 5 seconds)
- [ ] P1-10: Overdue rescue ("move to tomorrow" and "reschedule all overdue")
- [ ] P1-11: Due-date color coding (overdue red, due today orange, others calm)
- [ ] P1-12: "Add to Calendar" .ics export with alarms (1 day and 1 hour before by default)
- [ ] P1-13: Backup (export all data to JSON, import it back)
- [ ] P1-14: PWA setup (manifest, icons, service worker, offline, iOS meta tags)
- [ ] P1-15: Deploy to Vercel and test install on iPhone via Add to Home Screen

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
- Native iOS app was ruled out: it needs the $99/year Apple Developer account, or weekly re-signing for free sideloading.
- iOS PWAs cannot make true home screen widgets. Calendar export puts events in the built-in iOS Calendar widget.
- Exact-time reminders: use the .ics export (iOS Calendar handles alerts, even offline). Web push is a bonus in Phase 3.
- iOS can clear web storage, so keep the JSON backup feature visible in Settings.
- Vercel free plan cron runs once per day only. Use an external free scheduler for per-minute checks.

## Out of scope (for now)
Social features, grades/GPA, complicated statistics, paid services.
