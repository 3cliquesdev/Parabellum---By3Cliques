import { useErrorTracker } from "@/hooks/useErrorTracker";

/**
 * Initializer component — mounts useErrorTracker globally.
 * Must be placed inside BrowserRouter (needs routing context).
 */
export function ErrorTrackerInit() {
  useErrorTracker();
  return null;
}
