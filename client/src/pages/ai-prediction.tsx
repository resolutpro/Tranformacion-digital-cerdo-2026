import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BrainCircuit,
  TrendingUp,
  Activity,
  AlertTriangle,
  Leaf,
  Scale,
  ThermometerSun,
  Droplets,
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

// Datos simulados para los gráficos de BI y IoT
const feedOptimizationData = [
  { month: "Ene", consumoReal: 4000, consumoOptimo: 3800, desperdicio: 200 },
  { month: "Feb", consumoReal: 3000, consumoOptimo: 2900, desperdicio: 100 },
  { month: "Mar", consumoReal: 2000, consumoOptimo: 2400, desperdicio: 0 }, // Ahorro
  { month: "Abr", consumoReal: 2780, consumoOptimo: 2500, desperdicio: 280 },
  { month: "May", consumoReal: 1890, consumoOptimo: 1800, desperdicio: 90 },
  { month: "Jun", consumoReal: 2390, consumoOptimo: 2300, desperdicio: 90 },
];

const sensorCorrelationData = [
  { time: "08:00", temp: 18, growthRate: 85 },
  { time: "10:00", temp: 22, growthRate: 90 },
  { time: "12:00", temp: 28, growthRate: 75 }, // Calor afecta crecimiento
  { time: "14:00", temp: 32, growthRate: 60 },
  { time: "16:00", temp: 30, growthRate: 70 },
  { time: "18:00", temp: 24, growthRate: 88 },
];

export default function AiPredictionPage() {
  // Simulamos obtener los lotes activos para predecir su rendimiento
  const { data: lotes, isLoading } = useQuery({
    queryKey: ["/api/lotes"],
    // En un caso real, esto llamaría a tu API existente
    // queryFn: async () => (await fetch("/api/lotes")).json()
  });

  // Función simulada de algoritmo predictivo (Mock)
  const getPrediction = (loteName: string) => {
    // Esto simula un cálculo complejo de ML
    const score = Math.floor(Math.random() * (100 - 70) + 70);
    let action = "Mantener dieta actual";
    let status = "success";

    if (score < 80) {
      action = "Aumentar proteína 5%";
      status = "warning";
    }
    if (score > 95) {
      action = "Lista para sacrificio";
      status = "default";
    }

    return { score, action, status };
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BrainCircuit className="h-8 w-8 text-primary" />
          Inteligencia Artificial y Machine Learning
        </h1>
        <p className="text-muted-foreground">
          Algoritmos predictivos y análisis de datos para la toma de decisiones
          estratégicas.
        </p>
      </div>

      {/* KPI Cards (Business Intelligence) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Eficiencia Global
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.2%</div>
            <p className="text-xs text-muted-foreground">
              +2.1% respecto al mes anterior
            </p>
            <Progress value={94} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Predicción Calidad
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Bellota 100%</div>
            <p className="text-xs text-muted-foreground">
              Estimación basada en datos actuales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ahorro Piensos
            </CardTitle>
            <Leaf className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,240 kg</div>
            <p className="text-xs text-muted-foreground">
              Optimizado por algoritmos ML
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Alertas Predictivas
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 Riesgos</div>
            <p className="text-xs text-muted-foreground">
              Detectados para próxima semana
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="predictions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="predictions">Algoritmos Predictivos</TabsTrigger>
          <TabsTrigger value="iot">Análisis IoT & Patrones</TabsTrigger>
          <TabsTrigger value="bi">Business Intelligence</TabsTrigger>
        </TabsList>

        {/* 1. Algoritmos Predictivos */}
        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estimación de Rendimiento por Lote</CardTitle>
              <CardDescription>
                El modelo de IA analiza la genética, alimentación y clima para
                predecir la calidad final.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { id: "L-2024-001", stage: "Engorde", animals: 45 },
                  { id: "L-2024-003", stage: "Montanera", animals: 30 },
                  { id: "L-2024-005", stage: "Cría", animals: 120 },
                ].map((lote) => {
                  const prediction = getPrediction(lote.id);
                  return (
                    <div
                      key={lote.id}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <p className="font-medium leading-none">
                          {lote.id} ({lote.stage})
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lote.animals} animales
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            Calidad Proyectada:
                          </span>
                          <Badge
                            variant={
                              prediction.score > 90 ? "default" : "secondary"
                            }
                          >
                            {prediction.score}/100
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">
                            Acción sugerida IA:
                          </span>
                          <span
                            className={`font-semibold ${prediction.status === "warning" ? "text-yellow-600" : "text-green-600"}`}
                          >
                            {prediction.action}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <BrainCircuit className="h-4 w-4 text-blue-600" />
              <AlertTitle>Recomendación de Curación</AlertTitle>
              <AlertDescription>
                Basado en la humedad media de octubre, se sugiere aumentar el
                tiempo de secadero en 12 días para el Lote L-2023-089 para
                alcanzar la textura óptima.
              </AlertDescription>
            </Alert>
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
              <Scale className="h-4 w-4 text-green-600" />
              <AlertTitle>Optimización de Peso</AlertTitle>
              <AlertDescription>
                El ritmo de engorde actual proyecta que el 95% de los animales
                alcanzarán el peso objetivo 5 días antes de lo previsto.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>

        {/* 2. Análisis IoT */}
        <TabsContent value="iot" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  Correlación Temperatura vs Tasa Crecimiento
                </CardTitle>
                <CardDescription>
                  Detección de estrés térmico en tiempo real
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sensorCorrelationData}>
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
                      name="Tasa Crecimiento (%)"
                      stroke="#8884d8"
                      fillOpacity={1}
                      fill="url(#colorGrowth)"
                    />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      name="Temperatura (ºC)"
                      stroke="#ff7300"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análisis de Uso de la Dehesa</CardTitle>
                <CardDescription>
                  Mapas de calor de movimiento GPS (Simulado)
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">
                    Mapa de calor geoespacial
                  </p>
                  <p className="text-sm">
                    El sistema ha detectado que la zona Norte (Sector 4) está
                    infrautilizada.
                    <br />
                    <span className="font-semibold text-primary">
                      Acción: Mover abrevaderos al Sector 4.
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 3. Business Intelligence */}
        <TabsContent value="bi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimización de Recursos (Piensos)</CardTitle>
              <CardDescription>
                Comparativa Consumo Real vs Modelo Óptimo IA
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feedOptimizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="consumoReal"
                    name="Consumo Real (kg)"
                    fill="#94a3b8"
                  />
                  <Bar
                    dataKey="consumoOptimo"
                    name="Modelo IA Óptimo (kg)"
                    fill="#16a34a"
                  />
                  <Line
                    type="monotone"
                    dataKey="desperdicio"
                    name="Desviación/Desperdicio"
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
