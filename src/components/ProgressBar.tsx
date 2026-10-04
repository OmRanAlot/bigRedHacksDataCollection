export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  return <progress className="progress-bar" value={Math.min(value, max)} max={max || 1} aria-label={label} />
}
