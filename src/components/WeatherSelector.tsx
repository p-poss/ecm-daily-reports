import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Cloud, CloudRain, CloudSnow, Sun, Wind, Thermometer, PenLine } from 'lucide-react';
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

const PRESET_VALUES = WEATHER_OPTIONS.map((o) => o.value);

interface WeatherSelectorProps {
  value?: Weather;
  onChange: (value: Weather) => void;
}

export function WeatherSelector({ value, onChange }: WeatherSelectorProps) {
  const isCustomValue = value && !PRESET_VALUES.includes(value);
  const [showCustomInput, setShowCustomInput] = useState(isCustomValue);
  const [customValue, setCustomValue] = useState(isCustomValue ? value : '');

  useEffect(() => {
    if (value && !PRESET_VALUES.includes(value)) {
      setShowCustomInput(true);
      setCustomValue(value);
    }
  }, [value]);

  function handleSelectChange(v: string) {
    if (v === '__other__') {
      setShowCustomInput(true);
      setCustomValue('');
    } else {
      setShowCustomInput(false);
      setCustomValue('');
      onChange(v as Weather);
    }
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setCustomValue(newValue);
    if (newValue.trim()) {
      onChange(newValue.trim() as Weather);
    }
  }

  const selectValue = showCustomInput ? '__other__' : value;

  return (
    <div className="space-y-2">
      <Label>Weather</Label>
      <Select value={selectValue} onValueChange={handleSelectChange}>
        <SelectTrigger className="w-fit min-w-48 text-sm">
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
          <SelectItem value="__other__">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              <span>Other (write-in)</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {showCustomInput && (
        <Input
          type="text"
          placeholder="Enter weather conditions..."
          value={customValue}
          onChange={handleCustomChange}
          className="text-base"
          autoFocus
        />
      )}
    </div>
  );
}
