import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import type { Sensor, SensorReading } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Assume apiRequest is defined elsewhere, e.g.:
// import { apiRequest } from "@/lib/api"; 

// Assume getDateRanges is defined elsewhere, e.g.:
// const getDateRanges = () => { /* ... */ };

interface SensorChartProps {
  sensors: Sensor[];
}

// Mock implementation for apiRequest and getDateRanges for context
const apiRequest = async (method: string, url: string, body?: any) => {
  // Mock API request - replace with actual implementation
  console.log(`Mock API Request: ${method} ${url}`, body);
  if (url.includes('/api/sensors/')) {
    // Simulate fetching readings
    const mockReadings: SensorReading[] = Array.from({ length: 10 }, (_, i) => ({
      id: `reading-${i}`,
      sensorId: url.split('/')[3],
      timestamp: new Date(Date.now() - (10 - i) * 60000).toISOString(), // Last 10 minutes
      value: (Math.random() * 30).toFixed(2),
      isSimulated: Math.random() > 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    return {
      ok: true,
      json: async () => mockReadings,
    };
  }
  return { ok: false, json: async () => ({}) };
};

const getDateRanges = () => {
  const now = new Date();
  return {
    today: { start: startOfDay(now), end: endOfDay(now) },
    "7days": { start: startOfDay(subDays(now, 6)), end: endOfDay(now) },
    "30days": { start: startOfDay(subDays(now, 29)), end: endOfDay(now) },
  };
};


export function SensorChart({ sensors }: SensorChartProps) {
  const [selectedSensorId, setSelectedSensorId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());
  const [includeSimulated, setIncludeSimulated] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const getTimeRange = () => {
    const now = new Date();
    switch (timeRange) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "7days":
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      case "30days":
        return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
      case "custom":
        return customDate 
          ? { start: startOfDay(customDate), end: endOfDay(customDate) }
          : { start: startOfDay(now), end: endOfDay(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const { start, end } = getTimeRange();
  const sensorsToQuery = selectedSensorId === "all" ? sensors : sensors.filter(s => s.id === selectedSensorId);

  const { data: readingsData = [], isLoading } = useQuery({
    queryKey: [
      "/api/sensors", 
      selectedSensorId, 
      "readings",
      start.toISOString(),
      end.toISOString(),
      includeSimulated
    ],
    queryFn: async () => {
      if (sensorsToQuery.length === 0) return [];

      const allReadings: Array<SensorReading & { sensor: Sensor }> = [];

      for (const sensor of sensorsToQuery) {
        try {
          const response = await fetch(
            `/api/sensors/${sensor.id}/readings?startTime=${encodeURIComponent(start.toISOString())}&endTime=${encodeURIComponent(end.toISOString())}&includeSimulated=${includeSimulated}`,
            { 
              credentials: "include",
              headers: {
                'Content-Type': 'application/json',
              }
            }
          );

          if (response.ok) {
            const readings: SensorReading[] = await response.json();
            allReadings.push(...readings.map(r => ({ ...r, sensor })));
          } else {
            console.error(`Failed to fetch readings for sensor ${sensor.id}:`, response.status, response.statusText);
          }
        } catch (error) {
          console.error(`Error fetching readings for sensor ${sensor.id}:`, error);
        }
      }

      return allReadings;
    },
    enabled: sensorsToQuery.length > 0,
    refetchInterval: isLive ? 5000 : 10000, // Refetch every 5 seconds if live, 10 seconds otherwise
    refetchIntervalInBackground: true, // Keep refetching in background
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Transform data for chart
  const chartData = readingsData.reduce((acc: any[], reading) => {
    // Data is stored in UTC and converted to Madrid timezone for display
    // The formatMadridTime utility handles the timezone conversion
    const readingDate = new Date(reading.timestamp); 
    const timestamp = readingDate.getTime(); // Using the UTC timestamp from the data

    let existing = acc.find(point => Math.abs(point.timestamp - timestamp) < 60000); // Group readings within 1 minute

    if (!existing) {
      existing = {
        timestamp,
        time: format(readingDate, 'HH:mm', { locale: es }),
        date: format(readingDate, 'dd/MM', { locale: es }),
        fullLabel: timeRange === 'today' 
          ? format(readingDate, 'HH:mm', { locale: es })
          : timeRange === '7days'
            ? format(readingDate, 'dd/MM HH:mm', { locale: es })
            : format(readingDate, 'dd/MM/yy HH:mm', { locale: es })
      };
      acc.push(existing);
    }

    const sensorKey = reading.sensor.name.replace(/\s+/g, '_');
    existing[sensorKey] = parseFloat(reading.value);
    existing[`${sensorKey}_simulated`] = reading.isSimulated;

    return acc;
  }, []).sort((a, b) => a.timestamp - b.timestamp);

  const sensorColors = ['#3b82f6', '#eab308', '#22c55e', '#ef4444', '#8b5cf6'];

  if (sensors.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No hay sensores configurados en esta zona</p>
        </CardContent>
      </Card>
    );
  }

  // Get the latest reading for each sensor to display in the card summary
  const latestReadings = sensors.reduce((acc: Record<string, SensorReading & { sensor: Sensor }>, sensor) => {
    const latestForSensor = readingsData
      .filter(r => r.sensor.id === sensor.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    if (latestForSensor) {
      acc[sensor.id] = latestForSensor;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Select value={selectedSensorId} onValueChange={setSelectedSensorId}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-chart-sensor">
              <SelectValue placeholder="Seleccionar sensor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los sensores</SelectItem>
              {sensors.map((sensor) => (
                <SelectItem key={sensor.id} value={sensor.id}>
                  {sensor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border border-input rounded-md">
            <Button 
              size="sm" 
              variant={timeRange === "today" ? "default" : "ghost"}
              className="rounded-r-none flex-1 sm:flex-none"
              onClick={() => setTimeRange("today")}
              data-testid="button-range-today"
            >
              Hoy
            </Button>
            <Button 
              size="sm" 
              variant={timeRange === "7days" ? "default" : "ghost"}
              className="rounded-none flex-1 sm:flex-none"
              onClick={() => setTimeRange("7days")}
              data-testid="button-range-7days"
            >
              7d
            </Button>
            <Button 
              size="sm" 
              variant={timeRange === "30days" ? "default" : "ghost"}
              className="rounded-l-none flex-1 sm:flex-none"
              onClick={() => setTimeRange("30days")}
              data-testid="button-range-30days"
            >
              30d
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={timeRange === "custom" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "rounded-l-none border-l flex-1 sm:flex-none font-normal",
                    !customDate && "text-muted-foreground"
                  )}
                  data-testid="button-range-custom"
                >
                  <CalendarIcon className="h-4 w-4" />
                  <span className="sr-only">Seleccionar fecha</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    setCustomDate(date);
                    setTimeRange("custom");
                  }}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center space-x-2">
            <Switch
              id="include-simulated"
              checked={includeSimulated}
              onCheckedChange={setIncludeSimulated}
              data-testid="switch-include-simulated"
            />
            <Label htmlFor="include-simulated" className="text-sm">
              Incluir datos simulados
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="live-mode"
              checked={isLive}
              onCheckedChange={setIsLive}
              data-testid="switch-live-mode"
            />
            <Label htmlFor="live-mode" className="text-sm">
              En vivo
            </Label>
          </div>
        </div>
      </div>

      {/* Sensor Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sensors.map((sensor) => {
          const latestReading = latestReadings[sensor.id];
          const sensorKey = sensor.name.replace(/\s+/g, '_');
          const isSimulated = latestReading ? latestReading[`${sensorKey}_simulated`] : false;

          return (
            <Card key={sensor.id}>
              <CardContent className="p-3 md:p-4 flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-base md:text-lg font-semibold mb-2 truncate">{sensor.name}</h3>
                  <p className="text-muted-foreground text-xs md:text-sm mb-2 line-clamp-2">
                    {sensor.description || 'Sin descripción'}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-baseline gap-2">
                    {latestReading ? (
                      <>
                        <span className="text-2xl md:text-3xl font-bold">
                          {parseFloat(latestReading.value).toFixed(1)}
                        </span>
                        <span className="text-xs md:text-sm text-muted-foreground">{sensor.unit || ''}</span>
                        {isSimulated && <span className="text-xs text-yellow-600">(Simulado)</span>}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                        <span className="text-sm">Cargando...</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-6">
          {isLoading && sensorsToQuery.length > 0 ? ( // Only show loader if there are sensors to query
            <div className="h-64 bg-muted/10 rounded-lg border-2 border-dashed border-muted flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Cargando datos de sensores...</p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 bg-muted/10 rounded-lg border-2 border-dashed border-muted flex items-center justify-center">
              <div className="text-center">
                <svg className="h-12 w-12 text-muted-foreground mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-muted-foreground">No hay lecturas para el periodo seleccionado</p>
              </div>
            </div>
          ) : (
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="fullLabel" 
                    tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
                    domain={['dataMin', 'dataMax']}
                    type="category"
                    angle={timeRange !== 'today' ? -45 : 0}
                    textAnchor={timeRange !== 'today' ? 'end' : 'middle'}
                    height={timeRange !== 'today' ? 80 : 60}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => `Hora: ${value}`}
                    formatter={(value: any, name: string) => {
                      const unit = sensorsToQuery.find(s => s.name.replace(/\s+/g, '_') === name)?.unit || 
                        (name.includes('temperatura') ? '°C' : name.includes('humedad') ? '%' : '');
                      return [`${value}${unit}`, name];
                    }}
                    contentStyle={{
                      fontSize: window.innerWidth < 768 ? '12px' : '14px',
                    }}
                  />
                  <Legend 
                    wrapperStyle={{
                      fontSize: window.innerWidth < 768 ? '12px' : '14px',
                    }}
                  />
                  {sensorsToQuery.map((sensor, index) => {
                    const sensorKey = sensor.name.replace(/\s+/g, '_');
                    return (
                      <Line
                        key={sensor.id}
                        type="monotone"
                        dataKey={sensorKey}
                        stroke={sensorColors[index % sensorColors.length]}
                        strokeWidth={window.innerWidth < 768 ? 1 : 2}
                        dot={{ r: window.innerWidth < 768 ? 1 : 2 }}
                        strokeDasharray={
                          chartData.some(d => d[`${sensorKey}_simulated`]) ? "5 5" : undefined
                        }
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}