import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Download, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Zone } from "@shared/schema";

interface ZoneQrButtonProps {
  zone: Zone;
  className?: string;
}

export function ZoneQrButton({ zone, className }: ZoneQrButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={className}
        data-testid={`button-qr-zone-${zone.id}`}
        title="Ver QR para movimiento de lotes"
      >
        <QrCode className="h-4 w-4 text-primary" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR para movimiento de lotes</DialogTitle>
          </DialogHeader>
          <ZoneQrDisplay zone={zone} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ZoneQrDisplay({ zone }: { zone: Zone }) {
  const { data: qrData, isLoading } = useQuery({
    queryKey: ["/api/zone-qr", zone.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/zones/${zone.id}/qr`);
      return res.json();
    },
    enabled: !!zone.id
  });

  const downloadQr = () => {
    if (qrData?.qrUrl) {
      const link = document.createElement('a');
      link.download = `qr-zona-${zone.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = qrData.qrUrl;
      link.click();
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Generando QR...</p>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Error al cargar el QR</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="bg-white p-4 rounded-lg inline-block border">
          <img 
            src={qrData.qrUrl} 
            alt={`QR de zona ${zone.name}`}
            className="w-48 h-48"
          />
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-muted-foreground">
        <p><strong>Zona:</strong> {zone.name}</p>
        <p><strong>Uso:</strong> Escanea este QR para mover lotes directamente a esta zona</p>
        <p><strong>URL:</strong> <span className="font-mono text-xs break-all">{qrData.publicUrl}</span></p>
      </div>

      <div className="flex gap-2">
        <Button onClick={downloadQr} className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Descargar QR
        </Button>
        <Button 
          variant="outline" 
          onClick={() => window.open(qrData.publicUrl, '_blank')}
          className="flex-1"
        >
          Probar enlace
        </Button>
      </div>
    </div>
  );
}