import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SensorModal } from "@/components/modals/sensor-modal";
import { SimulatorModal } from "@/components/modals/simulator-modal";
import { HttpSimulatorModal } from "@/components/modals/http-simulator-modal";
import { ThresholdModal } from "@/components/modals/threshold-modal";
import { SensorInfoModal } from "@/components/modals/sensor-info-modal";
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
  Activity,
  Zap,
  Loader2
} from "lucide-react";
import type { Zone, Sensor } from "@shared/schema";

export default function ZoneDetail() {
  const params = useParams();
  const { toast } = useToast();
  const [isSensorModalOpen, setIsSensorModalOpen] = useState(false);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);
  const [isHttpSimulatorModalOpen, setIsHttpSimulatorModalOpen] = useState(false);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [isSensorInfoModalOpen, setIsSensorInfoModalOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);

  const { data: zone, isLoading: isLoadingZone } = useQuery<Zone>({
    queryKey: ["/api/zones", params.id],
    enabled: !!params.id,
  });

  const { data: sensors = [] } = useQuery<Sensor[]>({
    queryKey: ["/api/zones", params.id, "sensors"],
    enabled: !!params.id,
  });

  const { data: latestReadings = [] } = useQuery({
    queryKey: ["/api/sensors", "latest-readings", sensors.map(s => s.id)],
    queryFn: async () => {
      if (sensors.length === 0) return [];
      const promises = sensors.map(async (sensor) => {
        try {
          const res = await apiRequest("GET", `/api/sensors/${sensor.id}/readings/latest`);
          if (res.ok) {
            const reading = await res.json();
            return { sensorId: sensor.id, reading };
          }
          return { sensorId: sensor.id, reading: null };
        } catch (error) {
          return { sensorId: sensor.id, reading: null };
        }
      });
      return Promise.all(promises);
    },
    enabled: sensors.length > 0,
    refetchInterval: 3000,
  });

  const deleteSensorMutation = useMutation({
    mutationFn: async (sensorId: string) => {
      await apiRequest("DELETE", `/api/sensors/${sensorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones", params.id, "sensors"] });
      toast({ title: "Sensor eliminado", description: "El sensor ha sido eliminado correctamente" });
    },
  });

  if (isLoadingZone) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando detalles de la zona...</p>
        </div>
      </MainLayout>
    );
  }

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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">{zone.name}</h1>
            <p className="text-sm md:text-base text-muted-foreground uppercase">
              Etapa: {zone.stage}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsSensorModalOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Añadir Sensor
            </Button>
            <Button variant="outline" onClick={() => setIsHttpSimulatorModalOpen(true)} size="sm">
              <Zap className="h-4 w-4 mr-2" /> Simulador HTTP
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sensors.map((sensor) => {
            const Icon = getSensorIcon(sensor.sensorType);
            const latestReading = latestReadings.find(lr => lr.sensorId === sensor.id)?.reading;
            const hasThresholds = sensor.validationMin !== null || sensor.validationMax !== null;

            return (
              <Card key={sensor.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium truncate max-w-[150px]">{sensor.name}</h3>
                        <p className="text-xs text-muted-foreground">{sensor.deviceId}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setSelectedSensor(sensor); setIsSensorInfoModalOpen(true); }}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => deleteSensorMutation.mutate(sensor.id)} 
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-2xl font-bold">
                      {latestReading ? Number(latestReading.value).toFixed(1) : '--'}
                      <span className="text-sm font-normal ml-1">
                        {sensor.unit || (sensor.sensorType === 'temperature' ? '°C' : sensor.sensorType === 'humidity' ? '%' : '')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {latestReading 
                        ? `Hace ${formatDistanceToNow(new Date(latestReading.timestamp), { locale: es })}`
                        : "Sin lecturas"
                      }
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px]">{sensor.sensorType}</Badge>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedSensor(sensor); setIsSimulatorModalOpen(true); }} className="h-7 text-xs">
                        Simular
                      </Button>
                    </div>

                    <Button 
                      variant={hasThresholds ? "outline" : "secondary"} 
                      className={`w-full h-8 text-xs ${!hasThresholds ? "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" : ""}`}
                      onClick={() => { setSelectedSensor(sensor); setIsThresholdModalOpen(true); }}
                    >
                      <Settings className="h-3 w-3 mr-2" />
                      {hasThresholds ? "Ver/Editar Umbrales" : "Configurar Umbrales"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader><CardTitle>Histórico de Sensores</CardTitle></CardHeader>
          <CardContent><SensorChart sensors={sensors} /></CardContent>
        </Card>

        <SensorInfoModal 
          isOpen={isSensorInfoModalOpen} 
          onClose={() => setIsSensorInfoModalOpen(false)} 
          sensor={selectedSensor} 
          latestReading={latestReadings.find(lr => lr.sensorId === selectedSensor?.id)?.reading}
        />
        <ThresholdModal 
          isOpen={isThresholdModalOpen} 
          onClose={() => setIsThresholdModalOpen(false)} 
          sensor={selectedSensor} 
        />
        <SensorModal isOpen={isSensorModalOpen} onClose={() => setIsSensorModalOpen(false)} zoneId={zone.id} />
        <SimulatorModal isOpen={isSimulatorModalOpen} onClose={() => setIsSimulatorModalOpen(false)} sensor={selectedSensor} zoneSensors={sensors} />
        <HttpSimulatorModal isOpen={isHttpSimulatorModalOpen} onClose={() => setIsHttpSimulatorModalOpen(false)} sensor={selectedSensor} allSensors={sensors} />
      </div>
    </MainLayout>
  );
}