import { Link, useLocation } from "react-router-dom";
import { Dumbbell, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomTabsProps {
  hasProgram: boolean;
}

const tabBase =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors";

export function BottomTabs({ hasProgram }: BottomTabsProps) {
  const location = useLocation();
  const activePath = location.pathname;

  const tabClass = (active: boolean) =>
    cn(
      tabBase,
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center gap-1">
        <Link to="/history" className={tabClass(activePath === "/history")}>
          <History className="h-4 w-4" />
          <span>Cycles</span>
        </Link>
        {hasProgram ? (
          <Link to="/overview" className={tabClass(activePath === "/overview")}>
            <Dumbbell className="h-4 w-4" />
            <span>Program</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={cn(tabBase, "cursor-not-allowed text-muted-foreground/40")}
          >
            <Dumbbell className="h-4 w-4" />
            <span>Program</span>
          </button>
        )}
        <Link to="/account" className={tabClass(activePath === "/account")}>
          <User className="h-4 w-4" />
          <span>Account</span>
        </Link>
      </div>
    </nav>
  );
}
