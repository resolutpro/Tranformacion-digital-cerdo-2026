import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Lote } from "@shared/schema";

interface LoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  lote?: Lote | null;
}

export function LoteModal({ isOpen, onClose, lote }: LoteModalProps) {
  const [formData, setFormData] = useState({
    identification: "",
    initialAnimals: "",
    finalAnimals: "",
    foodRegime: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (lote) {
      setFormData({
        identification: lote.identification,
        initialAnimals: lote.initialAnimals.toString(),
        finalAnimals: lote.finalAnimals?.toString() || "",
        foodRegime: lote.foodRegime || "",
      });
    } else {
      setFormData({
        identification: "",
        initialAnimals: "",
        finalAnimals: "",
        foodRegime: "",
      });
    }
  }, [lote, isOpen]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = lote ? `/api/lotes/${lote.id}` : "/api/lotes";
      const method = lote ? "PUT" : "POST";
      const res = await apiRequest(method, endpoint, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lotes"] });
      toast({
        title: lote ? "Lote actualizado" : "Lote creado",
        description: lote ? "El lote ha sido actualizado correctamente" : "El lote ha sido creado correctamente",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el lote",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      identification: formData.identification,
      initialAnimals: parseInt(formData.initialAnimals),
      finalAnimals: formData.finalAnimals ? parseInt(formData.finalAnimals) : undefined,
      foodRegime: formData.foodRegime || undefined,
    };

    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" data-testid="modal-lote">
        <DialogHeader>
          <DialogTitle>
            {lote ? "Editar Lote" : "Nuevo Lote"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identification">Identificación *</Label>
            <Input
              id="identification"
              value={formData.identification}
              onChange={(e) => setFormData({ ...formData, identification: e.target.value })}
              placeholder="LOTE-2024-003"
              required
              data-testid="input-lote-identification"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="initialAnimals">Nº de animales iniciales *</Label>
            <Input
              id="initialAnimals"
              type="number"
              min="1"
              value={formData.initialAnimals}
              onChange={(e) => setFormData({ ...formData, initialAnimals: e.target.value })}
              placeholder="45"
              required
              data-testid="input-lote-initial-animals"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="foodRegime">Régimen de comida</Label>
            <Select 
              value={formData.foodRegime} 
              onValueChange={(value) => setFormData({ ...formData, foodRegime: value })}
            >
              <SelectTrigger data-testid="select-lote-food-regime">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bellota">Bellota</SelectItem>
                <SelectItem value="recebo">Recebo</SelectItem>
                <SelectItem value="cebo">Cebo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="finalAnimals">Nº de animales finales</Label>
            <Input
              id="finalAnimals"
              type="number"
              min="1"
              value={formData.finalAnimals}
              onChange={(e) => setFormData({ ...formData, finalAnimals: e.target.value })}
              placeholder="45"
              data-testid="input-lote-final-animals"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending}
              className="flex-1"
              data-testid="button-save-lote"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {lote ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
