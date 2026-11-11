export function shouldAcceptSnapshotVersion(currentVersion: number, incomingVersion: number): boolean {
  return Number.isSafeInteger(incomingVersion) && incomingVersion >= currentVersion;
}

export function nextAcceptedVersion(currentVersion: number, incomingVersion: number): number {
  return shouldAcceptSnapshotVersion(currentVersion, incomingVersion) ? incomingVersion : currentVersion;
}
