import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Tag, 
  Share, 
  Download, 
  Thermometer, 
  Droplets,
  Sprout,
  TrendingUp,
  Factory,
  Wind,
  Truck,
  Clock
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

interface SnapshotData {
  lote: {
    id: string;
    name: string;
    iberianPercentage?: number;
    regime?: string;
    pieceType?: string;
    parentLote?: {
      id: string;
      name: string;
    };
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
    totalAnimals?: number;
    originData?: Record<string, any>;
  };
}

const stageConfig = {
  cria: { title: "Cría", icon: Sprout, color: "bg-secondary/10 text-secondary" },
  engorde: { title: "Engorde", icon: TrendingUp, color: "bg-primary/10 text-primary" },
  matadero: { title: "Matadero", icon: Factory, color: "bg-accent/10 text-accent" },
  secadero: { title: "Secadero", icon: Wind, color: "bg-chart-3/10 text-chart-3" },
  distribucion: { title: "Distribución", icon: Truck, color: "bg-chart-4/10 text-chart-4" },
};

export default function PublicTrace() {
  const params = useParams();
  
  const { data: snapshotData, isLoading, error } = useQuery<SnapshotData>({
    queryKey: ["/api/trace", params.token],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Tag className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Cargando certificado de trazabilidad...</p>
        </div>
      </div>
    );
  }

  if (error || !snapshotData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Código QR no válido</h2>
            <p className="text-muted-foreground">
              Este código QR no es válido o ha sido revocado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalDuration = snapshotData.phases.reduce((total, phase) => total + phase.duration, 0);

  const shareUrl = () => {
    if (navigator.share) {
      navigator.share({
        title: `Certificado de Trazabilidad - ${snapshotData.lote.name}`,
        url: window.location.href,
      });
    } else {
      copyToClipboard(window.location.href);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-card border border-border rounded-full px-6 py-3 shadow-sm mb-4">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Tag className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Certificado de Trazabilidad</span>
          </div>
        </div>

        {/* Hero Section */}
        <Card className="mb-6 shadow-sm" data-testid="hero-section">
          <CardContent className="p-6 text-center">
            {/* Product Type Header */}
            {snapshotData.lote.pieceType && (
              <div className="mb-4">
                <Badge className="bg-orange-100 text-orange-700 border-orange-200 px-3 py-1">
                  Pieza Individual
                </Badge>
              </div>
            )}
            
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3" data-testid="lote-name">
              {snapshotData.lote.name}
            </h1>
            
            {/* Sublote info */}
            {snapshotData.lote.pieceType && snapshotData.lote.parentLote && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Tipo de pieza:</strong> {snapshotData.lote.pieceType}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Lote origen:</strong> {snapshotData.lote.parentLote.name}
                </p>
              </div>
            )}
            
            <div className="flex flex-wrap justify-center gap-3 mb-4">
              {snapshotData.lote.iberianPercentage && (
                <Badge className="bg-primary/10 text-primary" data-testid="iberian-percentage">
                  {snapshotData.lote.iberianPercentage}% Ibérico
                </Badge>
              )}
              {snapshotData.lote.regime && (
                <Badge className="bg-secondary/10 text-secondary" data-testid="food-regime">
                  {snapshotData.lote.regime}
                </Badge>
              )}
              {snapshotData.lote.pieceType && (
                <Badge className="bg-orange-100 text-orange-700 border-orange-200" data-testid="piece-type">
                  {snapshotData.lote.pieceType}
                </Badge>
              )}
            </div>
            <p className="text-lg text-muted-foreground" data-testid="total-duration">
              <strong>{totalDuration} días</strong> de crianza controlada
            </p>
            {snapshotData.metadata.totalAnimals && (
              <p className="text-sm text-muted-foreground mt-2">
                Originalmente de un lote de {snapshotData.metadata.totalAnimals} animales
              </p>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
              Fases de Producción
            </h2>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {snapshotData.phases.map((phase) => {
                const config = stageConfig[phase.stage as keyof typeof stageConfig];
                return (
                  <Badge 
                    key={phase.stage}
                    className={config.color}
                    data-testid={`phase-badge-${phase.stage}`}
                  >
                    {config.title} • {phase.duration} días
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Phase Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {snapshotData.phases.map((phase) => {
            const config = stageConfig[phase.stage as keyof typeof stageConfig];
            if (!config) return null;

            const Icon = config.icon;

            return (
              <Card key={phase.stage} className="shadow-sm" data-testid={`phase-card-${phase.stage}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground" data-testid={`phase-title-${phase.stage}`}>
                        Fase de {config.title}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid={`phase-zones-${phase.stage}`}>
                        {phase.zones.join(", ")} • {phase.duration} días
                      </p>
                    </div>
                  </div>
                  
                  {Object.keys(phase.metrics).length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {phase.metrics.temperature && (
                          <div className="text-center p-3 bg-muted/20 rounded-lg">
                            <div className="text-xl font-bold text-foreground flex items-center justify-center gap-1">
                              <Thermometer className="h-4 w-4" />
                              {phase.metrics.temperature.avg}°C
                            </div>
                            <div className="text-xs text-muted-foreground">Temp. media</div>
                            <div className="text-xs text-muted-foreground">
                              {phase.metrics.temperature.min}°C - {phase.metrics.temperature.max}°C
                            </div>
                          </div>
                        )}
                        {phase.metrics.humidity && (
                          <div className="text-center p-3 bg-muted/20 rounded-lg">
                            <div className="text-xl font-bold text-foreground flex items-center justify-center gap-1">
                              <Droplets className="h-4 w-4" />
                              {phase.metrics.humidity.avg}%
                            </div>
                            <div className="text-xs text-muted-foreground">Humedad media</div>
                            <div className="text-xs text-muted-foreground">
                              {phase.metrics.humidity.min}% - {phase.metrics.humidity.max}%
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Target percentage indicators */}
                      {Object.entries(phase.metrics).map(([metric, data]) => {
                        if (!data.pctInTarget) return null;
                        return (
                          <div key={metric} className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">
                                {metric === 'temperature' ? 'Temp.' : 'Humedad'} en objetivo
                              </span>
                              <span className="text-foreground font-medium">{data.pctInTarget}%</span>
                            </div>
                            <Progress value={data.pctInTarget} className="h-2" />
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="text-center p-6 bg-muted/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Sin lecturas registradas en este periodo
                      </p>
                    </div>
                  )}
                  
                  <div className="text-sm text-muted-foreground mt-4" data-testid={`phase-dates-${phase.stage}`}>
                    <strong>Desde:</strong> {format(new Date(phase.startTime), 'dd MMM yyyy', { locale: es })} <br />
                    <strong>Hasta:</strong> {phase.endTime ? 
                      format(new Date(phase.endTime), 'dd MMM yyyy', { locale: es }) : 
                      'Actualidad'
                    }
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Authenticity Section */}
        <Card className="mb-6 shadow-sm bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Certificado Verificado</h3>
            <p className="text-sm text-muted-foreground">
              Este certificado de trazabilidad ha sido generado automáticamente 
              y está respaldado por datos reales de sensores IoT y registros auditados.
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card className="shadow-sm" data-testid="certificate-footer">
          <CardContent className="p-6 text-center">
            <div className="text-sm text-muted-foreground mb-4" data-testid="generated-date">
              Certificado generado el {format(new Date(snapshotData.metadata.generatedAt), 'dd \'de\' MMMM \'de\' yyyy \'a las\' HH:mm', { locale: es })} CET
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button onClick={shareUrl} data-testid="button-share">
                <Share className="h-4 w-4 mr-2" />
                Compartir certificado
              </Button>
              <Button variant="outline" data-testid="button-download-pdf">
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Digital Twin - Sistema de Trazabilidad de Ibérico • Versión {snapshotData.metadata.version}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
