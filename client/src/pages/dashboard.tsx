import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Sprout, 
  TrendingUp, 
  Wind, 
  QrCode,
  Thermometer,
  Droplets,
  MapPin,
  Clock,
  Factory,
  Truck
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface DashboardData {
  loteCounts: {
    cria: number;
    engorde: number;
    matadero: number;
    secadero: number;
    distribucion: number;
  };
  qrCount: number;
  zoneActivity: Array<{
    zone: {
      id: string;
      name: string;
      stage: string;
    };
    readings: Array<{
      sensor: {
        id: string;
        name: string;
        sensorType: string;
        unit?: string;
      };
      value: string;
      timestamp: string;
    }>;
    lastActivity: string | null;
  }>;
}

const stageIcons = {
  cria: Sprout,
  engorde: TrendingUp,
  matadero: Factory,
  secadero: Wind,
  distribucion: Truck
} as const;

const stageColors = {
  cria: "bg-secondary/10 text-secondary",
  engorde: "bg-primary/10 text-primary",
  matadero: "bg-accent/10 text-accent",
  secadero: "bg-chart-3/10 text-chart-3",
  distribucion: "bg-chart-4/10 text-chart-4"
} as const;

function getSensorIcon(type: string) {
  switch (type) {
    case 'temperature': return Thermometer;
    case 'humidity': return Droplets;
    case 'location': return MapPin;
    default: return Clock;
  }
}

export default function Dashboard() {
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Panel de Control</h1>
            <p className="text-muted-foreground">Resumen general del sistema de trazabilidad</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-16 bg-muted rounded-lg mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!dashboardData) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hay datos de lotes y zonas disponibles</p>
          <div className="flex gap-4 justify-center mt-6">
            <Link href="/lotes">
              <Button data-testid="link-add-lotes">Añadir lotes</Button>
            </Link>
            <Link href="/zona/cria">
              <Button variant="outline" data-testid="link-add-zones">Añadir zonas</Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const hasLotes = Object.values(dashboardData.loteCounts).some(count => count > 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Panel de Control</h1>
          <p className="text-muted-foreground">Resumen general del sistema de trazabilidad</p>
        </div>

        {!hasLotes ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-6">Añade lotes y zonas para visualizar información</p>
            <div className="flex gap-4 justify-center">
              <Link href="/lotes">
                <Button data-testid="link-add-lotes">Añadir lotes</Button>
              </Link>
              <Link href="/zona/cria">
                <Button variant="outline" data-testid="link-add-zones">Añadir zonas</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Object.entries(dashboardData.loteCounts).map(([stage, count]) => {
                const Icon = stageIcons[stage as keyof typeof stageIcons];
                const colorClass = stageColors[stage as keyof typeof stageColors];
                
                return (
                  <Card key={stage} data-testid={`card-stage-${stage}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="text-2xl font-bold text-foreground" data-testid={`count-${stage}`}>
                          {count}
                        </span>
                      </div>
                      <h3 className="font-medium text-foreground capitalize">
                        Lotes en {stage === 'cria' ? 'Cría' : stage}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {/* TODO: Show active zones count */}
                        Activos
                      </p>
                    </CardContent>
                  </Card>
                );
              })}

              <Card data-testid="card-qr-count">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center">
                      <QrCode className="h-6 w-6 text-chart-3" />
                    </div>
                    <span className="text-2xl font-bold text-foreground" data-testid="count-qr">
                      {dashboardData.qrCount}
                    </span>
                  </div>
                  <h3 className="font-medium text-foreground">QR Generados</h3>
                  <p className="text-sm text-muted-foreground">Activos</p>
                </CardContent>
              </Card>
            </div>

            {/* Zones Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Zonas con Actividad</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData.zoneActivity.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay actividad de sensores registrada
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboardData.zoneActivity.map((activity) => (
                      <Link key={activity.zone.id} href={`/zona/${activity.zone.stage}/${activity.zone.id}`}>
                        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" data-testid={`zone-activity-${activity.zone.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-medium text-foreground" data-testid={`zone-name-${activity.zone.id}`}>
                                {activity.zone.name}
                              </h3>
                              <span className="text-xs text-muted-foreground" data-testid={`zone-last-activity-${activity.zone.id}`}>
                                {activity.lastActivity ? 
                                  formatDistanceToNow(new Date(activity.lastActivity), { 
                                    addSuffix: true,
                                    locale: es 
                                  }) : 
                                  'Sin datos'
                                }
                              </span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {activity.readings.slice(0, 3).map((reading) => {
                                const Icon = getSensorIcon(reading.sensor.sensorType);
                                const value = parseFloat(reading.value);
                                const unit = reading.sensor.unit || (reading.sensor.sensorType === 'temperature' ? '°C' : reading.sensor.sensorType === 'humidity' ? '%' : '');
                                
                                return (
                                  <Badge
                                    key={reading.sensor.id}
                                    variant="secondary"
                                    className="text-xs"
                                    data-testid={`sensor-reading-${reading.sensor.id}`}
                                  >
                                    <Icon className="h-3 w-3 mr-1" />
                                    {value.toFixed(1)}{unit}
                                  </Badge>
                                );
                              })}
                              {activity.readings.length === 0 && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Sin datos recientes
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
