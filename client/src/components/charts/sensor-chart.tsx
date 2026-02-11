import { useState, useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sensor, SensorReading } from "@shared/schema";

interface SensorChartProps {
  sensors: Sensor[];
  className?: string;
}

export function SensorChart({ sensors, className }: SensorChartProps) {
  // 1. Estados para fechas separadas
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 1)); // Ayer
  const [endDate, setEndDate] = useState<Date>(new Date()); // Hoy
  const [selectedSensorId, setSelectedSensorId] = useState<string>("all");

  // Filtramos qué sensores vamos a consultar
  const sensorsToQuery = useMemo(() => {
    if (selectedSensorId === "all") return sensors;
    return sensors.filter((s) => s.id === selectedSensorId);
  }, [sensors, selectedSensorId]);

  // 2. Query corregida: Usa la API existente (Promise.all para paralelizar)
  const { data: readings = [], isLoading } = useQuery<
    (SensorReading & { sensorName: string; unit: string })[]
  >({
    queryKey: [
      "sensor-history",
      selectedSensorId,
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async () => {
      if (sensorsToQuery.length === 0) return [];

      const startIso = startOfDay(startDate).toISOString();
      const endIso = endOfDay(endDate).toISOString();

      // Lanzamos todas las peticiones a la vez para que sea rápido
      const promises = sensorsToQuery.map(async (sensor) => {
        const params = new URLSearchParams({
          startTime: startIso,
          endTime: endIso,
          includeSimulated: "true",
        });

        const res = await fetch(`/api/sensors/${sensor.id}/readings?${params}`);
        if (!res.ok) return [];
        const data: SensorReading[] = await res.json();

        // Añadimos metadatos del sensor a cada lectura para poder graficar
        return data.map((d) => ({
          ...d,
          sensorName: sensor.name,
          unit: sensor.unit || "",
        }));
      });

      const results = await Promise.all(promises);
      return results.flat(); // Aplanamos el array de arrays
    },
    enabled: sensors.length > 0 && !!startDate && !!endDate,
  });

  // 3. Procesar datos para el gráfico (Recharts)
  const chartData = useMemo(() => {
    if (!readings.length) return [];

    const groupedData = new Map<string, any>();

    readings.forEach((reading) => {
      // Agrupamos por minuto para alinear puntos en el gráfico
      const time = new Date(reading.timestamp);
      time.setSeconds(0, 0);
      const timeKey = time.toISOString();

      if (!groupedData.has(timeKey)) {
        groupedData.set(timeKey, {
          timestamp: timeKey, // Para ordenar
          displayTime: format(time, "dd/MM HH:mm", { locale: es }),
        });
      }

      const entry = groupedData.get(timeKey);
      entry[reading.sensorName] = Number(reading.value);
    });

    return Array.from(groupedData.values()).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
  }, [readings]);

  // 4. Función de Exportar a Excel (CSV con BOM para caracteres latinos)
  const handleExportExcel = () => {
    if (!readings.length) return;

    // Encabezados
    const headers = [
      "Fecha",
      "Hora",
      "Sensor",
      "Valor",
      "Unidad",
      "Es Simulado",
    ];

    // Filas de datos
    const rows = readings.map((r) => {
      const date = new Date(r.timestamp);
      return [
        format(date, "dd/MM/yyyy"),
        format(date, "HH:mm:ss"),
        `"${r.sensorName}"`, // Comillas por si tiene espacios
        r.value.replace(".", ","), // Excel español usa coma decimal a veces
        r.unit,
        r.isSimulated ? "Sí" : "No",
      ].join(";"); // Usamos punto y coma para Excel europeo
    });

    // Unir todo con BOM (\uFEFF) para que Excel reconozca tildes/ñ
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `reporte_sensores_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const colors = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed"];

  if (sensors.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
        No hay sensores configurados en esta zona.
      </div>
    );
  }

  return (
    <Card className={cn("col-span-4", className)}>
      <CardHeader>
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* Selector de Sensor */}
            <Select
              value={selectedSensorId}
              onValueChange={setSelectedSensorId}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Seleccionar sensor" />
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

            <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-md border">
              {/* Fecha Inicio */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"ghost"}
                    size="sm"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? (
                      format(startDate, "dd/MM/yy")
                    ) : (
                      <span>Inicio</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground text-xs">a</span>

              {/* Fecha Fin */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"ghost"}
                    size="sm"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yy") : <span>Fin</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    disabled={(date) => date < startDate}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Botón Exportar Excel */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={!readings.length}
              className="ml-auto xl:ml-0 gap-2 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pl-0">
        <div className="h-[350px] w-full mt-4 min-h-[300px]">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Cargando datos de {sensorsToQuery.length} sensores...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg mx-4">
              <p>No hay datos disponibles en este rango de fechas.</p>
              <p className="text-xs mt-1">
                Intenta ampliar el rango o generar datos simulados.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="displayTime"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend iconType="circle" />

                {sensorsToQuery.map((sensor, index) => (
                  <Line
                    key={sensor.id}
                    type="monotone"
                    dataKey={sensor.name}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
