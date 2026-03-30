import { CloudOff, Droplets, Thermometer } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useWeather, weatherEmoji } from '../../hooks/useWeather';

export default function WeatherWidget() {
  const { preferences } = useTheme();
  const city = preferences?.weatherCity ?? 'London';
  const unit = preferences?.weatherUnit ?? 'metric';
  const unitLabel = unit === 'imperial' ? '°F' : '°C';

  const { data, isLoading, isError } = useWeather(city, unit);

  if (isLoading) {
    return (
      <div className="card p-5 space-y-3 animate-pulse">
        <div className="h-4 w-24 bg-border rounded" />
        <div className="h-10 w-20 bg-border rounded" />
        <div className="h-3 w-32 bg-border rounded" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="card p-5 flex items-center gap-2 text-text-muted">
        <CloudOff className="w-5 h-5" />
        <span className="text-sm">Weather unavailable — check city name in Settings</span>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">{data.city}</p>
      <div className="flex items-center gap-3">
        <span className="text-5xl leading-none">{weatherEmoji(data.weatherCode)}</span>
        <div>
          <p className="text-5xl font-bold text-text-primary leading-none">
            {data.temp}<span className="text-2xl font-normal text-text-secondary ml-1">{unitLabel}</span>
          </p>
          <p className="text-sm text-text-secondary mt-1">{data.description}</p>
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <Thermometer className="w-3.5 h-3.5" />
          Feels {data.feelsLike}{unitLabel}
        </span>
        <span className="flex items-center gap-1">
          <Droplets className="w-3.5 h-3.5" />
          {data.humidity}% humidity
        </span>
      </div>
    </div>
  );
}
