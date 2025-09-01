import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FlaskConical } from "lucide-react";
import type { Sensor } from "@shared/schema";

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensor?: Sensor | null;
  zoneSensors: Sensor[];
}

export function SimulatorModal({ isOpen, onClose, sensor, zoneSensors }: SimulatorModalProps) {
  const [formData, setFormData] = useState({
    sensorId: "",
    value: "",
    mode: "single",
    interval: "30",
    duration: "5",
    customDateTime: "",
    useCustomDateTime: false,
    markAsSimulated: true,
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/sensors/${data.sensorId}/simulate`, {
        value: parseFloat(data.value),
        mode: data.mode,
        interval: data.mode === 'burst' ? parseInt(data.interval) : undefined,
        duration: data.mode === 'burst' ? parseInt(data.duration) : undefined,
        customTimestamp: data.useCustomDateTime && data.customDateTime ? new Date(data.customDateTime).toISOString() : undefined,
      });
      return res.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensors"] });
      toast({
        title: "Simulación completada",
        description: response.message || "Lecturas simuladas creadas correctamente",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error en simulación",
        description: error.message || "No se pudieron crear las lecturas",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      sensorId: sensor?.id || "",
      value: "",
      mode: "single",
      interval: "30",
      duration: "5",
      customDateTime: "",
      useCustomDateTime: false,
      markAsSimulated: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sensorId || !formData.value) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos requeridos",
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

  // Set sensor when modal opens
  useState(() => {
    if (isOpen && sensor) {
      setFormData(prev => ({ ...prev, sensorId: sensor.id }));
    }
  });

  const selectedSensor = zoneSensors.find(s => s.id === formData.sensorId);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" data-testid="modal-simulator">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Simular Lecturas
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sensor-select">Sensor</Label>
            <Select 
              value={formData.sensorId} 
              onValueChange={(value) => setFormData({ ...formData, sensorId: value })}
            >
              <SelectTrigger data-testid="select-simulator-sensor">
                <SelectValue placeholder="Seleccionar sensor..." />
              </SelectTrigger>
              <SelectContent>
                {zoneSensors.map((sensor) => (
                  <SelectItem key={sensor.id} value={sensor.id}>
                    {sensor.deviceId} - {sensor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sensor-value">
              Valor {selectedSensor?.unit && `(${selectedSensor.unit})`}
            </Label>
            <Input
              id="sensor-value"
              type="number"
              step="0.1"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="22.5"
              required
              data-testid="input-simulator-value"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="simulation-mode">Modo</Label>
            <Select 
              value={formData.mode} 
              onValueChange={(value) => setFormData({ ...formData, mode: value })}
            >
              <SelectTrigger data-testid="select-simulation-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Lectura única</SelectItem>
                <SelectItem value="burst">Ráfaga de lecturas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.mode === 'burst' && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/10">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="interval">Intervalo (s)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="1"
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                    placeholder="30"
                    data-testid="input-simulator-interval"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duración (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="5"
                    data-testid="input-simulator-duration"
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-custom-datetime"
                checked={formData.useCustomDateTime}
                onCheckedChange={(checked) => setFormData({ ...formData, useCustomDateTime: !!checked })}
                data-testid="checkbox-use-custom-datetime"
              />
              <Label htmlFor="use-custom-datetime" className="text-sm">
                Usar fecha y hora específica
              </Label>
            </div>
            
            {formData.useCustomDateTime && (
              <div className="space-y-2">
                <Label htmlFor="custom-datetime">Fecha y hora</Label>
                <Input
                  id="custom-datetime"
                  type="datetime-local"
                  value={formData.customDateTime}
                  onChange={(e) => setFormData({ ...formData, customDateTime: e.target.value })}
                  data-testid="input-custom-datetime"
                />
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mark-simulated"
                checked={formData.markAsSimulated}
                onCheckedChange={(checked) => setFormData({ ...formData, markAsSimulated: !!checked })}
                data-testid="checkbox-mark-simulated"
              />
              <Label htmlFor="mark-simulated" className="text-sm">
                Marcar como datos simulados
              </Label>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending}
              className="flex-1"
              data-testid="button-simulate"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FlaskConical className="h-4 w-4 mr-1" />
              Simular
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
