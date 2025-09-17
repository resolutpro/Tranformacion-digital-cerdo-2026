import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { sensorMqttConfigSchema, type SensorMqttConfig, type Sensor } from "@shared/schema";
import { Wifi, WifiOff, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";

interface SensorMqttConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensor: Sensor | null;
}

export function SensorMqttConfigModal({ isOpen, onClose, sensor }: SensorMqttConfigModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<SensorMqttConfig>({
    resolver: zodResolver(sensorMqttConfigSchema),
    defaultValues: {
      mqttHost: sensor?.mqttHost || "eu1.cloud.thethings.network",
      mqttPort: sensor?.mqttPort || 8883,
      mqttUsername: sensor?.mqttUsername || "",
      mqttPassword: sensor?.mqttPassword || "",
      ttnTopic: sensor?.ttnTopic || "",
      jsonFields: sensor?.jsonFields || "",
      mqttEnabled: sensor?.mqttEnabled || false,
    },
  });

  const updateMqttConfigMutation = useMutation({
    mutationFn: async (config: SensorMqttConfig) => {
      const res = await fetch(`/api/sensors/${sensor?.id}/mqtt-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al actualizar configuración MQTT");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({
        title: "Configuración actualizada",
        description: "La configuración MQTT del sensor se ha actualizado correctamente",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la configuración MQTT",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (config: SensorMqttConfig) => {
      const res = await fetch(`/api/sensors/${sensor?.id}/test-mqtt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al probar conexión MQTT");
      }

      return res.json();
    },
    onSuccess: (data: any) => {
      setTestResult({ success: true, message: data.message || "Conexión exitosa" });
      toast({
        title: "Conexión exitosa",
        description: "La conexión MQTT se estableció correctamente",
      });
    },
    onError: (error: any) => {
      setTestResult({ success: false, message: error.message || "Error de conexión" });
      toast({
        title: "Error de conexión",
        description: error.message || "No se pudo conectar al broker MQTT",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SensorMqttConfig) => {
    updateMqttConfigMutation.mutate(data);
  };

  const handleTestConnection = () => {
    const formData = form.getValues();
    testConnectionMutation.mutate(formData);
  };

  if (!sensor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="mqtt-config-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Configuración MQTT - {sensor.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Activar MQTT */}
              <FormField
                control={form.control}
                name="mqttEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Activar suscripción MQTT</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Habilitar la conexión y suscripción automática al topic TTN
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-mqtt-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Separator />

              {/* Configuración del Broker MQTT */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Configuración del Broker</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mqttHost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Host *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="eu1.cloud.thethings.network"
                            {...field}
                            data-testid="input-mqtt-host"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mqttPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puerto *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={65535}
                            placeholder="8883"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 8883)}
                            data-testid="input-mqtt-port"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="mqttUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="mi-app@ttn"
                          {...field}
                          data-testid="input-mqtt-username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mqttPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña (API Key) *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="API Key de TTN"
                            {...field}
                            data-testid="input-mqtt-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Configuración de Topic y Campos */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Configuración de Datos</h3>
                
                <FormField
                  control={form.control}
                  name="ttnTopic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic/Uplink específico *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="v3/mi-app@ttn/devices/device-id/up"
                          {...field}
                          data-testid="input-ttn-topic"
                        />
                      </FormControl>
                      <div className="text-sm text-muted-foreground">
                        Ejemplo: v3/mi-app@ttn/devices/&lt;device-id&gt;/up
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jsonFields"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campo(s) JSON a leer</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="temperature,humidity,co2"
                          {...field}
                          data-testid="input-json-fields"
                        />
                      </FormControl>
                      <div className="text-sm text-muted-foreground">
                        Campos separados por comas. Ejemplo: temperature,humidity,co2
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Resultado de prueba de conexión */}
              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  testResult.success 
                    ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" 
                    : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testConnectionMutation.isPending}
                  data-testid="button-test-connection"
                  className="flex items-center gap-2"
                >
                  {testConnectionMutation.isPending ? (
                    <WifiOff className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  Probar conexión
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={updateMqttConfigMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={updateMqttConfigMutation.isPending}
                  data-testid="button-save-config"
                  className="flex items-center gap-2"
                >
                  {updateMqttConfigMutation.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : null}
                  Guardar configuración
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}