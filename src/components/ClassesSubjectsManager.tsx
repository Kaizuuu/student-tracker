"use client";

import { useEffect, useState } from "react";
import ClassesManager from "@/components/ClassesManager";
import SubjectsManager from "@/components/SubjectsManager";

type ManagerTab = "classes" | "subjects";

export default function ClassesSubjectsManager({ initialTab = "classes" }: { initialTab?: ManagerTab }) {
  const [activeTab, setActiveTab] = useState<ManagerTab>(initialTab);

  useEffect(() => {
    if (window.location.hash === "#subjects") setActiveTab("subjects");
  }, []);

  function selectTab(tab: ManagerTab) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", tab === "subjects" ? "/classes#subjects" : "/classes");
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Your courses</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Classes &amp; subjects</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">Your weekly timetable and the subject details behind it, together in one place.</p>

      <div className="mt-7 inline-flex max-w-full gap-1 rounded-2xl border border-border bg-surface p-1" role="tablist" aria-label="Course management">
        <button id="classes-tab" type="button" role="tab" aria-selected={activeTab === "classes"} aria-controls="classes-panel" onClick={() => selectTab("classes")} className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors ${activeTab === "classes" ? "bg-background text-accent shadow-sm" : "text-muted hover:text-foreground"}`}>Weekly schedule</button>
        <button id="subjects-tab" type="button" role="tab" aria-selected={activeTab === "subjects"} aria-controls="subjects-panel" onClick={() => selectTab("subjects")} className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors ${activeTab === "subjects" ? "bg-background text-accent shadow-sm" : "text-muted hover:text-foreground"}`}>Subjects</button>
      </div>

      <div id="classes-panel" role="tabpanel" aria-labelledby="classes-tab" hidden={activeTab !== "classes"} className="mt-5">
        <ClassesManager embedded onManageSubjects={() => selectTab("subjects")} />
      </div>
      <div id="subjects-panel" role="tabpanel" aria-labelledby="subjects-tab" hidden={activeTab !== "subjects"} className="mt-5">
        <SubjectsManager embedded />
      </div>
    </section>
  );
}
