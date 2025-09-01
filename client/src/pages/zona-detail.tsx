import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SensorModal } from "@/components/modals/sensor-modal";
import { SimulatorModal } from "@/components/modals/simulator-modal";
import { SensorChart } from "@/components/charts/sensor-chart";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Plus, 
  Info, 
  Thermometer, 
  Droplets, 
  MapPin, 
  Settings,
  Trash2,
  RotateCcw,
  Activity
} from "lucide-react";
import type { Zone, Sensor } from "@shared/schema";

export default function ZoneDetail() {
  const params = useParams();
  const [isSensorModalOpen, setIsSensorModalOpen] = useState(false);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);

  const { data: zone } = useQuery<Zone>({
    queryKey: ["/api/zones", params.id],
    enabled: !!params.id,
  });

  const { data: sensors = [] } = useQuery<Sensor[]>({
    queryKey: ["/api/zones", params.id, "sensors"],
    enabled: !!params.id,
  });

  // Get the latest readings for each sensor
  const { data: latestReadings = [] } = useQuery({
    queryKey: ["/api/sensors", "latest-readings", sensors.map(s => s.id)],
    queryFn: async () => {
      if (sensors.length === 0) return [];
      const promises = sensors.map(async (sensor) => {
        try {
          const res = await apiRequest("GET", `/api/sensors/${sensor.id}/readings/latest`);
          const reading = await res.json();
          return { sensorId: sensor.id, reading };
        } catch (error) {
          return { sensorId: sensor.id, reading: null };
        }
      });
      return Promise.all(promises);
    },
    enabled: sensors.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time data
  });

  if (!zone) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Zona no encontrada</p>
        </div>
      </MainLayout>
    );
  }

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'temperature': return Thermometer;
      case 'humidity': return Droplets;
      case 'location': return MapPin;
      default: return Activity;
    }
  };

  const getSensorColor = (type: string) => {
    switch (type) {
      case 'temperature': return "bg-primary/10 text-primary";
      case 'humidity': return "bg-secondary/10 text-secondary";
      case 'location': return "bg-chart-3/10 text-chart-3";
      default: return "bg-accent/10 text-accent";
    }
  };

  const handleSimulate = (sensor: Sensor) => {
    setSelectedSensor(sensor);
    setIsSimulatorModalOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="zone-title">
              {zone.name}
            </h1>
            <p className="text-muted-foreground">
              Gestión de sensores y condiciones ambientales - {zone.stage.charAt(0).toUpperCase() + zone.stage.slice(1)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsSensorModalOpen(true)}
              data-testid="button-add-sensor"
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir Sensor
            </Button>
            <Button variant="outline" data-testid="button-fixed-info">
              <Info className="h-4 w-4 mr-2" />
              Info Fija
            </Button>
          </div>
        </div>

        {/* Sensors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sensors.map((sensor) => {
            const Icon = getSensorIcon(sensor.sensorType);
            const colorClass = getSensorColor(sensor.sensorType);
            const latestReading = latestReadings.find(lr => lr.sensorId === sensor.id)?.reading;
            
            return (
              <Card key={sensor.id} data-testid={`sensor-card-${sensor.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground" data-testid={`sensor-name-${sensor.id}`}>
                          {sensor.name}
                        </h3>
                        <p className="text-xs text-muted-foreground" data-testid={`sensor-id-${sensor.id}`}>
                          {sensor.deviceId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {latestReading && (
                        <div className={`w-2 h-2 rounded-full ${latestReading.isSimulated ? 'bg-orange-400' : 'bg-green-400'}`} 
                             title={latestReading.isSimulated ? 'Datos simulados' : 'Datos reales'} />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-sensor-info-${sensor.id}`}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-2xl font-bold text-foreground mb-2" data-testid={`sensor-value-${sensor.id}`}>
                      {latestReading ? Number(latestReading.value).toFixed(1) : '--'}
                      <span className="text-sm font-normal ml-1">
                        {sensor.unit || (sensor.sensorType === 'temperature' ? '°C' : sensor.sensorType === 'humidity' ? '%' : '')}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground" data-testid={`sensor-last-reading-${sensor.id}`}>
                      {latestReading 
                        ? `Actualizado ${formatDistanceToNow(new Date(latestReading.timestamp), { addSuffix: true, locale: es })}`
                        : "Sin lecturas recientes"
                      }
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {sensor.sensorType}
                    </Badge>
                    {latestReading?.isSimulated && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                        Simulado
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSimulate(sensor)}
                      className="text-xs"
                      data-testid={`button-simulate-${sensor.id}`}
                    >
                      <Activity className="h-3 w-3 mr-1" />
                      Simular
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add Sensor Card */}
          <Card className="border-dashed border-muted-foreground/30" data-testid="card-add-sensor">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">Añadir nuevo sensor</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSensorModalOpen(true)}
                  data-testid="button-configure-sensor"
                >
                  Configurar sensor
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Condiciones Temporales</span>
              <div className="flex items-center gap-4">
                <div className="flex border border-input rounded-md">
                  <Button size="sm" variant="default" className="rounded-r-none">Hoy</Button>
                  <Button size="sm" variant="ghost" className="rounded-none">7d</Button>
                  <Button size="sm" variant="ghost" className="rounded-l-none">30d</Button>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SensorChart sensors={sensors} />
          </CardContent>
        </Card>

        {/* Zone Fixed Info */}
        {Object.keys(zone.fixedInfo || {}).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Información Fija</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(zone.fixedInfo || {}).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-sm font-medium text-foreground">{key}</p>
                    <p className="text-muted-foreground">{String(value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <SensorModal 
          isOpen={isSensorModalOpen}
          onClose={() => setIsSensorModalOpen(false)}
          zoneId={zone.id}
        />

        <SimulatorModal 
          isOpen={isSimulatorModalOpen}
          onClose={() => setIsSimulatorModalOpen(false)}
          sensor={selectedSensor}
          zoneSensors={sensors}
        />
      </div>
    </MainLayout>
  );
}
