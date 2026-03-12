export type WeightUnit = "kg" | "lb";

export type HorizontalPull = "Dumbbell Row" | "Barbell Row" | "Machine Row";
export type ShoulderExercise =
  | "Seated Dumbbell OHP"
  | "Standing Dumbbell OHP"
  | "Military Press"
  | "Lateral Dumbbell Raise";
export type VerticalPull =
  | "Weighted Pull-up"
  | "Weighted Chin-up"
  | "Lat Pulldown";

export const HORIZONTAL_PULL_OPTIONS: HorizontalPull[] = [
  "Dumbbell Row",
  "Barbell Row",
  "Machine Row",
];
export const SHOULDER_OPTIONS: ShoulderExercise[] = [
  "Seated Dumbbell OHP",
  "Standing Dumbbell OHP",
  "Military Press",
  "Lateral Dumbbell Raise",
];
export const VERTICAL_PULL_OPTIONS: VerticalPull[] = [
  "Weighted Pull-up",
  "Weighted Chin-up",
  "Lat Pulldown",
];

export interface ProgramInputs {
  startDate: string;
  weightUnit: WeightUnit;
  bench1RM: number;
  squat1RM: number;
  deadlift1RM: number;
  horizontalPull: HorizontalPull;
  shoulderExercise: ShoulderExercise;
  verticalPull: VerticalPull;
}

export interface ProgramSet {
  weight: number | null;
  targetReps: string;
}

export interface ProgramExercise {
  name: string;
  isMainLift: boolean;
  hasWarmUp: boolean;
  sets: ProgramSet[];
  notes: string[];
}

export interface WorkoutDay {
  dayOffset: number;
  type: "lower" | "upper";
  exercises: ProgramExercise[];
  notes: string[];
}

export interface ProgramWeek {
  weekNumber: number;
  title: string;
  subtitle: string;
  workoutDays: WorkoutDay[];
}

export interface Program {
  inputs: ProgramInputs;
  weeks: ProgramWeek[];
}

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface SetLog {
  actualReps: number | null;
  difficulty: Difficulty | null;
  actualWeight: number | null;
  notes: string;
}

export interface ExerciseLog {
  setLogs: SetLog[];
  warmUpSetLogs?: SetLog[];
}

export interface WorkoutLog {
  completed: boolean;
  startedAt: string | null;
  completedAt: string | null;
  exerciseLogs: ExerciseLog[];
  notes: string;
}

export interface CycleData {
  id: string;
  name: string;
  inputs: ProgramInputs;
  workoutLogs: Record<string, WorkoutLog>;
  createdAt: string;
}

export type View =
  | { page: "setup" }
  | { page: "overview" }
  | { page: "workout"; weekIndex: number; dayIndex: number }
  | { page: "active"; weekIndex: number; dayIndex: number }
  | { page: "history" };
