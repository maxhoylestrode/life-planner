import { useClock } from '../../hooks/useClock';

export default function ClockWidget() {
  const now = useClock();

  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const secondsStr = now.toLocaleTimeString('en-GB', {
    second: '2-digit',
    hour12: false,
  }).slice(-2);
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="card p-6 flex flex-col justify-center">
      <div className="flex items-end gap-2">
        <span className="text-8xl font-bold text-text-primary leading-none tracking-tight tabular-nums">
          {timeStr}
        </span>
        <span className="text-4xl font-semibold text-text-muted leading-none mb-1 tabular-nums">
          {secondsStr}
        </span>
      </div>
      <p className="text-text-secondary mt-2 text-base">{dateStr}</p>
    </div>
  );
}
