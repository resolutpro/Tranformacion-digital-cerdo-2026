import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Sensor } from "@shared/schema";

export function ThresholdModal({
  isOpen,
  onClose,
  sensor,
}: {
  isOpen: boolean;
  onClose: () => void;
  sensor: Sensor | null;
}) {
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (sensor) {
      setMin(sensor.validationMin?.toString() || "");
      setMax(sensor.validationMax?.toString() || "");
    }
  }, [sensor, isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Usamos PATCH hacia la ruta general de sensores
      await apiRequest("PATCH", `/api/sensors/${sensor?.id}`, {
        validationMin: min ? min : null,
        validationMax: max ? max : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({ title: "Umbrales guardados" });
      onClose();
    },
  });

  if (!sensor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Umbrales de Alerta: {sensor.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Mínimo</Label>
            <Input
              type="number"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Máximo</Label>
            <Input
              type="number"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Guardar Umbrales"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
