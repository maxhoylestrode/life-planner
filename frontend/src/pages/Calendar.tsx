import CalendarView from '../components/calendar/CalendarView';

export default function Calendar() {
  return (
    <div className="h-full flex flex-col page-enter">
      <div className="px-6 pt-6 pb-2 flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary">Calendar</h1>
        <p className="text-text-secondary text-sm mt-0.5">Plan your days and track events</p>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <CalendarView />
      </div>
    </div>
  );
}
