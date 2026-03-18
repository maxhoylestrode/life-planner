import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';

interface Stats {
  totalCompleted: number;
  completedToday: number;
  totalPending: number;
  totalToday: number;
}

interface StatsResponse {
  stats: Stats;
}

function getMotivation(completedToday: number): { message: string; emoji: string } {
  if (completedToday === 0) return { message: 'Ready to conquer the day?', emoji: '🌅' };
  if (completedToday <= 3) return { message: "Great start!", emoji: '🌱' };
  if (completedToday <= 7) return { message: "You're on fire!", emoji: '🔥' };
  return { message: 'Absolutely crushing it!', emoji: '🏆' };
}

export default function TodoStats() {
  const { data } = useQuery<StatsResponse>({
    queryKey: ['todo-stats'],
    queryFn: async () => {
      const response = await apiClient.get<StatsResponse>('/todos/stats');
      return response.data;
    },
    refetchInterval: 30000, // refresh every 30s
  });

  const stats = data?.stats;
  const completedToday = stats?.completedToday ?? 0;
  const totalToday = stats?.totalToday ?? 0;
  const totalCompleted = stats?.totalCompleted ?? 0;
  const totalPending = stats?.totalPending ?? 0;

  const progressPercent =
    totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const { message, emoji } = getMotivation(completedToday);

  return (
    <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-5 border border-primary/20">
      {/* Motivation message */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{emoji}</span>
        <div>
          <p className="font-semibold text-text-primary">{message}</p>
          {completedToday > 0 && (
            <p className="text-sm text-text-secondary">
              🔥 {completedToday} task{completedToday !== 1 ? 's' : ''} crushed today!
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalToday > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
            <span>Today's progress</span>
            <span className="font-semibold text-primary">{progressPercent}%</span>
          </div>
          <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mt-1">
            {completedToday} of {totalToday} tasks done today
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/60 rounded-xl p-3">
          <p className="text-2xl font-bold text-primary">{completedToday}</p>
          <p className="text-xs text-text-secondary mt-0.5">Done today</p>
        </div>
        <div className="bg-white/60 rounded-xl p-3">
          <p className="text-2xl font-bold text-text-primary">{totalCompleted}</p>
          <p className="text-xs text-text-secondary mt-0.5">⭐ Total completed</p>
        </div>
        <div className="bg-white/60 rounded-xl p-3">
          <p className="text-2xl font-bold text-text-secondary">{totalPending}</p>
          <p className="text-xs text-text-secondary mt-0.5">Remaining</p>
        </div>
        <div className="bg-white/60 rounded-xl p-3">
          <p className="text-2xl font-bold text-accent">{totalToday}</p>
          <p className="text-xs text-text-secondary mt-0.5">Created today</p>
        </div>
      </div>
    </div>
  );
}
