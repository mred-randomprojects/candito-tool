export type WeightUnit = "kg" | "lb";

export type Sex = "male" | "female";

export type MainLift = "bench" | "squat" | "deadlift";

export type MainLiftNameMap = Partial<Record<MainLift, string>>;

export type MainLiftExerciseMap = Partial<Record<MainLift, string>>;

export const DEFAULT_MAIN_LIFT_NAMES: Record<MainLift, string> = {
  bench: "Bench Press",
  squat: "Squat",
  deadlift: "Deadlift",
};

export type ExerciseCategory = "upper" | "lower" | "accessory";

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: ExerciseCategory;
  createdAt: string;
  archived?: boolean;
}

export type ExerciseMaxSource = "manual" | "cycle" | "workout";

export interface ExerciseMaxEntry {
  id: string;
  exerciseId: string;
  value: number;
  unit: WeightUnit;
  date: string;
  source: ExerciseMaxSource;
  createdAt: string;
  notes?: string;
}

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
  mainLiftNames?: MainLiftNameMap;
  mainLiftExerciseIds?: MainLiftExerciseMap;
  horizontalPull: HorizontalPull;
  shoulderExercise: ShoulderExercise;
  verticalPull: VerticalPull;
  horizontalPull1RM?: number;
  shoulderExercise1RM?: number;
  verticalPull1RM?: number;
}

export interface UserProfile {
  bodyWeight?: number;
  sex?: Sex;
}

export interface ProgramSet {
  weight: number | null;
  targetReps: string;
}

export interface ProgramExercise {
  name: string;
  isMainLift: boolean;
  mainLift?: MainLift;
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
  /** Snapshot of the prescribed weight at the time the set was logged. */
  prescribedWeight?: number | null;
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
  /** Last local mutation timestamp used to resolve synced undo/reset actions. */
  updatedAt?: string;
}

export interface DateOverride {
  date: string;
  reason: string;
}

export interface CycleData {
  id: string;
  name: string;
  inputs: ProgramInputs;
  workoutLogs: Record<string, WorkoutLog>;
  dateOverrides?: Record<string, DateOverride>;
  createdAt: string;
}

export interface AppData {
  currentCycle: CycleData | null;
  history: CycleData[];
  profile: UserProfile;
  exercises: Record<string, ExerciseDefinition>;
  exerciseMaxes: ExerciseMaxEntry[];
}
