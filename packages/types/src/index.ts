export type * from "./admin";
export type HealthResponse = { status: "ok"; version: string };
export type ReadinessResponse = { status: "ready" | "unavailable" };
export type DemoRole = "student" | "admin";
export type UserProfile = {
  learningAccess?: LearningAccess;
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  plan: "FREE" | "PLUS" | "PRO";
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

export type PlanTask = {
  id: string;
  planId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "PLANNED" | "DONE" | "CANCELLED";
  version: number;
  courseId: string | null;
  kind: "REVISION" | "EXAM";
  priority: number;
  reminderMinutes: number | null;
  plan: { title: string; timeZone: string };
};
export type PlanningProposal = {
  title: string;
  rationale: string;
  tasks: {
    title: string;
    courseId: string;
    localStart: string;
    durationMinutes: number;
    priority: number;
  }[];
};
export type AvailabilityView = { id: string; startsAt: string; endsAt: string };
export type ProgressSummary = {
  totalReviews: number;
  remembered: number;
  successRate: number | null;
  revisionSeconds: number;
  timedReviews: number;
  completedQuizzes: number;
  averageScore: number | null;
  boxes: { box: number; count: number }[];
  scores: { date: string; score: number; subject: string }[];
  subjects: {
    subject: string;
    quizzes: number;
    averageScore: number | null;
    latestScore: number | null;
    reviews: number;
  }[];
  weekly: { date: string; reviews: number; quizzes: number }[];
  monthly: { date: string; reviews: number; quizzes: number }[];
  activity: {
    id: string;
    date: string;
    title: string;
    kind: "QUIZ" | "LEITNER";
  }[];
};

export type LeitnerCardView = {
  id: string;
  front: string;
  back: string;
  box: number;
  version: number;
  dueAt: string;
  courseId: string | null;
};

export type MobileSession = {
  user: UserProfile;
  token: string;
  expiresAt: string;
};

export type LearningAccess = {
  allowed: boolean;
  commercialPlan: "FREE" | "PLUS" | "PRO";
  effectivePlan: "FREE" | "PLUS" | "PRO";
  source: "INTERNAL" | "COMMERCIAL" | "NONE";
  leitner: boolean;
  planning: boolean;
  internal: { startsAt: string; expiresAt: string | null } | null;
};
