export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(
    navigator.userAgent,
  );
}
