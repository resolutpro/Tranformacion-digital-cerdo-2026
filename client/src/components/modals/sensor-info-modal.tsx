import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Copy, 
  RotateCcw, 
  Trash2, 
  Key, 
  MessageSquare, 
  Wifi,
  Shield,
  Eye,
  EyeOff
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Sensor } from "@shared/schema";

interface SensorInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensor: Sensor | null;
  latestReading?: any;
}

export function SensorInfoModal({ isOpen, onClose, sensor, latestReading }: SensorInfoModalProps) {
  const [showCredentials, setShowCredentials] = useState(false);
  const { toast } = useToast();

  const rotateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/sensors/${sensor?.id}/rotate-credentials`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({
        title: "Credenciales rotadas",
        description: "Se han generado nuevas credenciales MQTT para este sensor",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron rotar las credenciales",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/sensors/${sensor?.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({
        title: "Sensor revocado",
        description: "Las credenciales del sensor han sido revocadas",
        variant: "destructive",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo revocar el sensor",
        variant: "destructive",
      });
    },
  });

  if (!sensor) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: `${label} copiado al portapapeles`,
    });
  };

  const getExamplePayload = (sensorType: string) => {
    let value;
    if (sensorType === 'temperature') {
      value = 22.5;
    } else if (sensorType === 'humidity') {
      value = 65.2;
    } else if (sensorType === 'location') {
      value = JSON.stringify({ lat: 40.4168, lon: -3.7038 });
    } else {
      value = 42.0;
    }
    
    const basePayload = {
      deviceId: sensor.deviceId,
      timestamp: new Date().toISOString(),
      value
    };
    return JSON.stringify(basePayload, null, 2);
  };

  const mqttTopic = `devices/${sensor.deviceId}/readings`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]" data-testid="modal-sensor-info">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Wifi className="h-4 w-4 text-primary" />
            </div>
            Información del Sensor: {sensor.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* Sensor Details */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Detalles del Dispositivo
            </h3>
            <div className="space-y-2 bg-muted/30 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Device ID:</span>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-background px-2 py-1 rounded">{sensor.deviceId}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(sensor.deviceId, "Device ID")}
                    data-testid="button-copy-device-id"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tipo:</span>
                <Badge variant="outline">{sensor.sensorType}</Badge>
              </div>
              {sensor.unit && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Unidad:</span>
                  <span className="text-sm">{sensor.unit}</span>
                </div>
              )}
            </div>
          </div>

          {/* MQTT Configuration */}
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2 text-sm">
              <Wifi className="h-3 w-3" />
              MQTT
            </h3>
            <div className="space-y-2 bg-muted/30 p-3 rounded-lg text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Topic:</span>
                <div className="flex items-center gap-1">
                  <code className="bg-background px-1 py-0.5 rounded">{mqttTopic}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(mqttTopic, "Topic MQTT")}
                    data-testid="button-copy-topic"
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-2 w-2" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Broker:</span>
                <span>broker.replit.dev:8883</span>
              </div>
            </div>
          </div>

          {/* MQTT Credentials */}
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2 text-sm">
              <Key className="h-3 w-3" />
              Credenciales
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCredentials(!showCredentials)}
                data-testid="button-toggle-credentials"
                className="h-6 w-6 p-0"
              >
                {showCredentials ? <EyeOff className="h-2 w-2" /> : <Eye className="h-2 w-2" />}
              </Button>
            </h3>
            <div className="space-y-2 bg-muted/30 p-3 rounded-lg text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Usuario:</span>
                <div className="flex items-center gap-1">
                  <code className="bg-background px-1 py-0.5 rounded">
                    {showCredentials ? sensor.mqttUsername : '••••••••'}
                  </code>
                  {showCredentials && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(sensor.mqttUsername || '', "Usuario MQTT")}
                      data-testid="button-copy-username"
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-2 w-2" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Contraseña:</span>
                <div className="flex items-center gap-1">
                  <code className="bg-background px-1 py-0.5 rounded">
                    {showCredentials ? sensor.mqttPassword : '••••••••'}
                  </code>
                  {showCredentials && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(sensor.mqttPassword || '', "Contraseña MQTT")}
                      data-testid="button-copy-password"
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-2 w-2" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Example Payload */}
          <div>
            <h3 className="font-medium mb-3">Payload JSON de Ejemplo</h3>
            <div className="bg-muted/30 p-4 rounded-lg">
              <pre className="text-sm overflow-x-auto">
                <code>{getExamplePayload(sensor.sensorType)}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => copyToClipboard(getExamplePayload(sensor.sensorType), "Payload de ejemplo")}
                data-testid="button-copy-payload"
              >
                <Copy className="h-3 w-3 mr-2" />
                Copiar payload
              </Button>
            </div>
          </div>

          {/* Latest Reading */}
          {latestReading && (
            <div>
              <h3 className="font-medium mb-3">Última Lectura</h3>
              <div className="bg-muted/30 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor:</span>
                  <span className="font-medium">
                    {Number(latestReading.value).toFixed(1)} {sensor.unit || ''}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-muted-foreground">Timestamp:</span>
                  <span className="text-sm">
                    {formatDistanceToNow(new Date(latestReading.timestamp), { addSuffix: true, locale: es })}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-muted-foreground">Fuente:</span>
                  <Badge variant={latestReading.isSimulated ? "outline" : "default"} 
                         className={latestReading.isSimulated ? "border-orange-300 text-orange-600" : ""}>
                    {latestReading.isSimulated ? "Simulado" : "Real"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => rotateMutation.mutate()}
                disabled={rotateMutation.isPending}
                data-testid="button-rotate-credentials"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Rotar Credenciales
              </Button>
            </div>
            <Button
              variant="destructive"
              onClick={() => revokeMutation.mutate()}
              disabled={revokeMutation.isPending}
              data-testid="button-revoke-sensor"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Revocar Sensor
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}