import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Download, 
  Filter, 
  Eye, 
  Link as LinkIcon, 
  RotateCcw,
  QrCode,
  Calendar,
  Plus,
  Loader2,
  Trash2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import type { QrSnapshot, Lote } from "@shared/schema";

interface QrSnapshotWithLote extends QrSnapshot {
  lote?: Lote;
}

export default function Trazabilidad() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedLoteId, setSelectedLoteId] = useState("");
  const { toast } = useToast();

  const { data: qrSnapshots = [], isLoading } = useQuery<QrSnapshotWithLote[]>({
    queryKey: ["/api/qr-snapshots"],
  });

  // Get available lotes for QR generation
  const { data: availableLotes = [] } = useQuery<Lote[]>({
    queryKey: ["/api/lotes", { status: "active" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/lotes?status=active");
      return res.json();
    }
  });

  const filteredSnapshots = qrSnapshots.filter(snapshot => {
    const matchesSearch = !searchTerm || 
      snapshot.snapshotData.lote.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      snapshot.snapshotData.lote.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && snapshot.isActive) ||
      (statusFilter === "revoked" && !snapshot.isActive);
    
    const matchesDate = !dateFilter || 
      format(new Date(snapshot.createdAt), 'yyyy-MM-dd') === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  const getPublicUrl = (token: string) => {
    return `${window.location.origin}/trazabilidad/${token}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateQRMutation = useMutation({
    mutationFn: async (loteId: string) => {
      const res = await apiRequest("POST", `/api/lotes/${loteId}/generate-qr`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/qr-snapshots"] });
      toast({
        title: "QR generado",
        description: `Código QR creado exitosamente`,
      });
      setShowGenerateModal(false);
      setSelectedLoteId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo generar el código QR",
        variant: "destructive",
      });
    },
  });

  const downloadQR = async (snapshot: QrSnapshot) => {
    try {
      const QRCode = (await import('qrcode')).default;
      const url = getPublicUrl(snapshot.publicToken);
      
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Create download link
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `QR-${snapshot.snapshotData.lote.name}-${format(new Date(), 'yyyyMMdd')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "QR descargado",
        description: "El código QR se ha descargado exitosamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descargar el código QR",
        variant: "destructive",
      });
    }
  };

  const handleGenerateQR = () => {
    if (!selectedLoteId) return;
    generateQRMutation.mutate(selectedLoteId);
  };

  const rotateTokenMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await apiRequest("PUT", `/api/qr-snapshots/${snapshotId}/rotate`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/qr-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Token rotado",
        description: "El token ha sido renovado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo rotar el token",
        variant: "destructive",
      });
    },
  });

  const revokeQRMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await apiRequest("PUT", `/api/qr-snapshots/${snapshotId}/revoke`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/qr-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "QR revocado",
        description: "El código QR ha sido revocado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo revocar el código QR",
        variant: "destructive",
      });
    },
  });

  const handleRotateToken = (snapshotId: string) => {
    rotateTokenMutation.mutate(snapshotId);
  };

  const handleRevokeQR = (snapshotId: string) => {
    revokeQRMutation.mutate(snapshotId);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Trazabilidad Pública</h1>
            <p className="text-muted-foreground">Gestión de códigos QR y trazabilidad</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
              <DialogTrigger asChild>
                <Button data-testid="button-generate-qr">
                  <Plus className="h-4 w-4 mr-2" />
                  Generar QR
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Generar Código QR</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lote">Seleccionar Lote</Label>
                    <Select value={selectedLoteId} onValueChange={setSelectedLoteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar lote..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLotes.map(lote => (
                          <SelectItem key={lote.id} value={lote.id}>
                            {lote.identification} ({lote.initialAnimals} animales)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowGenerateModal(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleGenerateQR}
                      disabled={!selectedLoteId || generateQRMutation.isPending}
                      className="flex-1"
                    >
                      {generateQRMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Generar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" data-testid="button-bulk-download">
              <Download className="h-4 w-4 mr-2" />
              Descarga masiva
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar lote/sublote..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-qr"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="revoked">Revocado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                data-testid="input-date-filter"
              />
              <Button variant="outline" data-testid="button-apply-filters">
                <Filter className="h-4 w-4 mr-2" />
                Filtrar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Snapshots Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                    <div className="w-16 h-16 bg-muted rounded-lg"></div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                  <div className="h-8 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredSnapshots.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No hay códigos QR</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || statusFilter !== "all" || dateFilter 
                  ? "No se encontraron códigos QR con los filtros aplicados"
                  : "Los códigos QR se generan automáticamente al mover lotes de Secadero a Distribución"
                }
              </p>
              {(!searchTerm && statusFilter === "all" && !dateFilter) && (
                <Link href="/seguimiento">
                  <Button data-testid="link-tracking">
                    Ir al seguimiento de lotes
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSnapshots.map((snapshot) => (
              <Card 
                key={snapshot.id} 
                className={snapshot.isActive ? "" : "opacity-60"}
                data-testid={`qr-card-${snapshot.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground" data-testid={`qr-lote-name-${snapshot.id}`}>
                        {snapshot.snapshotData.lote.name}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid={`qr-lote-type-${snapshot.id}`}>
                        {snapshot.snapshotData.lote.iberianPercentage}% Ibérico
                        {snapshot.snapshotData.lote.regime && ` • ${snapshot.snapshotData.lote.regime}`}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge 
                          variant={snapshot.isActive ? "default" : "destructive"}
                          data-testid={`qr-status-${snapshot.id}`}
                        >
                          {snapshot.isActive ? "Activo" : "Revocado"}
                        </Badge>
                        <Badge variant="outline" data-testid={`qr-scans-${snapshot.id}`}>
                          {snapshot.scanCount || 0} escaneos
                        </Badge>
                      </div>
                    </div>
                    <div className="w-16 h-16 bg-muted border border-border rounded-lg flex items-center justify-center">
                      <QrCode className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="text-xs text-muted-foreground" data-testid={`qr-generated-${snapshot.id}`}>
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Generado: {format(new Date(snapshot.createdAt), 'dd/MM/yyyy', { locale: es })}
                    </div>
                    {(snapshot.scanCount || 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Último escaneo: {formatDistanceToNow(new Date(snapshot.createdAt), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Link href={`/trazabilidad/${snapshot.publicToken}`} target="_blank">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        disabled={!snapshot.isActive}
                        data-testid={`button-view-qr-${snapshot.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Vista
                      </Button>
                    </Link>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => downloadQR(snapshot)}
                      data-testid={`button-download-qr-${snapshot.id}`}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyToClipboard(getPublicUrl(snapshot.publicToken))}
                      data-testid={`button-copy-link-${snapshot.id}`}
                    >
                      <LinkIcon className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRotateToken(snapshot.id)}
                      disabled={!snapshot.isActive || rotateTokenMutation.isPending}
                      data-testid={`button-rotate-qr-${snapshot.id}`}
                    >
                      {rotateTokenMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRevokeQR(snapshot.id)}
                      disabled={!snapshot.isActive || revokeQRMutation.isPending}
                      data-testid={`button-revoke-qr-${snapshot.id}`}
                    >
                      {revokeQRMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
