"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";

// A store that starts "unsubscribed" (never notifies), used purely to get
// a value that's guaranteed to differ between the server snapshot and the
// client snapshot - this is the React-recommended way to detect "have we
// hydrated yet?" without triggering the "setState in an effect" lint rule
// that a useState+useEffect mounted-flag would hit.
function subscribe() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

function useHasMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  // The real theme is only knowable in the browser (it depends on
  // localStorage/OS preference read by the inline init script). Server
  // render and first client render must produce identical markup, so we
  // render a neutral placeholder until mounted, then switch to the real
  // icon - avoiding a hydration mismatch instead of just silencing it.
  const mounted = useHasMounted();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mounted ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface hover:text-foreground"
    >
      {!mounted ? (
        <span className="block h-4.5 w-4.5" aria-hidden="true" />
      ) : theme === "dark" ? (
        <Sun className="h-4.5 w-4.5" />
      ) : (
        <Moon className="h-4.5 w-4.5" />
      )}
    </button>
  );
}
