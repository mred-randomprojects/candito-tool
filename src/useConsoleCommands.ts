import { useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import type { AppData } from "./types";
import {
  clearCurrentCycleDateOverrides,
  type ClearCurrentCycleDateOverridesResult,
} from "./dateOverrideMaintenance";

type ClearDateOverridesConsoleResult = Omit<
  ClearCurrentCycleDateOverridesResult,
  "appData"
> & {
  message: string;
};

declare global {
  interface Window {
    canditoInternal?: {
      clearCurrentCycleDateOverrides?: () => ClearDateOverridesConsoleResult;
    };
  }
}

/**
 * Maintenance commands reachable from the browser console via
 * `window.canditoInternal` — escape hatches for state the UI can't fix.
 */
export function useConsoleCommands({
  appDataRef,
  saveAndApplyAppData,
}: {
  appDataRef: MutableRefObject<AppData>;
  saveAndApplyAppData: (next: AppData) => boolean;
}): void {
  const clearCurrentCycleDateOverridesCommand = useCallback(
    (): ClearDateOverridesConsoleResult => {
      const result = clearCurrentCycleDateOverrides(appDataRef.current);
      if (!result.ok) {
        return {
          ok: false,
          reason: result.reason,
          message: result.reason ?? "Could not clear date overrides.",
        };
      }
      const saved = saveAndApplyAppData(result.appData);
      return {
        ok: saved,
        cycleId: result.cycleId,
        removedOverrideCount: result.removedOverrideCount,
        tombstonedOverrideCount: result.tombstonedOverrideCount,
        overrideKeys: result.overrideKeys,
        message: saved
          ? `Cleared ${result.removedOverrideCount ?? 0} visible date override(s) from current cycle and tombstoned ${result.tombstonedOverrideCount ?? 0} possible override key(s).`
          : "Could not save after clearing date overrides.",
      };
    },
    [appDataRef, saveAndApplyAppData],
  );

  useEffect(() => {
    window.canditoInternal = {
      ...(window.canditoInternal ?? {}),
      clearCurrentCycleDateOverrides: clearCurrentCycleDateOverridesCommand,
    };

    return () => {
      if (
        window.canditoInternal?.clearCurrentCycleDateOverrides ===
        clearCurrentCycleDateOverridesCommand
      ) {
        delete window.canditoInternal.clearCurrentCycleDateOverrides;
      }
      if (
        window.canditoInternal != null &&
        Object.keys(window.canditoInternal).length === 0
      ) {
        delete window.canditoInternal;
      }
    };
  }, [clearCurrentCycleDateOverridesCommand]);
}
