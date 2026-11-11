export function StageTimer({ seconds, totalSeconds = 60, className = "" }: { seconds: number; totalSeconds?: number; className?: string }) {
  const progress = `${Math.max(0, Math.min(100, (seconds / Math.max(1, totalSeconds)) * 100))}%`;
  return (
    <div className={`big-timer stage-instrument-timer ${seconds <= 10 ? "timer-urgent" : ""} ${className}`} aria-label={`${seconds} seconds remaining`}>
      <span style={{ "--timer-progress": progress } as React.CSSProperties}>{seconds}</span>
      <small>seconds</small>
    </div>
  );
}
