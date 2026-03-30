import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

export interface MonitorHeartbeat {
  status: 0 | 1;
  time: string;
  ping: number | null;
  msg?: string;
}

export interface MonitorStatus {
  id: number;
  name: string;
  uptime24h: number;   // 0–1 ratio
  latestPing: number | null;
  isUp: boolean;
  heartbeats: MonitorHeartbeat[];
}

interface UseUptimeKumaReturn {
  monitors: MonitorStatus[];
  isLoading: boolean;
  isError: boolean;
  isMisconfigured: boolean;
}

export function useUptimeKuma(baseUrl: string, slug: string): UseUptimeKumaReturn {
  const enabled = Boolean(baseUrl && slug);

  const query = useQuery({
    queryKey: ['uptime-kuma', baseUrl, slug],
    queryFn: async () => {
      const res = await apiClient.get('/uptime/heartbeat', {
        params: { url: baseUrl, slug },
      });
      const { pageData, heartbeatData } = res.data;

      const monitors: Array<{ id: number; name: string }> =
        pageData.publicGroupList?.flatMap(
          (g: { monitorList: Array<{ id: number; name: string }> }) => g.monitorList
        ) ?? [];

      const heartbeatList: Record<string, MonitorHeartbeat[]> =
        heartbeatData.heartbeatList ?? {};
      const uptimeList: Record<string, number> =
        heartbeatData.uptimeList ?? {};

      return monitors.map((m): MonitorStatus => {
        const beats: MonitorHeartbeat[] = heartbeatList[String(m.id)] ?? [];
        const latest = beats[beats.length - 1] ?? null;
        return {
          id: m.id,
          name: m.name,
          uptime24h: uptimeList[`${m.id}_24`] ?? 0,
          latestPing: latest?.ping ?? null,
          isUp: latest?.status === 1,
          heartbeats: beats.slice(-20),
        };
      });
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  return {
    monitors: query.data ?? [],
    isLoading: query.isLoading && enabled,
    isError: query.isError,
    isMisconfigured: !enabled,
  };
}
