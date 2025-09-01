import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, QrCode } from "lucide-react";
import type { Lote, Zone } from "@shared/schema";

interface AdvancedMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  lote: Lote | null;
  currentStage: string | null;
}

interface SubLote {
  name: string;
  pieces: number;
}

const stageOrder = ["sinUbicacion", "cria", "engorde", "matadero", "secadero", "distribucion", "finalizado"];

const stageNames: Record<string, string> = {
  sinUbicacion: "Sin Ubicación",
  cria: "Cría", 
  engorde: "Engorde",
  matadero: "Matadero",
  secadero: "Secadero", 
  distribucion: "Distribución",
  finalizado: "Finalizado"
};

export function AdvancedMoveModal({ isOpen, onClose, lote, currentStage }: AdvancedMoveModalProps) {
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [showSubLotes, setShowSubLotes] = useState(false);
  const [subLotes, setSubLotes] = useState<SubLote[]>([]);
  const [generateQR, setGenerateQR] = useState(false);
  const { toast } = useToast();

  // Get current stage index to determine allowed next stages
  const currentStageIndex = currentStage ? stageOrder.indexOf(currentStage) : 0;
  const allowedStages = stageOrder.slice(currentStageIndex + 1, currentStageIndex + 2); // Only next stage

  // Load zones for the next allowed stage
  const nextStage = allowedStages[0];
  const { data: zones } = useQuery<Zone[]>({
    queryKey: ["/api/zones", nextStage],
    queryFn: async () => {
      const res = await fetch(`/api/zones?stage=${nextStage}`);
      if (!res.ok) throw new Error('Failed to fetch zones');
      return res.json();
    },
    enabled: isOpen && !!nextStage && nextStage !== "finalizado",
  });

  // Load current stay to get exit time
  const { data: currentStay } = useQuery({
    queryKey: ["/api/lotes", lote?.id, "active-stay"],
    enabled: isOpen && !!lote && currentStage !== "sinUbicacion",
  });

  useEffect(() => {
    if (isOpen) {
      const now = new Date().toISOString().slice(0, 10); // Only date, no time
      setMoveDate(now);
      setSelectedZoneId("");
      setShowSubLotes(false);
      setSubLotes([]);
      setGenerateQR(false);
    }
  }, [isOpen]);

  const moveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/lotes/${lote?.id}/move`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tracking/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Movimiento registrado",
        description: "El lote ha sido movido correctamente",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo mover el lote",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lote) return;

    // No date validation needed per user request

    // Prepare move data
    const moveData: any = {
      entryTime: moveDate,
      exitTime: moveDate,
    };

    // Handle special transitions
    if (currentStage === "matadero" && nextStage === "secadero" && showSubLotes) {
      const validSubLotes = subLotes.filter(s => s.name.trim() && s.pieces > 0);
      if (validSubLotes.length === 0) {
        toast({
          title: "Error en sublotes",
          description: "Debe añadir al menos un sublote válido con nombre y cantidad",
          variant: "destructive",
        });
        return;
      }
      moveData.subLotes = validSubLotes;
    }

    if (currentStage === "secadero" && nextStage === "distribucion" && generateQR) {
      moveData.generateQR = true;
    }

    // Set zone or mark as finished
    if (nextStage === "finalizado") {
      moveData.zoneId = "finalizado";
    } else {
      moveData.zoneId = selectedZoneId;
    }

    moveMutation.mutate(moveData);
  };

  const addSubLote = () => {
    setSubLotes([...subLotes, { name: "", pieces: 0 }]);
  };

  const removeSubLote = (index: number) => {
    setSubLotes(subLotes.filter((_, i) => i !== index));
  };

  const updateSubLote = (index: number, field: keyof SubLote, value: string | number) => {
    const updated = [...subLotes];
    updated[index] = { ...updated[index], [field]: value };
    setSubLotes(updated);
  };

  if (!lote) return null;

  const isMataderoToSecadero = currentStage === "matadero" && nextStage === "secadero";
  const isSecaderoToDistribucion = currentStage === "secadero" && nextStage === "distribucion";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" data-testid="modal-advanced-move">
        <DialogHeader>
          <DialogTitle>
            Mover Lote: {lote.identification}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {currentStage ? `De ${stageNames[currentStage]}` : ""} → {nextStage ? stageNames[nextStage] : "Finalizado"}
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Zone Selection */}
          {nextStage && nextStage !== "finalizado" && (
            <div className="space-y-2">
              <Label htmlFor="zone">Zona de destino *</Label>
              <Select value={selectedZoneId} onValueChange={setSelectedZoneId} required>
                <SelectTrigger data-testid="select-target-zone">
                  <SelectValue placeholder="Seleccionar zona..." />
                </SelectTrigger>
                <SelectContent>
                  {zones?.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Management */}
          <div className="space-y-2">
            <Label htmlFor="moveDate">Fecha del movimiento *</Label>
            <Input
              id="moveDate"
              type="date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              required
              data-testid="input-move-date"
            />
          </div>

          {/* Sublotes Creation (Matadero → Secadero) */}
          {isMataderoToSecadero && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="enable-sublotes"
                    checked={showSubLotes}
                    onCheckedChange={(checked) => setShowSubLotes(checked as boolean)}
                    data-testid="checkbox-enable-sublotes"
                  />
                  <Label htmlFor="enable-sublotes" className="font-medium">
                    Crear sublotes (piezas)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  El número total de piezas puede ser mayor al número de animales
                </p>
              </CardHeader>
              {showSubLotes && (
                <CardContent className="space-y-3">
                  {subLotes.map((subLote, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Nombre (ej. Jamón, Paleta)"
                        value={subLote.name}
                        onChange={(e) => updateSubLote(index, "name", e.target.value)}
                        required
                        data-testid={`input-sublote-name-${index}`}
                      />
                      <Input
                        type="number"
                        min="1"
                        placeholder="Piezas"
                        value={subLote.pieces || ""}
                        onChange={(e) => updateSubLote(index, "pieces", parseInt(e.target.value) || 0)}
                        className="w-24"
                        required
                        data-testid={`input-sublote-pieces-${index}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeSubLote(index)}
                        data-testid={`button-remove-sublote-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSubLote}
                    className="w-full"
                    data-testid="button-add-sublote"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir sublote
                  </Button>
                </CardContent>
              )}
            </Card>
          )}

          {/* QR Generation (Secadero → Distribución) */}
          {isSecaderoToDistribucion && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="generate-qr"
                    checked={generateQR}
                    onCheckedChange={(checked) => setGenerateQR(checked as boolean)}
                    data-testid="checkbox-generate-qr"
                  />
                  <Label htmlFor="generate-qr" className="font-medium flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    Generar Trazabilidad Pública (QR)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-2 ml-6">
                  Se creará un código QR público para trazabilidad externa
                </p>
              </CardContent>
            </Card>
          )}

          <Separator />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={moveMutation.isPending || (!selectedZoneId && nextStage !== "finalizado")}
              className="flex-1"
              data-testid="button-confirm-move"
            >
              {moveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Movimiento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}