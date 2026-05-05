import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Dumbbell, History, List, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomTabsProps {
  hasProgram: boolean;
}

const tabBase =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors";

const TAB_ITEMS = [
  { path: "/history", label: "Cycles", shortcut: "1", icon: History },
  { path: "/overview", label: "Program", shortcut: "2", icon: Dumbbell },
  { path: "/exercises", label: "Exercises", shortcut: "3", icon: List },
  { path: "/account", label: "Account", shortcut: "4", icon: User },
] as const;

function shouldIgnoreTabShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return true;
  }

  if (event.target instanceof HTMLElement) {
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (event.target.isContentEditable) return true;
    if (
      event.target.closest(
        '[role="dialog"], [role="listbox"], [role="menu"], [data-radix-popper-content-wrapper]',
      ) != null
    ) {
      return true;
    }
  }

  return false;
}

export function BottomTabs({ hasProgram }: BottomTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activePath = location.pathname;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreTabShortcut(event)) return;

      const targetTab = TAB_ITEMS.find((item) => item.shortcut === event.key);
      if (targetTab == null) return;
      if (targetTab.path === "/overview" && !hasProgram) return;

      event.preventDefault();
      navigate(targetTab.path);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasProgram, navigate]);

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
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const isDisabled = item.path === "/overview" && !hasProgram;
          const shortcutLabel = `${item.label} (${item.shortcut})`;
          const content = (
            <>
              <Icon className="h-4 w-4" />
              <span className="flex items-baseline gap-1">
                <span>{item.label}</span>
                <span className="text-[10px] leading-none opacity-70">
                  {item.shortcut}
                </span>
              </span>
            </>
          );

          if (isDisabled) {
            return (
              <button
                key={item.path}
                type="button"
                disabled
                aria-label={shortcutLabel}
                className={cn(tabBase, "cursor-not-allowed text-muted-foreground/40")}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={shortcutLabel}
              aria-keyshortcuts={item.shortcut}
              className={tabClass(activePath === item.path)}
              title={shortcutLabel}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
