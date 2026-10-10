"use client";

import type { ReactNode } from "react";

/** Adds page-scoped hooks for the shared planner visual system. */
export default function SavedPageDesign({ page, children }: { page: "tasks" | "week" | "review" | "subjects" | "more"; children: ReactNode }) {
  return <div className={`saved-page saved-page-${page}`} data-design="study-studio">{children}</div>;
}
