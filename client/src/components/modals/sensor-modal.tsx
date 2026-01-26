import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      queryClient.invalidateQueries({
        queryKey: ["/api/zones", zoneId, "sensors"],
      });
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
      unit: formData.unit || undefined,
      validationMin: formData.validationMin
        ? parseFloat(formData.validationMin)
        : null,
      validationMax: formData.validationMax
        ? parseFloat(formData.validationMax)
        : null,
    };

    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Sensor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={formData.sensorType}
              onValueChange={(v) => setFormData({ ...formData, sensorType: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="temperature">Temperatura</SelectItem>
                <SelectItem value="humidity">Humedad</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label className="font-semibold">Umbrales de Alerta</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Mínimo</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.validationMin}
                  onChange={(e) =>
                    setFormData({ ...formData, validationMin: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Máximo</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.validationMax}
                  onChange={(e) =>
                    setFormData({ ...formData, validationMax: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1"
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Crear
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
