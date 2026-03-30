import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

export interface WeatherData {
  temp: number;
  feelsLike: number;
  description: string;
  weatherCode: number;
  humidity: number;
  city: string;
}

interface UseWeatherReturn {
  data: WeatherData | undefined;
  isLoading: boolean;
  isError: boolean;
  isMisconfigured: false;
}

// WMO weather interpretation codes → description
function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 84) return 'Rain showers';
  if (code <= 94) return 'Thunderstorm';
  return 'Stormy';
}

// WMO code → simple emoji
function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 49) return '🌫️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '❄️';
  if (code <= 84) return '🌦️';
  return '⛈️';
}

export { weatherEmoji };

async function fetchWeather(city: string, unit: string): Promise<WeatherData> {
  // Step 1: geocode city → lat/lon
  const geoRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: city, count: 1, language: 'en', format: 'json' },
  });
  const results = geoRes.data.results as Array<{
    latitude: number; longitude: number; name: string;
  }> | undefined;
  if (!results?.length) throw new Error(`City not found: ${city}`);
  const { latitude, longitude, name } = results[0];

  // Step 2: fetch current weather
  const tempUnit = unit === 'imperial' ? 'fahrenheit' : 'celsius';
  const wxRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude,
      longitude,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code',
      temperature_unit: tempUnit,
      forecast_days: 1,
    },
  });
  const cur = wxRes.data.current;
  return {
    temp: Math.round(cur.temperature_2m as number),
    feelsLike: Math.round(cur.apparent_temperature as number),
    humidity: cur.relative_humidity_2m as number,
    weatherCode: cur.weather_code as number,
    description: describeWeatherCode(cur.weather_code as number),
    city: name,
  };
}

export function useWeather(city: string, unit: string): UseWeatherReturn {
  const enabled = Boolean(city);

  const query = useQuery({
    queryKey: ['weather', city, unit],
    queryFn: () => fetchWeather(city, unit),
    enabled,
    staleTime: 300_000,
    refetchInterval: 600_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading && enabled,
    isError: query.isError,
    isMisconfigured: false,
  };
}
