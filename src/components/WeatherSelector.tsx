import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Cloud, CloudRain, CloudSnow, Sun, Wind, Thermometer } from 'lucide-react';
import type { Weather } from '@/types';

const WEATHER_OPTIONS: { value: Weather; label: string; icon: React.ReactNode }[] = [
  { value: 'Sunny', label: 'Sunny', icon: <Sun className="w-4 h-4" /> },
  { value: 'Clear', label: 'Clear', icon: <Sun className="w-4 h-4" /> },
  { value: 'Partly Cloudy', label: 'Partly Cloudy', icon: <Cloud className="w-4 h-4" /> },
  { value: 'Cloudy', label: 'Cloudy', icon: <Cloud className="w-4 h-4" /> },
  { value: 'Rain', label: 'Rain', icon: <CloudRain className="w-4 h-4" /> },
  { value: 'Snow', label: 'Snow', icon: <CloudSnow className="w-4 h-4" /> },
  { value: 'Windy', label: 'Windy', icon: <Wind className="w-4 h-4" /> },
  { value: 'Hot', label: 'Hot', icon: <Thermometer className="w-4 h-4" /> },
  { value: 'Cold', label: 'Cold', icon: <Thermometer className="w-4 h-4" /> },
];

interface WeatherSelectorProps {
  value?: Weather;
  onChange: (value: Weather) => void;
}

export function WeatherSelector({ value, onChange }: WeatherSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Weather</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Weather)}>
        <SelectTrigger className="text-base">
          <SelectValue placeholder="Select weather conditions" />
        </SelectTrigger>
        <SelectContent>
          {WEATHER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                {option.icon}
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
