import ClassesSubjectsManager from "@/components/ClassesSubjectsManager";
import SavedPageDesign from "@/components/SavedPageDesign";

export default function SubjectsPage() {
  return <SavedPageDesign page="subjects"><ClassesSubjectsManager initialTab="subjects" /></SavedPageDesign>;
}
