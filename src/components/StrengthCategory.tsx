import type { Sex, WeightUnit } from "../types";
import type { MainLift } from "../strengthStandards";
import { classifyStrength, LEVEL_COLORS } from "../strengthStandards";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";

interface StrengthCategoryProps {
  bench1RM: number;
  squat1RM: number;
  deadlift1RM: number;
  bodyWeight: number;
  sex: Sex;
  weightUnit: WeightUnit;
}

const LIFTS: readonly {
  key: MainLift;
  label: string;
  rmKey: "bench1RM" | "squat1RM" | "deadlift1RM";
}[] = [
  { key: "squat", label: "Squat", rmKey: "squat1RM" },
  { key: "bench", label: "Bench", rmKey: "bench1RM" },
  { key: "deadlift", label: "Deadlift", rmKey: "deadlift1RM" },
];

export function StrengthCategory({
  bench1RM,
  squat1RM,
  deadlift1RM,
  bodyWeight,
  sex,
  weightUnit,
}: StrengthCategoryProps) {
  const rms = { bench1RM, squat1RM, deadlift1RM };

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="text-xs text-muted-foreground font-medium">
          Strength Level
          <span className="ml-1 text-muted-foreground/60">
            ({bodyWeight} {weightUnit}, {sex === "male" ? "Male" : "Female"})
          </span>
        </div>
        {LIFTS.map(({ key, label, rmKey }) => {
          const c = classifyStrength(rms[rmKey], bodyWeight, sex, key);
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium w-14">{label}</span>
                  <span
                    className={`text-xs font-bold ${LEVEL_COLORS[c.level]}`}
                  >
                    {c.level}
                  </span>
                </div>
                {c.nextLevel != null && c.progressToNext != null && (
                  <span className="text-[10px] text-muted-foreground">
                    {c.progressToNext.toFixed(1)}% → {c.nextLevel}
                  </span>
                )}
                {c.nextLevel == null && (
                  <span className="text-[10px] text-red-400 font-medium">
                    Maximum level
                  </span>
                )}
              </div>
              {c.progressToNext != null && (
                <Progress value={c.progressToNext} className="h-1.5" />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
