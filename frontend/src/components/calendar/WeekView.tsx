import { useState, useEffect } from 'react';
import TimeGrid, { TimeGridProps } from './TimeGrid';

interface WeekViewProps extends Omit<TimeGridProps, 'days'> {
  weekStart: Date; // Monday of the week to display
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function WeekView({ weekStart, ...rest }: WeekViewProps) {
  const isMobile = useIsMobile();
  const count = isMobile ? 3 : 7;

  const days = Array.from({ length: count }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return <TimeGrid days={days} {...rest} />;
}
