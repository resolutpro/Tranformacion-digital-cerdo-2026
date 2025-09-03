import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ZoneMovementPage() {
  const [token, setToken] = useState<string>("");
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");
  const [entryTime, setEntryTime] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    }
    
    // Set current time as default
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEntryTime(localDateTime);
  }, []);

  const { data: zoneData, isLoading: isLoadingZone } = useQuery({
    queryKey: ["/api/zone-qr", token],
    queryFn: async () => {
      const res = await fetch(`/api/zone-qr/${token}?organizationId=dummy`);
      if (!res.ok) {
        throw new Error('Token de QR no válido o expirado');
      }
      return res.json();
    },
    enabled: !!token,
    retry: false
  });

  const moveLotemutation = useMutation({
    mutationFn: async ({ loteId, entryTime }: { loteId: string; entryTime: string }) => {
      const res = await fetch(`/api/zone-qr/${token}/move-lote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loteId,
          entryTime,
          organizationId: zoneData?.zone.organizationId
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al mover lote');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lote movido exitosamente",
        description: data.message,
      });
      setSelectedLoteId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error al mover lote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoteId || !entryTime) return;
    
    moveLotemutation.mutate({ loteId: selectedLoteId, entryTime });
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
              No se encontró un token válido en la URL. Por favor, escanea el código QR nuevamente.
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
            <p className="text-muted-foreground">Cargando información de la zona...</p>
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
              No se pudo cargar la información de la zona. El código QR puede estar expirado o ser inválido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { zone, availableLotes } = zoneData;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              Movimiento de Lotes
            </CardTitle>
            <div className="text-center space-y-2">
              <div className="bg-primary/10 rounded-lg p-4">
                <h2 className="text-xl font-semibold text-primary">{zone.name}</h2>
                <p className="text-sm text-muted-foreground capitalize">Etapa: {zone.stage}</p>
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
                  No hay lotes disponibles para mover a esta zona en este momento.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="lote">Lote disponible *</Label>
                  <Select value={selectedLoteId} onValueChange={setSelectedLoteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un lote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLotes.map((lote: any) => (
                        <SelectItem key={lote.id} value={lote.id}>
                          {lote.identification} - {lote.quantity} unidades
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

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    disabled={!selectedLoteId || !entryTime || moveLotemutation.isPending}
                    className="flex-1"
                  >
                    {moveLotemutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              <p className="font-medium text-green-800">¡Lote movido exitosamente!</p>
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