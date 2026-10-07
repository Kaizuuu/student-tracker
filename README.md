# Student Tracker

A free, mobile-first student planner built as a Progressive Web App. It is designed for personal use, with local-first data storage and no account required in the first two phases.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS
- IndexedDB through `idb`
- `date-fns` for date handling

## Get started

Requires Node.js LTS and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

Useful checks:

```bash
npm run lint
npm run build
```

## Project layout

```text
src/
  app/          App Router pages, layouts, and global styles
  components/   Shared interface components
  lib/          Shared utilities and the local data layer
  types/        Shared TypeScript types
public/         Static assets and, later, PWA files
```

Keep screen code independent of storage details by reading and writing through the data layer in `src/lib`. This leaves room for optional sync later without tying screens to a database implementation.

## Project plan

Work through [`STUDENT_TRACKER_PLAN.md`](./STUDENT_TRACKER_PLAN.md) in order. Setup details and the hosting workflow are in [`STUDENT_TRACKER_SETUP.md`](./STUDENT_TRACKER_SETUP.md).
