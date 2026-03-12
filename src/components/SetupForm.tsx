import { useState } from "react";
import type {
  ProgramInputs,
  WeightUnit,
  HorizontalPull,
  ShoulderExercise,
  VerticalPull,
} from "../types";
import {
  HORIZONTAL_PULL_OPTIONS,
  SHOULDER_OPTIONS,
  VERTICAL_PULL_OPTIONS,
} from "../types";

interface SetupFormProps {
  onSubmit: (inputs: ProgramInputs) => void;
}

export function SetupForm({ onSubmit }: SetupFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [bench1RM, setBench1RM] = useState("");
  const [squat1RM, setSquat1RM] = useState("");
  const [deadlift1RM, setDeadlift1RM] = useState("");
  const [horizontalPull, setHorizontalPull] = useState<HorizontalPull>("Dumbbell Row");
  const [shoulderExercise, setShoulderExercise] = useState<ShoulderExercise>("Military Press");
  const [verticalPull, setVerticalPull] = useState<VerticalPull>("Weighted Pull-up");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const b = parseFloat(bench1RM);
    const s = parseFloat(squat1RM);
    const d = parseFloat(deadlift1RM);
    if (isNaN(b) || isNaN(s) || isNaN(d) || b <= 0 || s <= 0 || d <= 0) return;

    onSubmit({
      startDate,
      weightUnit,
      bench1RM: b,
      squat1RM: s,
      deadlift1RM: d,
      horizontalPull,
      shoulderExercise,
      verticalPull,
    });
  }

  const inputClass =
    "w-full rounded-lg bg-surface-light border border-border px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-400 mb-1.5";
  const selectClass =
    "w-full rounded-lg bg-surface-light border border-border px-4 py-3 text-white text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent appearance-none";

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Candito 6-Week
          </h1>
          <p className="text-gray-400">
            Strength Program Tracker
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Start Date */}
          <div>
            <label className={labelClass}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          {/* Weight Unit */}
          <div>
            <label className={labelClass}>Weight Unit</label>
            <div className="grid grid-cols-2 gap-3">
              {(["kg", "lb"] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setWeightUnit(unit)}
                  className={`rounded-lg py-3 text-lg font-semibold transition-colors ${
                    weightUnit === unit
                      ? "bg-accent text-black"
                      : "bg-surface-light text-gray-300 border border-border hover:bg-surface-lighter"
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          {/* 1RM Inputs */}
          <div className="space-y-4">
            <label className={labelClass}>One Rep Maxes ({weightUnit})</label>
            <div className="space-y-3">
              {[
                { label: "Bench Press", value: bench1RM, set: setBench1RM },
                { label: "Squat", value: squat1RM, set: setSquat1RM },
                { label: "Deadlift", value: deadlift1RM, set: setDeadlift1RM },
              ].map(({ label, value, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-gray-300 w-28 text-sm">{label}</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Accessory Selection */}
          <div className="space-y-4">
            <label className={labelClass}>Accessory Exercises</label>

            <div>
              <span className="text-xs text-gray-500 mb-1 block">
                Upper Back #1 (horizontal pull)
              </span>
              <select
                value={horizontalPull}
                onChange={(e) =>
                  setHorizontalPull(e.target.value as HorizontalPull)
                }
                className={selectClass}
              >
                {HORIZONTAL_PULL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-xs text-gray-500 mb-1 block">
                Shoulder Exercise
              </span>
              <select
                value={shoulderExercise}
                onChange={(e) =>
                  setShoulderExercise(e.target.value as ShoulderExercise)
                }
                className={selectClass}
              >
                {SHOULDER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-xs text-gray-500 mb-1 block">
                Upper Back #2 (vertical pull)
              </span>
              <select
                value={verticalPull}
                onChange={(e) =>
                  setVerticalPull(e.target.value as VerticalPull)
                }
                className={selectClass}
              >
                {VERTICAL_PULL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-xl bg-accent text-black font-bold py-4 text-lg hover:bg-yellow-400 transition-colors mt-4"
          >
            Start Program
          </button>
        </form>
      </div>
    </div>
  );
}
