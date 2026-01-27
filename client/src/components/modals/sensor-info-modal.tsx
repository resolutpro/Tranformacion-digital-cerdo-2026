import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Eye, 
  EyeOff, 
  Save, 
  Loader2 
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

  const [mqttData, setMqttData] = useState({
    mqttHost: "",
    mqttPort: "8883",
    ttnTopic: "",
    jsonFields: "",
    mqttEnabled: true
  });

  useEffect(() => {
    if (sensor) {
      setMqttData({
        mqttHost: sensor.mqttHost || "eu1.cloud.thethings.network",
        mqttPort: sensor.mqttPort?.toString() || "8883",
        ttnTopic: sensor.ttnTopic || "",
        jsonFields: sensor.jsonFields || "",
        mqttEnabled: sensor.mqttEnabled ?? true
      });
    }
  }, [sensor, isOpen]);

  const updateMqttMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/sensors/${sensor?.id}/mqtt-config`, {
        ...data,
        mqttPort: parseInt(data.mqttPort)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({ title: "Configuración actualizada", description: "Los datos MQTT se han guardado correctamente" });
    }
  });

  const rotateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/sensors/${sensor?.id}/rotate-credentials`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({ title: "Credenciales rotadas", description: "Se han generado nuevas credenciales MQTT" });
    }
  });

  if (!sensor) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: `${label} copiado al portapapeles` });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Configuración y Estado: {sensor.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4 border p-4 rounded-lg bg-muted/5">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Conexión de Red (TTN / MQTT)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Host Broker</Label>
                <Input 
                  value={mqttData.mqttHost} 
                  onChange={e => setMqttData({...mqttData, mqttHost: e.target.value})}
                  placeholder="eu1.cloud.thethings.network" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Puerto</Label>
                <Input 
                  type="number" 
                  value={mqttData.mqttPort} 
                  onChange={e => setMqttData({...mqttData, mqttPort: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Topic de Suscripción (Uplink)</Label>
              <Input 
                value={mqttData.ttnTopic} 
                onChange={e => setMqttData({...mqttData, ttnTopic: e.target.value})}
                placeholder="v3/app-id@ttn/devices/dev-id/up" 
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Campo JSON del valor (ej: temperature)</Label>
              <Input 
                value={mqttData.jsonFields} 
                onChange={e => setMqttData({...mqttData, jsonFields: e.target.value})}
                placeholder="decoded_payload.temperature" 
              />
            </div>
            <Button 
              className="w-full" 
              size="sm"
              disabled={updateMqttMutation.isPending}
              onClick={() => updateMqttMutation.mutate(mqttData)}
            >
              {updateMqttMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar Configuración MQTT
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Key className="h-4 w-4" /> Credenciales Locales</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowCredentials(!showCredentials)}>
                {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="bg-muted p-3 rounded text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usuario:</span>
                <span className="flex items-center gap-2">
                  {showCredentials ? sensor.mqttUsername : "••••••••"}
                  {showCredentials && <Copy className="h-3 w-3 cursor-pointer" onClick={() => copyToClipboard(sensor.mqttUsername!, "Usuario")} />}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contraseña:</span>
                <span className="flex items-center gap-2">
                  {showCredentials ? sensor.mqttPassword : "••••••••"}
                  {showCredentials && <Copy className="h-3 w-3 cursor-pointer" onClick={() => copyToClipboard(sensor.mqttPassword!, "Contraseña")} />}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => rotateMutation.mutate()}>
              <RotateCcw className="h-3 w-3 mr-2" /> Rotar Credenciales
            </Button>
          </div>

          <Separator />

          {latestReading && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
              <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Última actividad</p>
              <div className="flex justify-between items-end">
                <div className="text-2xl font-bold">
                  {Number(latestReading.value).toFixed(1)} {sensor.unit}
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="mb-1">{latestReading.isSimulated ? "Simulado" : "Dato Real"}</Badge>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(latestReading.timestamp), { addSuffix: true, locale: es })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}