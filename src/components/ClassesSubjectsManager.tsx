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
    <section className="course-hub mx-auto w-full max-w-6xl">
      <header className="course-hero">
        <div className="course-hero-copy">
          <p className="course-eyebrow"><span>COURSE BOOK</span><span>01 — 07</span></p>
          <h1>Make a week<br /><em>of what you learn.</em></h1>
          <p className="course-hero-description">Your classes, subjects, and study rhythm—gathered in one clear place.</p>
          <span className="course-hero-caption"><span aria-hidden="true" /> A little structure goes a long way</span>
        </div>
        <div className="course-hero-art" aria-hidden="true">
          <div className="course-orbit course-orbit-outer" />
          <div className="course-orbit course-orbit-inner" />
          <div className="course-orbit-core"><span>ST</span><i /></div>
          <span className="course-art-note course-art-note-top">LEARN<br />A LITTLE</span>
          <span className="course-art-note course-art-note-bottom">EVERY<br />WEEK</span>
          <span className="course-art-star">✳</span>
        </div>
      </header>

      <div className="course-toolbar">
        <div className="course-tabs" role="tablist" aria-label="Course management">
          <button id="classes-tab" type="button" role="tab" aria-selected={activeTab === "classes"} aria-controls="classes-panel" onClick={() => selectTab("classes")} className="course-tab">
            <span className="course-tab-index">01</span><span>Weekly schedule</span>
          </button>
          <button id="subjects-tab" type="button" role="tab" aria-selected={activeTab === "subjects"} aria-controls="subjects-panel" onClick={() => selectTab("subjects")} className="course-tab">
            <span className="course-tab-index">02</span><span>Subjects</span>
          </button>
        </div>
        <p className="course-toolbar-note">Your learning, in good order <span aria-hidden="true">↗</span></p>
      </div>

      <div id="classes-panel" role="tabpanel" aria-labelledby="classes-tab" hidden={activeTab !== "classes"} className="course-panel">
        <ClassesManager embedded onManageSubjects={() => selectTab("subjects")} />
      </div>
      <div id="subjects-panel" role="tabpanel" aria-labelledby="subjects-tab" hidden={activeTab !== "subjects"} className="course-panel">
        <SubjectsManager embedded />
      </div>
    </section>
  );
}
