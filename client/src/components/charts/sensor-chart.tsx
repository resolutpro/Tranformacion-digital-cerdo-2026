import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import type { Sensor, SensorReading } from "@shared/schema";

interface SensorChartProps {
  sensors: Sensor[];
}

export function SensorChart({ sensors }: SensorChartProps) {
  const [selectedSensorId, setSelectedSensorId] = useState<string>("all");
  const [timeRange, setTimeRange] = useState("today");
  const [includeSimulated, setIncludeSimulated] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const getTimeRange = () => {
    const now = new Date();
    switch (timeRange) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "7days":
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) }; // Include today + 6 days = 7 days total
      case "30days":
        return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) }; // Include today + 29 days = 30 days total
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
        const response = await fetch(
          `/api/sensors/${sensor.id}/readings?startTime=${start.toISOString()}&endTime=${end.toISOString()}&includeSimulated=${includeSimulated}`,
          { credentials: "include" }
        );
        
        if (response.ok) {
          const readings: SensorReading[] = await response.json();
          allReadings.push(...readings.map(r => ({ ...r, sensor })));
        }
      }
      
      return allReadings;
    },
    refetchInterval: isLive ? 30000 : false, // Refetch every 30 seconds if live
  });

  // Transform data for chart
  const chartData = readingsData.reduce((acc: any[], reading) => {
    const timestamp = new Date(reading.timestamp).getTime();
    let existing = acc.find(point => Math.abs(point.timestamp - timestamp) < 60000); // Group readings within 1 minute
    
    if (!existing) {
      existing = {
        timestamp,
        time: format(new Date(reading.timestamp), 'HH:mm', { locale: es }),
        date: format(new Date(reading.timestamp), 'dd/MM', { locale: es }),
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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedSensorId} onValueChange={setSelectedSensorId}>
            <SelectTrigger className="w-48" data-testid="select-chart-sensor">
              <SelectValue />
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
              className="rounded-r-none"
              onClick={() => setTimeRange("today")}
              data-testid="button-range-today"
            >
              Hoy
            </Button>
            <Button 
              size="sm" 
              variant={timeRange === "7days" ? "default" : "ghost"}
              className="rounded-none"
              onClick={() => setTimeRange("7days")}
              data-testid="button-range-7days"
            >
              7d
            </Button>
            <Button 
              size="sm" 
              variant={timeRange === "30days" ? "default" : "ghost"}
              className="rounded-l-none"
              onClick={() => setTimeRange("30days")}
              data-testid="button-range-30days"
            >
              30d
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
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

      {/* Chart */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
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
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    domain={['dataMin', 'dataMax']}
                    type="category"
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => `Hora: ${value}`}
                    formatter={(value: any, name: string) => {
                      const unit = sensorsToQuery.find(s => s.name.replace(/\s+/g, '_') === name)?.unit || 
                        (name.includes('temperatura') ? '°C' : name.includes('humedad') ? '%' : '');
                      return [`${value}${unit}`, name];
                    }}
                  />
                  <Legend />
                  {sensorsToQuery.map((sensor, index) => {
                    const sensorKey = sensor.name.replace(/\s+/g, '_');
                    return (
                      <Line
                        key={sensor.id}
                        type="monotone"
                        dataKey={sensorKey}
                        stroke={sensorColors[index % sensorColors.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
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
