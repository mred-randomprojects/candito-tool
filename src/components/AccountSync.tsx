import { CloudUpload, Loader2, LogOut } from "lucide-react";
import { useAuth } from "../auth";
import { Button } from "./ui/button";

interface AccountSyncProps {
  cloudSyncing: boolean;
  onForceSync: () => void;
}

export function AccountSync({ cloudSyncing, onForceSync }: AccountSyncProps) {
  const { user, signOut } = useAuth();
  if (user == null) return null;

  return (
    <div className="fixed bottom-3 left-1/2 z-40 flex w-full max-w-lg -translate-x-1/2 items-center justify-between gap-2 px-4">
      <div className="min-w-0 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-lg">
        <span className="block truncate">
          {user.email ?? user.displayName ?? "Signed in"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          onClick={onForceSync}
          disabled={cloudSyncing}
          className="h-8 rounded-full gap-1.5 shadow-lg"
        >
          {cloudSyncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CloudUpload className="h-3.5 w-3.5" />
          )}
          Sync
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 rounded-full bg-card shadow-lg"
          onClick={() => void signOut()}
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
