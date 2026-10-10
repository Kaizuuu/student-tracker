"use client";

import type { ReactNode } from "react";

/** Adds the saved Night Index composition while inheriting the existing Field Notes colors. */
export default function SavedPageDesign({ page, children }: { page: "tasks" | "week" | "review" | "subjects" | "more"; children: ReactNode }) {
  return <div className={`saved-page saved-page-${page}`} data-design="night-index">{children}</div>;
}
