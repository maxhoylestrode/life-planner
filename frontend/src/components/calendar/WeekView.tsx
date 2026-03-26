import TimeGrid, { TimeGridProps } from './TimeGrid';

interface WeekViewProps extends Omit<TimeGridProps, 'days'> {
  weekStart: Date; // Monday of the week to display
}

export default function WeekView({ weekStart, ...rest }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return <TimeGrid days={days} {...rest} />;
}
