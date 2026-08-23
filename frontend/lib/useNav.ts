"use client";

import { useCallback, useState } from "react";
import { useStore } from "./store";
import type { ScreenKey } from "./api";

/**
 * Wraps store.go() with a busy flag for button loading states.
 * Usage: const [busy, navigate] = useNav();
 *        <button disabled={busy} onClick={() => navigate("dashboard")}>
 */
export function useNav() {
  const { go } = useStore();
  const [busy, setBusy] = useState(false);

  const navigate = useCallback(
    async (screen: ScreenKey) => {
      setBusy(true);
      try {
        await go(screen);
      } finally {
        setBusy(false);
      }
    },
    [go],
  );

  return [busy, navigate] as const;
}
