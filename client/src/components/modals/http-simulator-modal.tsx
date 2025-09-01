import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FlaskConical, 
  Loader2, 
  Zap, 
  BarChart3,
  Copy,
  Play
} from "lucide-react";
import type { Sensor } from "@shared/schema";

interface HttpSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensor: Sensor | null;
  allSensors: Sensor[];
}

export function HttpSimulatorModal({ isOpen, onClose, sensor, allSensors }: HttpSimulatorModalProps) {
  const [formData, setFormData] = useState({
    sensorId: sensor?.id || "",
    mode: "single",
    value: "",
    minValue: "",
    maxValue: "",
    interval: "30",
    duration: "5",
    burstCount: "10",
    useRealtime: false,
    addNoise: true,
    markAsSimulated: true,
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/sensors/${data.sensorId}/simulate`, {
        mode: data.mode,
        value: data.mode === 'range' ? undefined : parseFloat(data.value),
        minValue: data.mode === 'range' ? parseFloat(data.minValue) : undefined,
        maxValue: data.mode === 'range' ? parseFloat(data.maxValue) : undefined,
        interval: data.mode === 'burst' ? parseInt(data.interval) : undefined,
        duration: data.mode === 'burst' ? parseInt(data.duration) : undefined,
        count: data.mode === 'burst' ? parseInt(data.burstCount) : undefined,
        addNoise: data.addNoise,
        markAsSimulated: data.markAsSimulated,
        useRealtime: data.useRealtime
      });
      return res.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({
        title: "Simulación HTTP completada",
        description: response.message || "Lecturas HTTP generadas correctamente",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error en simulación HTTP",
        description: error.message || "No se pudieron generar las lecturas HTTP",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      sensorId: sensor?.id || "",
      mode: "single",
      value: "",
      minValue: "",
      maxValue: "",
      interval: "30",
      duration: "5",
      burstCount: "10",
      useRealtime: false,
      addNoise: true,
      markAsSimulated: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sensorId) {
      toast({
        title: "Sensor requerido",
        description: "Por favor selecciona un sensor",
        variant: "destructive",
      });
      return;
    }

    if (formData.mode === 'single' && !formData.value) {
      toast({
        title: "Valor requerido",
        description: "Por favor introduce un valor para simular",
        variant: "destructive",
      });
      return;
    }

    if (formData.mode === 'range' && (!formData.minValue || !formData.maxValue)) {
      toast({
        title: "Rango requerido",
        description: "Por favor introduce valores mínimo y máximo",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate(formData);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const selectedSensor = allSensors.find(s => s.id === formData.sensorId);

  const generateSampleRequest = () => {
    if (!selectedSensor) return "";
    
    const payload = {
      deviceId: selectedSensor.deviceId,
      timestamp: new Date().toISOString(),
      value: formData.mode === 'range' 
        ? Math.random() * (parseFloat(formData.maxValue || "25") - parseFloat(formData.minValue || "20")) + parseFloat(formData.minValue || "20")
        : parseFloat(formData.value || "22.5")
    };
    
    return `curl -X POST "http://localhost:5000/api/sensors/${selectedSensor.id}/reading" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="modal-http-simulator">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
            Simulador HTTP de Sensores
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sensor Selection */}
          <div className="space-y-2">
            <Label htmlFor="sensor-select">Sensor *</Label>
            <Select value={formData.sensorId} onValueChange={(value) => setFormData({ ...formData, sensorId: value })}>
              <SelectTrigger data-testid="select-simulator-sensor">
                <SelectValue placeholder="Selecciona un sensor" />
              </SelectTrigger>
              <SelectContent>
                {allSensors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.sensorType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSensor && (
              <p className="text-xs text-muted-foreground">
                Device ID: {selectedSensor.deviceId}
              </p>
            )}
          </div>

          {/* Simulation Mode */}
          <div className="space-y-2">
            <Label htmlFor="mode-select">Modo de Simulación *</Label>
            <Select value={formData.mode} onValueChange={(value) => setFormData({ ...formData, mode: value })}>
              <SelectTrigger data-testid="select-simulation-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Valor único</SelectItem>
                <SelectItem value="range">Rango aleatorio</SelectItem>
                <SelectItem value="burst">Ráfaga temporal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Single Value Mode */}
          {formData.mode === 'single' && (
            <div className="space-y-2">
              <Label htmlFor="single-value">Valor a simular *</Label>
              <Input
                id="single-value"
                type="number"
                step="0.1"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Ej: 22.5"
                data-testid="input-single-value"
              />
            </div>
          )}

          {/* Range Mode */}
          {formData.mode === 'range' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-value">Valor mínimo *</Label>
                <Input
                  id="min-value"
                  type="number"
                  step="0.1"
                  value={formData.minValue}
                  onChange={(e) => setFormData({ ...formData, minValue: e.target.value })}
                  placeholder="Ej: 20"
                  data-testid="input-min-value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-value">Valor máximo *</Label>
                <Input
                  id="max-value"
                  type="number"
                  step="0.1"
                  value={formData.maxValue}
                  onChange={(e) => setFormData({ ...formData, maxValue: e.target.value })}
                  placeholder="Ej: 25"
                  data-testid="input-max-value"
                />
              </div>
            </div>
          )}

          {/* Burst Mode */}
          {formData.mode === 'burst' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="burst-value">Valor base *</Label>
                  <Input
                    id="burst-value"
                    type="number"
                    step="0.1"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="Ej: 22.5"
                    data-testid="input-burst-value"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="burst-count">Número de lecturas</Label>
                  <Input
                    id="burst-count"
                    type="number"
                    value={formData.burstCount}
                    onChange={(e) => setFormData({ ...formData, burstCount: e.target.value })}
                    placeholder="10"
                    data-testid="input-burst-count"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interval">Intervalo (segundos)</Label>
                  <Input
                    id="interval"
                    type="number"
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                    placeholder="30"
                    data-testid="input-interval"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duración (minutos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="5"
                    data-testid="input-duration"
                  />
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="add-noise" className="text-sm">Añadir variación natural</Label>
              <Switch
                id="add-noise"
                checked={formData.addNoise}
                onCheckedChange={(checked) => setFormData({ ...formData, addNoise: checked })}
                data-testid="switch-add-noise"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="mark-simulated" className="text-sm">Marcar como simulado</Label>
              <Switch
                id="mark-simulated"
                checked={formData.markAsSimulated}
                onCheckedChange={(checked) => setFormData({ ...formData, markAsSimulated: checked })}
                data-testid="switch-mark-simulated"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="use-realtime" className="text-sm">Usar timestamps en tiempo real</Label>
              <Switch
                id="use-realtime"
                checked={formData.useRealtime}
                onCheckedChange={(checked) => setFormData({ ...formData, useRealtime: checked })}
                data-testid="switch-use-realtime"
              />
            </div>
          </div>

          {/* Sample cURL Command */}
          {selectedSensor && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Comando cURL de ejemplo:</Label>
              <div className="bg-muted/30 p-3 rounded-lg">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  <code>{generateSampleRequest()}</code>
                </pre>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => {
                    navigator.clipboard.writeText(generateSampleRequest());
                    toast({
                      title: "Copiado",
                      description: "Comando cURL copiado al portapapeles",
                    });
                  }}
                  data-testid="button-copy-curl"
                >
                  <Copy className="h-3 w-3 mr-2" />
                  Copiar comando
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Submit Buttons */}
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              className="flex-1"
              data-testid="button-cancel-http-simulation"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending}
              className="flex-1"
              data-testid="button-start-http-simulation"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Play className="h-4 w-4 mr-1" />
              Iniciar Simulación HTTP
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}