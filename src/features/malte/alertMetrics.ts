/** Live metrics ignore reviewed findings that no longer fire. */
export function partitionAlerts<T extends { obsolete?: boolean }>(
  alerts: readonly T[],
): { live: T[]; obsolete: T[] } {
  const live: T[] = [];
  const obsolete: T[] = [];
  for (const alert of alerts) {
    if (alert.obsolete === true) obsolete.push(alert);
    else live.push(alert);
  }
  return { live, obsolete };
}

/** Header and run totals: non-obsolete count, with obsolete called out separately. */
export function formatAlertCountLabel(alerts: readonly { obsolete?: boolean }[]): string {
  const { live, obsolete } = partitionAlerts(alerts);
  if (obsolete.length === 0) return `${live.length} alerts`;
  return `${live.length} alerts · ${obsolete.length} obsolete`;
}
