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

  const getStageColors = (stage: string) => {
    const colors = {
      'cria': 'from-green-500 to-emerald-600',
      'engorde': 'from-yellow-500 to-orange-600', 
      'matadero': 'from-red-500 to-rose-600',
      'secadero': 'from-purple-500 to-indigo-600',
      'distribucion': 'from-blue-500 to-cyan-600'
    };
    return colors[stage as keyof typeof colors] || 'from-gray-500 to-slate-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-blue-100 mx-auto max-w-2xl">
            <QrCode className="w-20 h-20 mx-auto text-blue-600 mb-6" />
            <h1 className="text-4xl font-bold text-gray-900 mb-4">🥩 Trazabilidad Garantizada</h1>
            <p className="text-xl text-gray-700 leading-relaxed">
              Descubre el viaje completo de este producto ibérico desde la cría hasta tu mesa.
              Cada etapa ha sido cuidadosamente monitoreada y documentada.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Certificado
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Monitoreo 24/7
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                Trazabilidad Completa
              </span>
            </div>
          </div>
        </div>

        {/* Lote Information */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="md:col-span-2">
            <Card className="h-full bg-white/60 backdrop-blur-sm border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    🏷️
                  </div>
                  <span className="text-amber-800">
                    Lote {data.lote.name}
                  </span>
                </CardTitle>
                <CardDescription className="text-lg text-gray-600">
                  Información detallada del producto ibérico certificado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  {data.lote.iberianPercentage && (
                    <div className="bg-red-50 p-4 rounded-xl">
                      <div className="text-sm font-medium text-red-600 uppercase tracking-wide">Porcentaje Ibérico</div>
                      <div className="text-2xl font-bold text-red-800">{data.lote.iberianPercentage}%</div>
                    </div>
                  )}
                  {data.lote.regime && (
                    <div className="bg-green-50 p-4 rounded-xl">
                      <div className="text-sm font-medium text-green-600 uppercase tracking-wide">Régimen Alimentario</div>
                      <div className="text-xl font-semibold text-green-800">{data.lote.regime}</div>
                    </div>
                  )}
                </div>
                
                {/* Additional lote data */}
                {Object.keys(data.lote).filter(key => !['id', 'name', 'iberianPercentage', 'regime'].includes(key)).length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Información Adicional</h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {Object.entries(data.lote).filter(([key]) => !['id', 'name', 'iberianPercentage', 'regime'].includes(key)).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 p-3 rounded-lg">
                          <div className="text-sm font-medium text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                          <div className="text-base font-semibold text-gray-800">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card className="bg-blue-50/50 backdrop-blur-sm border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Clock className="h-5 w-5" />
                  Datos del Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-blue-600">Generado el</div>
                  <div className="text-base font-semibold text-blue-800">
                    {formatDate(data.metadata.generatedAt)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-blue-600">Versión del Sistema</div>
                  <div className="text-base font-semibold text-blue-800">{data.metadata.version}</div>
                </div>
                <div className="mt-6 p-4 bg-white/70 rounded-lg border border-blue-100">
                  <div className="text-xs text-blue-600 font-medium mb-2">TOTAL DE FASES</div>
                  <div className="text-3xl font-bold text-blue-800">{data.phases.length}</div>
                  <div className="text-sm text-blue-600">etapas monitoreadas</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quality Guarantee Section */}
        <div className="mb-12">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🛡️</span>
                </div>
                <h3 className="text-2xl font-bold text-green-800 mb-4">Garantía de Calidad</h3>
                <p className="text-lg text-green-700 max-w-3xl mx-auto leading-relaxed">
                  Este producto ha pasado por un riguroso proceso de control de calidad. Cada fase del proceso 
                  ha sido monitoreada con sensores especializados, garantizando las mejores condiciones de 
                  temperatura y humedad para obtener un producto ibérico de máxima calidad.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Production Phases */}
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🏭 Proceso de Producción</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Sigue el recorrido completo del producto a través de cada etapa del proceso productivo, 
              con monitoreo continuo de condiciones ambientales.
            </p>
          </div>
          
          {data.phases.map((phase, index) => {
            const stageEmojis = {
              'cria': '🐷',
              'engorde': '🌾', 
              'matadero': '🏭',
              'secadero': '🧂',
              'distribucion': '📦'
            };
            
            return (
              <Card key={phase.stage} className="overflow-hidden bg-white/70 backdrop-blur-sm border shadow-lg">
                <CardHeader className={`bg-gradient-to-r ${getStageColors(phase.stage)}`}>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/90 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">{stageEmojis[phase.stage as keyof typeof stageEmojis] || '⚙️'}</span>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {stageNames[phase.stage] || phase.stage}
                        </div>
                        <div className="text-sm text-white/80">
                          Etapa {index + 1} de {data.phases.length}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {phase.duration}
                      </div>
                      <div className="text-sm text-white/80">
                        días
                      </div>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <span className="text-white/90 text-sm font-medium">Instalaciones:</span>
                      {phase.zones.map((zone, zoneIdx) => (
                        <Badge key={zoneIdx} variant="secondary" className="bg-white/20 text-white border-white/30">
                          {zone}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-white/80 text-sm mt-2">
                      📅 {formatDate(phase.startTime)} 
                      {phase.endTime && ` → ${formatDate(phase.endTime)}`}
                    </div>
                  </CardDescription>
                </CardHeader>
              
              <CardContent className="pt-8">
                {Object.keys(phase.metrics).length > 0 ? (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">📊 Condiciones Ambientales Monitoreadas</h4>
                      <p className="text-sm text-gray-600">Datos recopilados durante toda la fase</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(phase.metrics).map(([metricName, metricData]) => (
                        <div key={metricName} className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-xl border shadow-sm">
                          <div className="flex items-center gap-3 mb-4">
                            {metricName === 'temperature' ? (
                              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                <Thermometer className="w-5 h-5 text-red-600" />
                              </div>
                            ) : metricName === 'humidity' ? (
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Droplets className="w-5 h-5 text-blue-600" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="text-lg">📊</span>
                              </div>
                            )}
                            <div>
                              <h5 className="font-semibold text-gray-800 capitalize">
                                {metricName === 'temperature' ? 'Temperatura' : 
                                 metricName === 'humidity' ? 'Humedad' : metricName}
                              </h5>
                              <p className="text-sm text-gray-600">
                                {metricName === 'temperature' ? 'Monitoreo térmico continuo' : 
                                 metricName === 'humidity' ? 'Control de humedad ambiental' : 'Medición de parámetros'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-800">
                                {metricData.avg.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-600 font-medium">PROMEDIO</div>
                              <div className="text-xs text-gray-500">
                                {metricName === 'temperature' ? '°C' : metricName === 'humidity' ? '%' : ''}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-semibold text-blue-600">
                                {metricData.min.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-600 font-medium">MÍNIMO</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-semibold text-red-600">
                                {metricData.max.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-600 font-medium">MÁXIMO</div>
                            </div>
                          </div>
                          
                          {metricData.pctInTarget !== undefined && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">Dentro del rango óptimo</span>
                                <span className={`text-sm font-bold ${metricData.pctInTarget >= 90 ? 'text-green-600' : metricData.pctInTarget >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {metricData.pctInTarget}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${metricData.pctInTarget >= 90 ? 'bg-green-500' : metricData.pctInTarget >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${metricData.pctInTarget}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl mb-4 block">📊</span>
                    <p>No hay datos de sensores disponibles para esta fase</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Footer */}
        <div className="mt-16 text-center">
          <Card className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200">
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <QrCode className="w-8 h-8 text-gray-600" />
                <span className="text-xl font-semibold text-gray-800">Sistema de Trazabilidad Ganadera</span>
              </div>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Este certificado de trazabilidad garantiza la autenticidad y calidad del producto. 
                Toda la información ha sido verificada y registrada automáticamente durante el proceso productivo.
              </p>
              <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-500">
                <span>🔒 Datos verificados</span>
                <span>⏱️ Tiempo real</span>
                <span>📋 Certificado oficial</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}