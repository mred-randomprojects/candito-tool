import { CloudUpload, Loader2, LogOut, Mail, User } from "lucide-react";
import { useAuth } from "../auth";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface AccountPageProps {
  cloudSyncing: boolean;
  onForceSync: () => void;
}

export function AccountPage({ cloudSyncing, onForceSync }: AccountPageProps) {
  const { user, signOut } = useAuth();
  if (user == null) return null;

  const accountName = user.displayName ?? "Google account";
  const accountEmail = user.email ?? "Signed in";

  return (
    <div className="min-h-dvh pb-24">
      <div className="sticky top-0 z-10 border-b bg-background/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold">Account</h1>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-lg space-y-4 px-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Signed in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{accountName}</div>
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{accountEmail}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full justify-center gap-2 text-destructive hover:text-destructive"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cloud sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/40 px-3 py-2">
              <span className="text-sm">
                {cloudSyncing ? "Syncing" : "Up to date"}
              </span>
              {cloudSyncing && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              className="w-full gap-2"
              onClick={onForceSync}
              disabled={cloudSyncing}
            >
              {cloudSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              Sync now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
