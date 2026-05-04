import { useState } from "react";
import type { CycleData } from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { StorageUsage } from "./StorageUsage";
import {
  ArrowRightLeft,
  Pencil,
  Check,
  Trash2,
  Eye,
  Dumbbell,
  Plus,
  Settings2,
} from "lucide-react";

interface CycleHistoryProps {
  currentCycle: CycleData | null;
  history: CycleData[];
  onNewCycle: () => void;
  onViewCycle: (cycle: CycleData) => void;
  onEditCycle: (cycle: CycleData) => void;
  onRenameCurrent: (newName: string) => void;
  onRenameArchived: (cycleId: string, newName: string) => void;
  onDeleteArchived: (cycleId: string) => void;
  onDeleteCurrent: () => void;
  onSetAsCurrent: (cycle: CycleData) => void;
}

function completionPercentage(cycle: CycleData): number {
  const entries = Object.values(cycle.workoutLogs);
  if (entries.length === 0) return 0;
  // 6-week program typically has ~16 workout days
  const totalExpected = 16;
  const completed = entries.filter((l) => l.completed).length;
  return Math.round((completed / totalExpected) * 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CycleCard({
  cycle,
  isCurrent,
  onView,
  onEdit,
  onRename,
  onDelete,
  onSetAsCurrent,
}: {
  cycle: CycleData;
  isCurrent: boolean;
  onView: () => void;
  onEdit: () => void;
  onRename: (newName: string) => void;
  onDelete: (() => void) | null;
  onSetAsCurrent: (() => void) | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(cycle.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const pct = completionPercentage(cycle);

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed.length > 0) {
      onRename(trimmed);
    } else {
      setEditName(cycle.name);
    }
    setIsEditing(false);
  };

  return (
    <Card className={isCurrent ? "border-primary/50" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isEditing ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") {
                      setEditName(cycle.name);
                      setIsEditing(false);
                    }
                  }}
                  className="h-7 text-sm"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleSaveName}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <CardTitle className="truncate">{cycle.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => {
                    setEditName(cycle.name);
                    setIsEditing(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isCurrent && <Badge>Current</Badge>}
            {pct === 100 && <Badge variant="success">Complete</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Started {formatDate(cycle.inputs.startDate)}</span>
          <span>{pct}% done</span>
        </div>

        {/* 1RM summary */}
        <div className="flex gap-3 text-xs">
          {[
            { label: "B", value: cycle.inputs.bench1RM },
            { label: "S", value: cycle.inputs.squat1RM },
            { label: "D", value: cycle.inputs.deadlift1RM },
          ].map(({ label, value }) => (
            <span key={label} className="text-muted-foreground">
              {label}:{" "}
              <span className="text-foreground font-medium">
                {value}
                {cycle.inputs.weightUnit}
              </span>
            </span>
          ))}
        </div>

        {/* Completion bar */}
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            {!isCurrent ? (
              <Button variant="outline" size="sm" onClick={onView}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                View
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onView}>
                <Dumbbell className="h-3.5 w-3.5 mr-1.5" />
                Go to cycle
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            {onSetAsCurrent != null && (
              <Button variant="outline" size="sm" onClick={onSetAsCurrent}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                Set as current
              </Button>
            )}
          </div>
          {onDelete != null && !showDeleteConfirm && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete != null && showDeleteConfirm && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-destructive">Delete?</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={onDelete}
              >
                Yes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowDeleteConfirm(false)}
              >
                No
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CycleHistory({
  currentCycle,
  history,
  onNewCycle,
  onViewCycle,
  onEditCycle,
  onRenameCurrent,
  onRenameArchived,
  onDeleteArchived,
  onDeleteCurrent,
  onSetAsCurrent,
}: CycleHistoryProps) {
  // Show most recent archived first
  const sortedHistory = [...history].reverse();
  const isEmpty = currentCycle == null && history.length === 0;

  return (
    <div className="min-h-dvh pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Candito 6-Week</h1>
          <Button variant="outline" size="sm" onClick={onNewCycle}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Cycle
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {isEmpty && (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No cycles yet.</p>
            <p className="text-xs mt-1">
              Start a new cycle to begin tracking your program.
            </p>
          </div>
        )}

        {/* Current cycle */}
        {currentCycle != null && (
          <CycleCard
            cycle={currentCycle}
            isCurrent={true}
            onView={() => onViewCycle(currentCycle)}
            onEdit={() => onEditCycle(currentCycle)}
            onRename={onRenameCurrent}
            onDelete={onDeleteCurrent}
            onSetAsCurrent={null}
          />
        )}

        {/* Archived cycles */}
        {sortedHistory.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider pt-2">
              Past cycles
            </div>
            {sortedHistory.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                isCurrent={false}
                onView={() => onViewCycle(cycle)}
                onEdit={() => onEditCycle(cycle)}
                onRename={(newName) => onRenameArchived(cycle.id, newName)}
                onDelete={() => onDeleteArchived(cycle.id)}
                onSetAsCurrent={() => onSetAsCurrent(cycle)}
              />
            ))}
          </>
        )}

        {/* Storage usage */}
        <div className="pt-4">
          <StorageUsage />
        </div>
      </div>
    </div>
  );
}
