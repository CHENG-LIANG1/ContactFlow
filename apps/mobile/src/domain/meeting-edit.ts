const DEFAULT_MEETING_DURATION_MS = 30 * 60 * 1000;

/** Moving a meeting keeps its existing duration so a start-time edit is safe. */
export function moveMeetingStart(
  startAt: string,
  endAt: string,
  nextStart: Date,
): { startAt: string; endAt: string } {
  const previousStart = Date.parse(startAt);
  const previousEnd = Date.parse(endAt);
  const existingDuration = previousEnd - previousStart;
  const duration =
    Number.isFinite(existingDuration) && existingDuration > 0
      ? existingDuration
      : DEFAULT_MEETING_DURATION_MS;

  return {
    startAt: nextStart.toISOString(),
    endAt: new Date(nextStart.getTime() + duration).toISOString(),
  };
}
