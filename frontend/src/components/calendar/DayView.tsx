import TimeGrid, { TimeGridProps } from './TimeGrid';

interface DayViewProps extends Omit<TimeGridProps, 'days'> {
  date: Date;
}

export default function DayView({ date, ...rest }: DayViewProps) {
  return <TimeGrid days={[date]} {...rest} />;
}
