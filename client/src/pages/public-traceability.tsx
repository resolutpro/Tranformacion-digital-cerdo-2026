import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Thermometer, Droplets, QrCode } from "lucide-react";

const stageNames: Record<string, string> = {
  "cria": "Cría",
  "engorde": "Engorde", 
  "matadero": "Matadero",
  "secadero": "Secadero",
  "distribucion": "Distribución"
};

interface TraceabilityData {
  lote: {
    id: string;
    name: string;
    iberianPercentage?: number;
    regime?: string;
  };
  phases: Array<{
    stage: string;
    zones: string[];
    startTime: string;
    endTime?: string;
    duration: number;
    metrics: Record<string, {
      avg: number;
      min: number;
      max: number;
      pctInTarget?: number;
    }>;
  }>;
  metadata: {
    generatedAt: string;
    version: string;
  };
}

export default function PublicTraceability() {
  const { token } = useParams();
  const [data, setData] = useState<TraceabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/trace/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Código QR no válido o expirado");
        }
        return res.json();
      })
      .then((traceData) => {
        setData(traceData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <QrCode className="w-12 h-12 mx-auto text-gray-400 animate-pulse" />
          <p className="mt-4 text-gray-600">Cargando información de trazabilidad...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <QrCode className="w-12 h-12 mx-auto text-red-400" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Código QR no válido</h1>
          <p className="mt-2 text-gray-600">{error || "No se pudo obtener la información de trazabilidad"}</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <QrCode className="w-16 h-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Trazabilidad Pública</h1>
          <p className="mt-2 text-lg text-gray-600">Información completa del producto</p>
        </div>

        {/* Lote Information */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {data.lote.name}
              </Badge>
            </CardTitle>
            <CardDescription>
              Información general del lote
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.lote.iberianPercentage && (
              <div className="flex justify-between">
                <span className="font-medium">Porcentaje Ibérico:</span>
                <span>{data.lote.iberianPercentage}%</span>
              </div>
            )}
            {data.lote.regime && (
              <div className="flex justify-between">
                <span className="font-medium">Régimen Alimentario:</span>
                <span className="capitalize">{data.lote.regime}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-medium">Fecha de Generación:</span>
              <span>{formatDate(data.metadata.generatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Production Phases */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Fases de Producción</h2>
          
          {data.phases.map((phase, index) => (
            <Card key={phase.stage} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-blue-600 text-white">
                      {index + 1}
                    </Badge>
                    <span>{stageNames[phase.stage] || phase.stage}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    {phase.duration} días
                  </div>
                </CardTitle>
                <CardDescription>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {phase.zones.map((zone, zoneIdx) => (
                      <Badge key={zoneIdx} variant="secondary">
                        {zone}
                      </Badge>
                    ))}
                  </div>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Dates */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Período</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Inicio: {formatDate(phase.startTime)}</div>
                      {phase.endTime && <div>Fin: {formatDate(phase.endTime)}</div>}
                    </div>
                  </div>

                  {/* Environmental Conditions */}
                  {Object.keys(phase.metrics).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Condiciones Ambientales</h4>
                      <div className="space-y-3">
                        {Object.entries(phase.metrics).map(([sensorType, metrics]) => (
                          <div key={sensorType} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              {sensorType === 'temperature' ? (
                                <Thermometer className="w-4 h-4 text-red-500" />
                              ) : sensorType === 'humidity' ? (
                                <Droplets className="w-4 h-4 text-blue-500" />
                              ) : (
                                <div className="w-4 h-4 bg-gray-400 rounded-full" />
                              )}
                              <span className="font-medium capitalize">
                                {sensorType === 'temperature' ? 'Temperatura' : 
                                 sensorType === 'humidity' ? 'Humedad' : sensorType}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-gray-500">Promedio</div>
                                <div className="font-medium">
                                  {metrics.avg}
                                  {sensorType === 'temperature' ? '°C' : 
                                   sensorType === 'humidity' ? '%' : ''}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-500">Mínimo</div>
                                <div className="font-medium">
                                  {metrics.min}
                                  {sensorType === 'temperature' ? '°C' : 
                                   sensorType === 'humidity' ? '%' : ''}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-500">Máximo</div>
                                <div className="font-medium">
                                  {metrics.max}
                                  {sensorType === 'temperature' ? '°C' : 
                                   sensorType === 'humidity' ? '%' : ''}
                                </div>
                              </div>
                            </div>
                            {metrics.pctInTarget !== undefined && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-sm">
                                  <span className="text-gray-500">En rango objetivo: </span>
                                  <span className="font-medium text-green-600">{metrics.pctInTarget}%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <Separator className="mb-6" />
          <p className="text-sm text-gray-500">
            Sistema de Trazabilidad Digital | Generado el {formatDate(data.metadata.generatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}