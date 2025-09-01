import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, AlertTriangle, QrCode } from "lucide-react";
import type { Lote, Zone } from "@shared/schema";
import { format } from "date-fns";

interface MoveToZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  lote: Lote | null;
}

const STAGES = [
  { value: 'cria', label: 'Cría' },
  { value: 'engorde', label: 'Engorde' },
  { value: 'matadero', label: 'Matadero' },
  { value: 'secadero', label: 'Secadero' },
  { value: 'distribucion', label: 'Distribución' }
];

const PIECE_TYPES = [
  { value: 'jamon', label: 'Jamón' },
  { value: 'paleta', label: 'Paleta' },
  { value: 'lomo', label: 'Lomo' },
  { value: 'chorizo', label: 'Chorizo' },
  { value: 'salchichon', label: 'Salchichón' },
  { value: 'morcilla', label: 'Morcilla' },
  { value: 'otros', label: 'Otros' }
];

interface Sublote {
  piece: string;
  count: number;
}

export function MoveToZoneModal({ isOpen, onClose, lote }: MoveToZoneModalProps) {
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [entryDateTime, setEntryDateTime] = useState("");
  const [sublotes, setSublotes] = useState<Sublote[]>([]);
  const [newSubloteType, setNewSubloteType] = useState("");
  const [newSubloteCount, setNewSubloteCount] = useState("");
  const [generateQrSnapshot, setGenerateQrSnapshot] = useState(false);
  const { toast } = useToast();

  // Determine current stage of the lote
  const { data: currentStay } = useQuery({
    queryKey: ["/api/lotes", lote?.id, "current-stay"],
    enabled: !!lote?.id,
    queryFn: async () => {
      if (!lote?.id) return null;
      const res = await apiRequest("GET", `/api/lotes/${lote.id}/stays/current`);
      return res.json();
    }
  });

  const isMovingToSecadero = selectedStage === 'secadero' && currentStay?.zone?.stage === 'matadero';
  const isMovingToDistribucion = selectedStage === 'distribucion';

  // Get zones for selected stage
  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ["/api/zones", { stage: selectedStage }],
    enabled: !!selectedStage,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/zones?stage=${selectedStage}`);
      return res.json();
    }
  });

  useEffect(() => {
    if (isOpen) {
      // Set default entry time to now
      const now = new Date();
      setEntryDateTime(format(now, "yyyy-MM-dd'T'HH:mm"));
      setSelectedStage("");
      setSelectedZone("");
      setSublotes([]);
      setNewSubloteType("");
      setNewSubloteCount("");
      setGenerateQrSnapshot(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // Reset zone selection when stage changes
    setSelectedZone("");
  }, [selectedStage]);

  const addSublote = () => {
    if (!newSubloteType || !newSubloteCount || parseInt(newSubloteCount) <= 0) return;
    
    const existingIndex = sublotes.findIndex(s => s.piece === newSubloteType);
    if (existingIndex >= 0) {
      // Update existing
      const updated = [...sublotes];
      updated[existingIndex].count = parseInt(newSubloteCount);
      setSublotes(updated);
    } else {
      // Add new
      setSublotes([...sublotes, { piece: newSubloteType, count: parseInt(newSubloteCount) }]);
    }
    
    setNewSubloteType("");
    setNewSubloteCount("");
  };

  const removeSublote = (piece: string) => {
    setSublotes(sublotes.filter(s => s.piece !== piece));
  };

  const totalSubloteCount = sublotes.reduce((total, s) => total + s.count, 0);

  const moveMutation = useMutation({
    mutationFn: async () => {
      if (!lote || !selectedZone || !entryDateTime) return;
      
      const payload: any = {
        zoneId: selectedZone,
        entryTime: new Date(entryDateTime).toISOString()
      };

      // Add sublote data if moving to secadero
      if (isMovingToSecadero && sublotes.length > 0) {
        payload.createSublotes = true;
        payload.sublotes = sublotes;
      }
      
      // Add QR snapshot generation if moving to distribución
      if (isMovingToDistribucion && generateQrSnapshot) {
        payload.generateQrSnapshot = true;
      }
      
      const res = await apiRequest("POST", `/api/lotes/${lote.id}/move`, payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracking/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      if (data.qrSnapshot) {
        toast({
          title: "Movimiento completado y QR generado",
          description: (
            <div>
              <p>El lote {lote?.identification} ha sido asignado correctamente.</p>
              <a 
                href={data.qrSnapshot.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                Ver/Descargar código QR
              </a>
            </div>
          ),
        });
      } else {
        toast({
          title: "Lote asignado",
          description: `El lote ${lote?.identification} ha sido asignado correctamente`,
        });
      }
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo asignar el lote",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone || !entryDateTime) return;
    
    // Validate sublotes if moving to secadero
    if (isMovingToSecadero && sublotes.length === 0) {
      toast({
        title: "Sublotes requeridos",
        description: "Debe especificar al menos un tipo de pieza para el secadero",
        variant: "destructive",
      });
      return;
    }
    
    moveMutation.mutate();
  };

  if (!lote) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isMovingToSecadero ? 'sm:max-w-[600px]' : 'sm:max-w-[425px]'} max-h-[90vh] overflow-y-auto`} data-testid="modal-move-to-zone">
        <DialogHeader>
          <DialogTitle>Asignar Lote a Zona</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Lote</Label>
            <div className="p-2 bg-muted rounded-lg">
              <p className="font-medium">{lote.identification}</p>
              <p className="text-sm text-muted-foreground">
                {lote.initialAnimals} animales
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Etapa *</Label>
            <Select 
              value={selectedStage} 
              onValueChange={setSelectedStage}
              required
            >
              <SelectTrigger data-testid="select-stage">
                <SelectValue placeholder="Seleccionar etapa..." />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map(stage => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zone">Zona *</Label>
            <Select 
              value={selectedZone} 
              onValueChange={setSelectedZone}
              disabled={!selectedStage}
              required
            >
              <SelectTrigger data-testid="select-zone">
                <SelectValue placeholder={
                  selectedStage 
                    ? zones.length === 0 
                      ? "No hay zonas disponibles" 
                      : "Seleccionar zona..." 
                    : "Primero selecciona una etapa"
                } />
              </SelectTrigger>
              <SelectContent>
                {zones.map(zone => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entryDateTime">Fecha y hora de entrada *</Label>
            <Input
              id="entryDateTime"
              type="datetime-local"
              value={entryDateTime}
              onChange={(e) => setEntryDateTime(e.target.value)}
              required
              data-testid="input-entry-datetime"
            />
          </div>

          {/* QR Snapshot Generation for Distribución */}
          {isMovingToDistribucion && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="generateQrSnapshot"
                  checked={generateQrSnapshot}
                  onChange={(e) => setGenerateQrSnapshot(e.target.checked)}
                  className="h-4 w-4 text-primary"
                  data-testid="checkbox-generate-qr"
                />
                <Label htmlFor="generateQrSnapshot" className="text-sm font-medium flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Generar Trazabilidad Pública (QR)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Se creará un código QR público con el historial completo del lote
              </p>
            </div>
          )}

          {/* Sublote Creation Interface */}
          {isMovingToSecadero && (
            <>
              <Separator />
              <Card className="border-orange-200 bg-orange-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    División en Piezas
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    El lote será dividido en piezas individuales para el secadero
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add New Sublote */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select value={newSubloteType} onValueChange={setNewSubloteType}>
                        <SelectTrigger className="h-8" data-testid="select-piece-type">
                          <SelectValue placeholder="Tipo de pieza" />
                        </SelectTrigger>
                        <SelectContent>
                          {PIECE_TYPES.filter(type => !sublotes.find(s => s.piece === type.value)).map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        placeholder="Cant."
                        value={newSubloteCount}
                        onChange={(e) => setNewSubloteCount(e.target.value)}
                        min="1"
                        className="h-8"
                        data-testid="input-piece-count"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addSublote}
                      disabled={!newSubloteType || !newSubloteCount || parseInt(newSubloteCount) <= 0}
                      className="h-8"
                      data-testid="button-add-sublote"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Current Sublotes */}
                  {sublotes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Piezas configuradas:</Label>
                      <div className="space-y-1">
                        {sublotes.map((sublote) => (
                          <div
                            key={sublote.piece}
                            className="flex items-center justify-between p-2 bg-background rounded-md border"
                            data-testid={`sublote-${sublote.piece}`}
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {PIECE_TYPES.find(p => p.value === sublote.piece)?.label || sublote.piece}
                              </Badge>
                              <span className="text-sm font-medium">{sublote.count} unidades</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSublote(sublote.piece)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              data-testid={`button-remove-sublote-${sublote.piece}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total: {totalSubloteCount} piezas
                      </div>
                    </div>
                  )}

                  {sublotes.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                      Añade al menos un tipo de pieza para continuar
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

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
              disabled={moveMutation.isPending || !selectedZone || !entryDateTime || (isMovingToSecadero && sublotes.length === 0)}
              className="flex-1"
              data-testid="button-assign-lote"
            >
              {moveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isMovingToSecadero ? 'Crear Sublotes' : 'Asignar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}