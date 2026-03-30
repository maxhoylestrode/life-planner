import { useQuery } from '@tanstack/react-query';
import { Server } from 'lucide-react';
import axios from 'axios';

export default function ServerStatusWidget() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await axios.get<{ status: string }>('/health');
      return res.data;
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  const online = !isError && data?.status === 'ok';

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-text-primary">Server Status</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            online ? 'bg-success' : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-text-secondary">
          Backend: {online ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
}
