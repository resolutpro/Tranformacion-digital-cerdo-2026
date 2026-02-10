import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BrainCircuit,
  TrendingUp,
  Activity,
  AlertTriangle,
  Leaf,
  ThermometerSun,
  LayoutDashboard,
  PlusCircle,
  ArrowLeft,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Link } from "wouter";

interface AiPredictionData {
  predictions: Array<{
    id: string;
    stage: string;
    animals: number;
    score: number;
    action: string;
    status: "success" | "warning" | "destructive" | "default";
    avgTemp: string;
  }>;
  biStats: {
    efficiency: number;
    quality: string;
    feedSaved: number;
    alertsCount: number;
  };
  sensorCorrelation: Array<{
    time: string;
    temp: number;
    growthRate: number;
  }>;
  feedOptimizationData: Array<{
    month: string;
    consumoReal: number;
    consumoOptimo: number;
    desperdicio: number;
  }>;
  hasData: boolean;
}

// Componente para estado vacío reutilizable
const EmptyState = ({
  message,
  icon: Icon,
}: {
  message: string;
  icon: any;
}) => (
  <div className="flex flex-col items-center justify-center h-[300px] border-2 border-dashed rounded-lg p-8 text-center animate-in fade-in-50">
    <div className="bg-muted p-4 rounded-full mb-4">
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-medium mb-2">No hay datos suficientes</h3>
    <p className="text-muted-foreground max-w-sm mb-6">{message}</p>
    <Link href="/lotes">
      <Button variant="outline" className="gap-2">
        <PlusCircle className="h-4 w-4" />
        Gestionar Lotes
      </Button>
    </Link>
  </div>
);

export default function AiPredictionPage() {
  const { data, isLoading } = useQuery<AiPredictionData>({
    queryKey: ["/api/ai/analysis"],
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Si no hay datos, mostramos estado inicial limpio
  const hasData = data?.hasData || false;
  const stats = data?.biStats || {
    efficiency: 0,
    quality: "-",
    feedSaved: 0,
    alertsCount: 0,
  };
  const predictions = data?.predictions || [];
  const correlationData = data?.sensorCorrelation || [];
  const feedData = data?.feedOptimizationData || [];

  return (
    <div className="space-y-6 p-6 pb-20">
      <div>
        <Link href="/dashboard">
          <Button
            variant="ghost"
            className="gap-2 pl-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Dashboard
          </Button>
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BrainCircuit className="h-8 w-8 text-primary" />
          Inteligencia Artificial
        </h1>
        <p className="text-muted-foreground">
          {hasData
            ? "Análisis en tiempo real de tus lotes activos."
            : "El sistema está esperando datos de lotes y sensores para comenzar el análisis."}
        </p>
      </div>

      {/* KPI Cards - Se muestran siempre pero con 0 o guiones si no hay data */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasData ? `${stats.efficiency}%` : "--"}
            </div>
            <Progress value={stats.efficiency} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Calidad Proyectada
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.quality}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas IA</CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${stats.alertsCount > 0 ? "text-red-500" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.alertsCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="predictions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="predictions">Predicción por Lote</TabsTrigger>
          <TabsTrigger value="iot">Análisis IoT</TabsTrigger>
          <TabsTrigger value="bi">Business Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Salud y Rendimiento</CardTitle>
              <CardDescription>
                Análisis individualizado por lote activo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasData || predictions.length === 0 ? (
                <EmptyState
                  message="No hay lotes activos actualmente. Crea un lote y asígnale una zona con sensores para ver predicciones."
                  icon={LayoutDashboard}
                />
              ) : (
                <div className="space-y-6">
                  {predictions.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium leading-none">{p.id}</p>
                          {p.avgTemp !== "N/A" && (
                            <Badge variant="outline" className="text-xs">
                              <ThermometerSun className="h-3 w-3 mr-1" />{" "}
                              {p.avgTemp}ºC
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {p.animals} animales
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant={
                            p.score > 90
                              ? "default"
                              : p.score > 70
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          Score: {p.score}/100
                        </Badge>
                        <span
                          className={`text-sm font-medium ${
                            p.status === "warning"
                              ? "text-yellow-600"
                              : p.status === "destructive"
                                ? "text-red-600"
                                : "text-green-600"
                          }`}
                        >
                          {p.action}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Correlación Ambiental</CardTitle>
              <CardDescription>
                Temperatura vs Crecimiento Estimado (Últimas 24h)
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {correlationData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={correlationData}>
                    <defs>
                      <linearGradient
                        id="colorGrowth"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#8884d8"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8884d8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="growthRate"
                      name="Crecimiento (%)"
                      stroke="#8884d8"
                      fill="url(#colorGrowth)"
                    />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      name="Temperatura (ºC)"
                      stroke="#ff7300"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  message="No se han recibido lecturas de sensores recientes asociadas a lotes activos."
                  icon={ThermometerSun}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consumo Proyectado</CardTitle>
              <CardDescription>
                Estimación basada en carga animal actual
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {feedData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="consumoReal"
                      name="Proyección (kg)"
                      fill="#94a3b8"
                    />
                    <Bar
                      dataKey="consumoOptimo"
                      name="Meta Óptima (kg)"
                      fill="#16a34a"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  message="Se necesitan lotes activos para calcular las proyecciones de consumo de pienso."
                  icon={Leaf}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
