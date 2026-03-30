import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ClockWidget from '../components/dashboard/ClockWidget';
import WeatherWidget from '../components/dashboard/WeatherWidget';
import ServerStatusWidget from '../components/dashboard/ServerStatusWidget';
import TodayTodosWidget from '../components/dashboard/TodayTodosWidget';

export default function Dashboard() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background p-4 grid gap-4 grid-cols-1 lg:grid-cols-[380px_1fr] lg:grid-rows-[auto_auto_1fr]">
      {/* Left column */}
      <ClockWidget />
      <WeatherWidget />
      <ServerStatusWidget />

      {/* Right column — spans all rows on large screens */}
      <div className="lg:row-span-3 min-h-0">
        <TodayTodosWidget />
      </div>

      {/* Back nav — floating bottom-right */}
      <Link
        to="/notes"
        className="btn-ghost fixed bottom-4 right-4 flex items-center gap-1.5 text-sm z-10"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to App
      </Link>
    </div>
  );
}
