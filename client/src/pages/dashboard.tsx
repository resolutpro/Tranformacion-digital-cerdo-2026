import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Heart, 
  TrendingUp, 
  Wind, 
  QrCode,
  Thermometer,
  Droplets,
  MapPin,
  Clock,
  Factory,
  Truck,
  AlertCircle,
  CheckCircle,
  Users,
  Plus,
  ArrowRight
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
    unassigned: number;
    finished: number;
  };
  animalCounts?: {
    cria: number;
    engorde: number;
    matadero: number;
    secadero: number;
    distribucion: number;
    unassigned: number;
  };
  totalAnimals: number;
  qrCount: number;
  subloteCount: number;
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
  unassignedLotes: Array<{
    id: string;
    identification: string;
    initialAnimals: number;
    createdAt: string;
    pieceType?: string;
  }>;
}

const stageIcons = {
  cria: Heart,
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
  const totalActiveLotes = Object.entries(dashboardData.loteCounts)
    .filter(([key]) => key !== 'unassigned' && key !== 'finished')
    .reduce((sum, [_, count]) => sum + count, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Panel de Control</h1>
          <p className="text-muted-foreground">Resumen general del sistema de trazabilidad</p>
        </div>

        {/* Quick Summary Cards */}
        {hasLotes && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Total Lotes</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {totalActiveLotes + dashboardData.loteCounts.unassigned}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700">Animales</p>
                    <p className="text-2xl font-bold text-green-900">{dashboardData.totalAnimals}</p>
                  </div>
                  <Heart className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Sublotes</p>
                    <p className="text-2xl font-bold text-purple-900">{dashboardData.subloteCount}</p>
                  </div>
                  <Wind className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-700">Certificación QR</p>
                    <p className="text-2xl font-bold text-orange-900">{dashboardData.qrCount}</p>
                  </div>
                  <QrCode className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
            {/* Unassigned Lotes Warning */}
            {dashboardData.loteCounts.unassigned > 0 && (
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="font-medium text-orange-900">
                          {dashboardData.loteCounts.unassigned} lotes sin asignar
                        </p>
                        <p className="text-sm text-orange-700">
                          Estos lotes necesitan ser asignados a una zona para comenzar el proceso
                        </p>
                      </div>
                    </div>
                    <Link href="/seguimiento">
                      <Button variant="outline" className="border-orange-300 hover:bg-orange-100">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Asignar
                      </Button>
                    </Link>
                  </div>
                  
                  {dashboardData.unassignedLotes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-orange-200">
                      <p className="text-sm font-medium text-orange-900 mb-2">Lotes pendientes:</p>
                      <div className="flex flex-wrap gap-2">
                        {dashboardData.unassignedLotes.slice(0, 5).map((lote) => (
                          <Badge key={lote.id} variant="outline" className="border-orange-300 text-orange-700">
                            {lote.identification} ({lote.initialAnimals} animales)
                          </Badge>
                        ))}
                        {dashboardData.unassignedLotes.length > 5 && (
                          <Badge variant="outline" className="border-orange-300 text-orange-700">
                            +{dashboardData.unassignedLotes.length - 5} más
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
              {Object.entries(dashboardData.loteCounts)
                .filter(([stage]) => ['cria', 'engorde', 'matadero', 'secadero', 'distribucion'].includes(stage))
                .map(([stage, count]) => {
                const Icon = stageIcons[stage as keyof typeof stageIcons];
                const colorClass = stageColors[stage as keyof typeof stageColors];
                const animalCount = dashboardData.animalCounts?.[stage as keyof typeof dashboardData.animalCounts] || 0;
                
                return (
                  <Link key={stage} href={`/${stage}`}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`card-stage-${stage}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-bold text-foreground block" data-testid={`count-${stage}`}>
                              {count}
                            </span>
                            <span className="text-sm text-muted-foreground" data-testid={`animal-count-${stage}`}>
                              {animalCount} animales
                            </span>
                          </div>
                        </div>
                        <h3 className="font-medium text-foreground text-sm capitalize">
                          {stage === 'cria' ? 'Cría' : stage}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Lotes activos
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}

              <Card className={dashboardData.loteCounts.finished > 0 ? "border-green-200 bg-green-50/50" : ""} data-testid="card-finished">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-xl font-bold text-foreground" data-testid="count-finished">
                      {dashboardData.loteCounts.finished}
                    </span>
                  </div>
                  <h3 className="font-medium text-foreground text-sm">Finalizados</h3>
                  <p className="text-xs text-muted-foreground">Lotes completos</p>
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
