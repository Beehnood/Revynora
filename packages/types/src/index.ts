export type HealthResponse = { status: "ok"; version: string };
export type ReadinessResponse = { status: "ready" | "unavailable" };
export type DemoRole = "student" | "admin";
export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  plan: "FREE";
  createdAt: string;
};
export type QuizQuestion = {
  id: string;
  position: number;
  text: string;
  type: "SINGLE" | "MULTIPLE";
  options: { id: string; text: string }[];
};
export type PublicQuiz = {
  id: string;
  domain: string;
  topic: string;
  level: string;
  provider: string;
  createdAt: string;
  questions: QuizQuestion[];
};
export type Attempt = {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  quiz: PublicQuiz;
  answers: { questionId: string; selectedOptionIds: string[] }[];
  result: null | {
    score: number;
    mastered: string[];
    weak: string[];
    miniCourse: string;
    corrected: { questionId: string; concept: string; correct: boolean }[];
    questions: {
      id: string;
      text: string;
      concept: string;
      explanation: string;
      correctOptionIds: string[];
    }[];
  };
};
export type AttemptSummary = {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  quiz: { topic: string; domain: string; level: string; provider: string };
};
export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type LearningSummary = {
  completed: number;
  lastScore: number | null;
  average: number | null;
  weak: string[];
  recent: AttemptSummary[];
};
export type LearningConfig = {
  provider: string;
  mockTopics: { domain: string; topic: string }[];
  dailyLimit: number;
  used: number;
  remaining: number;
  reset: string;
};
export type CourseView = {
  id: string;
  title: string;
  domain: string;
  content: string;
  source: "USER" | "AI" | "ADMIN";
  createdAt: string;
};
