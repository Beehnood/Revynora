import type { CourseView } from "@revynora/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
export type Routes = {
  Home: undefined;
  Courses: undefined;
  Course: { courseId: string; course: CourseView };
  Diagnostic: undefined;
  Attempts: undefined;
  Attempt: { id: string };
  Leitner: undefined;
  Planning: undefined;
  Progress: undefined;
  Profile: undefined;
  Subscription: undefined;
};
export type ScreenProps<T extends keyof Routes> = NativeStackScreenProps<
  Routes,
  T
>;
