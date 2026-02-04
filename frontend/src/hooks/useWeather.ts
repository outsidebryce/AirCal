import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  location: string;
}

// WMO Weather interpretation codes to icon mapping
const weatherIcons: Record<number, string> = {
  0: '☀️',   // Clear sky
  1: '🌤️',   // Mainly clear
  2: '⛅',   // Partly cloudy
  3: '☁️',   // Overcast
  45: '🌫️',  // Fog
  48: '🌫️',  // Depositing rime fog
  51: '🌧️',  // Light drizzle
  53: '🌧️',  // Moderate drizzle
  55: '🌧️',  // Dense drizzle
  56: '🌧️',  // Light freezing drizzle
  57: '🌧️',  // Dense freezing drizzle
  61: '🌧️',  // Slight rain
  63: '🌧️',  // Moderate rain
  65: '🌧️',  // Heavy rain
  66: '🌧️',  // Light freezing rain
  67: '🌧️',  // Heavy freezing rain
  71: '🌨️',  // Slight snow
  73: '🌨️',  // Moderate snow
  75: '❄️',  // Heavy snow
  77: '🌨️',  // Snow grains
  80: '🌦️',  // Slight rain showers
  81: '🌦️',  // Moderate rain showers
  82: '⛈️',  // Violent rain showers
  85: '🌨️',  // Slight snow showers
  86: '🌨️',  // Heavy snow showers
  95: '⛈️',  // Thunderstorm
  96: '⛈️',  // Thunderstorm with slight hail
  99: '⛈️',  // Thunderstorm with heavy hail
};

export function getWeatherIcon(code: number): string {
  return weatherIcons[code] || '🌡️';
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  // Fetch weather from Open-Meteo (free, no API key needed)
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;

  const weatherRes = await fetch(weatherUrl);
  if (!weatherRes.ok) throw new Error('Failed to fetch weather');
  const weatherData = await weatherRes.json();

  // Reverse geocode to get location name
  const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  let location = 'Current Location';

  try {
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'Atlas Calendar App' }
    });
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      location = geoData.address?.city ||
                 geoData.address?.town ||
                 geoData.address?.village ||
                 geoData.address?.county ||
                 'Current Location';
    }
  } catch {
    // Silently fail on geocoding, use default
  }

  return {
    temperature: Math.round(weatherData.current.temperature_2m),
    weatherCode: weatherData.current.weather_code,
    location,
  };
}

interface GeoLocation {
  lat: number;
  lon: number;
}

export function useWeather() {
  const [geoLocation, setGeoLocation] = useState<GeoLocation | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        setGeoError(error.message);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const query = useQuery({
    queryKey: ['weather', geoLocation?.lat, geoLocation?.lon],
    queryFn: () => fetchWeather(geoLocation!.lat, geoLocation!.lon),
    enabled: !!geoLocation,
    staleTime: 600000, // 10 minutes
    gcTime: 1800000, // 30 minutes
    retry: 1,
  });

  return {
    ...query,
    geoError,
    isGeoLoading: !geoLocation && !geoError,
  };
}
