import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Split,
  QrCode,
  Plus,
  Minus,
} from "lucide-react";

interface SubLote {
  identification: string;
  quantity: number;
}

export default function ZoneMovementPage() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string>("");
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");
  const [entryTime, setEntryTime] = useState<string>("");
  const [shouldSplit, setShouldSplit] = useState<boolean>(false);
  const [sublotes, setSublotes] = useState<SubLote[]>([
    { identification: "", quantity: 1 },
  ]);
  const [shouldGenerateQr, setShouldGenerateQr] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    // Extraer token de la URL
    const pathSegments = window.location.pathname.split("/");
    const tokenFromPath = pathSegments[pathSegments.length - 1];
    if (tokenFromPath && tokenFromPath !== "zona-movimiento") {
      setToken(tokenFromPath);
    }

    // Fecha/hora local por defecto (para <input type="datetime-local">)
    const now = new Date();
    const localDateTime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
    setEntryTime(localDateTime);
  }, []);

  const { data: zoneData, isLoading: isLoadingZone } = useQuery({
    queryKey: ["/api/zone-qr", token],
    queryFn: async () => {
      const res = await fetch(`/api/zone-qr/${token}`);
      if (!res.ok) {
        throw new Error("Token de QR no válido o expirado");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const moveLotemutation = useMutation({
    mutationFn: async ({
      loteId,
      entryTime,
      validSublotes,
      generateQr,
    }: {
      loteId: string;
      entryTime: string; // viene de <input datetime-local>
      validSublotes?: SubLote[];
      generateQr?: boolean;
    }) => {
      // Normaliza a ISO completo
      const isoEntry = new Date(entryTime).toISOString();

      // Construye payload sin claves undefined
      const payload: Record<string, any> = {
        loteId,
        entryTime: isoEntry,
        ...(zoneData?.zone?.organizationId
          ? { organizationId: zoneData.zone.organizationId }
          : {}),
        ...(validSublotes && validSublotes.length > 0
          ? { sublotes: validSublotes }
          : {}),
        ...(generateQr ? { shouldGenerateQr: true } : {}),
      };

      const res = await fetch(`/api/zone-qr/${token}/move-lote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = "Error al mover lote";
        try {
          const error = await res.json();
          errorMessage = error.message || errorMessage;
        } catch (_) {
          // sin body JSON
        }
        throw new Error(errorMessage);
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lote movido exitosamente",
        description: data.message,
      });

      // Refrescar datos de la zona
      queryClient.invalidateQueries({ queryKey: ["/api/zone-qr", token] });

      setSelectedLoteId("");
      setShouldSplit(false);
      setShouldGenerateQr(false);
      setSublotes([{ identification: "", quantity: 1 }]);

      if (data.qrToken) {
        toast({
          title: "QR de trazabilidad generado",
          description: `Token público: ${data.qrToken}`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error al mover lote",
        description: error?.message ?? "Ha ocurrido un error",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoteId || !entryTime) return;

    let validSublotes: SubLote[] | undefined;

    if (shouldSplit && zoneData?.canSplit) {
      validSublotes = sublotes
        .filter((s) => s.identification && s.quantity > 0)
        .map((s) => ({
          identification: s.identification.trim(),
          quantity: Number(s.quantity),
        }));

      if (!validSublotes.length) {
        toast({
          title: "Error de validación",
          description: "Debes agregar al menos un sublote válido para dividir",
          variant: "destructive",
        });
        return;
      }

      // La suma de sublotes puede ser mayor al número de animales disponibles
    }

    moveLotemutation.mutate({
      loteId: selectedLoteId,
      entryTime,
      validSublotes,
      generateQr: shouldGenerateQr && !!zoneData?.canGenerateQr,
    });
  };

  const addSublote = () => {
    const selectedLote = availableLotes.find(
      (lote: any) => String(lote.id) === String(selectedLoteId),
    );
    const loteId = selectedLote?.identification || "LOTE";
    const subloteNumber = sublotes.length + 1;
    const newSubloteId = `${loteId}-${subloteNumber}`;
    
    setSublotes([...sublotes, { identification: newSubloteId, quantity: 1 }]);
  };

  const removeSublote = (index: number) => {
    if (sublotes.length > 1) {
      setSublotes(sublotes.filter((_, i) => i !== index));
    }
  };

  const updateSublote = (
    index: number,
    field: keyof SubLote,
    value: string | number,
  ) => {
    const newSublotes = [...sublotes];
    if (field === "quantity") {
      newSublotes[index][field] = Math.max(1, Number(value));
    } else {
      newSublotes[index][field] = (value as string) ?? "";
    }
    setSublotes(newSublotes);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              Token no válido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              No se encontró un token válido en la URL. Por favor, escanea el
              código QR nuevamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingZone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              Cargando información de la zona...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!zoneData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              No se pudo cargar la información de la zona. El código QR puede
              estar expirado o ser inválido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { zone, availableLotes, previousStage, canSplit, canGenerateQr } =
    zoneData;
  const selectedLote = availableLotes.find(
    (lote: any) => String(lote.id) === String(selectedLoteId),
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Movimiento de Lotes</CardTitle>
            <div className="text-center space-y-2">
              <div className="bg-primary/10 rounded-lg p-4">
                <h2 className="text-xl font-semibold text-primary">
                  {zone.name}
                </h2>
                <p className="text-sm text-muted-foreground capitalize">
                  Etapa: {zone.stage}
                </p>
                {previousStage && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Lotes disponibles desde: {previousStage}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Lote para Mover</CardTitle>
          </CardHeader>
          <CardContent>
            {availableLotes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {previousStage
                    ? `No hay lotes disponibles en "${previousStage}" para mover aquí`
                    : "No hay lotes disponibles para mover a esta zona en este momento"}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="lote">Lote disponible *</Label>
                  <Select
                    value={selectedLoteId}
                    onValueChange={(value) => {
                      setSelectedLoteId(value);
                      // Reset sublotes with correct naming when lote changes
                      if (value) {
                        const selectedLote = availableLotes.find(
                          (lote: any) => String(lote.id) === String(value),
                        );
                        const loteId = selectedLote?.identification || "LOTE";
                        setSublotes([{ identification: `${loteId}-1`, quantity: 1 }]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un lote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLotes.map((lote: any) => (
                        <SelectItem
                          key={String(lote.id)}
                          value={String(lote.id)}
                        >
                          {lote.identification} - {lote.quantity} unidades (
                          {lote.currentZone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="entryTime">Fecha y hora de entrada *</Label>
                  <Input
                    id="entryTime"
                    type="datetime-local"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    required
                  />
                </div>

                {/* Opciones de división matadero -> secadero */}
                {canSplit && selectedLoteId && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="shouldSplit"
                        checked={shouldSplit}
                        onCheckedChange={(checked) => setShouldSplit(!!checked)}
                      />
                      <Label
                        htmlFor="shouldSplit"
                        className="flex items-center gap-2"
                      >
                        <Split className="h-4 w-4" />
                        Dividir en sublotes (opcional)
                      </Label>
                    </div>

                    {shouldSplit && (
                      <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">
                            Sublotes a crear
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addSublote}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Agregar sublote
                          </Button>
                        </div>

                        {sublotes.map((sublote, index) => (
                          <div key={index} className="flex gap-2 items-end">
                            <div className="flex-1">
                              <Label>Identificación</Label>
                              <Input
                                placeholder="ID del sublote"
                                value={sublote.identification}
                                onChange={(e) =>
                                  updateSublote(
                                    index,
                                    "identification",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="w-24">
                              <Label>Cantidad</Label>
                              <Input
                                type="number"
                                min="1"
                                value={sublote.quantity}
                                onChange={(e) =>
                                  updateSublote(
                                    index,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            {sublotes.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeSublote(index)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}

                        {selectedLote && (
                          <div className="text-sm text-muted-foreground">
                            Total disponible: {selectedLote.quantity} unidades
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Opción QR secadero -> distribución */}
                {canGenerateQr && selectedLoteId && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="shouldGenerateQr"
                        checked={shouldGenerateQr}
                        onCheckedChange={(checked) =>
                          setShouldGenerateQr(!!checked)
                        }
                      />
                      <Label
                        htmlFor="shouldGenerateQr"
                        className="flex items-center gap-2"
                      >
                        <QrCode className="h-4 w-4" />
                        Generar QR de trazabilidad final
                      </Label>
                    </div>
                    {shouldGenerateQr && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Se generará un código QR público para que los
                          consumidores puedan ver la trazabilidad completa del
                          lote.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={
                      !selectedLoteId ||
                      !entryTime ||
                      moveLotemutation.isPending
                    }
                    className="flex-1"
                  >
                    {moveLotemutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Mover a {zone.name}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {moveLotemutation.isSuccess && (
          <Card className="border-green-200">
            <CardContent className="text-center py-6">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium text-green-800">
                ¡Lote movido exitosamente!
              </p>
              <p className="text-sm text-green-600 mt-2">
                El lote ha sido registrado en la zona {zone.name}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Sistema de Trazabilidad Ganadera
          </p>
        </div>
      </div>
    </div>
  );
}
