import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SensorModalProps {
  isOpen: boolean;
  onClose: () => void;
  zoneId: string;
}

export function SensorModal({ isOpen, onClose, zoneId }: SensorModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    sensorType: "",
    unit: "",
    validationMin: "",
    validationMax: "",
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sensors", {
        ...data,
        zoneId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones", zoneId, "sensors"] });
      toast({
        title: "Sensor creado",
        description: "El sensor ha sido configurado correctamente",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el sensor",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      sensorType: "",
      unit: "",
      validationMin: "",
      validationMax: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: any = {
      name: formData.name,
      sensorType: formData.sensorType,
    };

    if (formData.sensorType === 'custom') {
      data.unit = formData.unit;
      if (formData.validationMin) data.validationMin = parseFloat(formData.validationMin);
      if (formData.validationMax) data.validationMax = parseFloat(formData.validationMax);
    }

    mutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" data-testid="modal-sensor">
        <DialogHeader>
          <DialogTitle>Añadir Sensor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sensor-name">Nombre del sensor *</Label>
            <Input
              id="sensor-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Temperatura ambiente"
              required
              data-testid="input-sensor-name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sensor-type">Tipo de sensor *</Label>
            <Select 
              value={formData.sensorType} 
              onValueChange={(value) => setFormData({ ...formData, sensorType: value })}
              required
            >
              <SelectTrigger data-testid="select-sensor-type">
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="temperature">Temperatura</SelectItem>
                <SelectItem value="humidity">Humedad</SelectItem>
                <SelectItem value="location">Ubicación</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.sensorType === 'custom' && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/10">
              <div className="space-y-2">
                <Label htmlFor="sensor-unit">Unidad</Label>
                <Input
                  id="sensor-unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="m/s, ppm, etc."
                  data-testid="input-sensor-unit"
                />
              </div>
              <div className="space-y-2">
                <Label>Rango de validación</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.validationMin}
                    onChange={(e) => setFormData({ ...formData, validationMin: e.target.value })}
                    placeholder="Mín"
                    data-testid="input-sensor-min"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.validationMax}
                    onChange={(e) => setFormData({ ...formData, validationMax: e.target.value })}
                    placeholder="Máx"
                    data-testid="input-sensor-max"
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending}
              className="flex-1"
              data-testid="button-create-sensor"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Sensor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
