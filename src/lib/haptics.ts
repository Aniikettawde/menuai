export function haptic(pattern: number | number[] = 8) {
  if (typeof window === "undefined") return;
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* no-op — some browsers throw if called outside a user gesture */
    }
  }
}