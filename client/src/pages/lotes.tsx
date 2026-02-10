import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoteModal } from "@/components/modals/lote-modal";
import { TemplateEditorModal } from "@/components/modals/template-editor-modal";
import { MoveToZoneModal } from "@/components/modals/move-to-zone-modal";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Settings,
  MapPin,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Lote } from "@shared/schema";
import QRCode from "react-qr-code";

export default function Lotes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [newlyCreatedLoteId, setNewlyCreatedLoteId] = useState<string | null>(
    null,
  );
  const [expandedLotes, setExpandedLotes] = useState<Set<string>>(new Set());
  const [sublotesData, setSublotesData] = useState<Record<string, Lote[]>>({});
  const [templateRefresh, setTemplateRefresh] = useState(0); // <<--- NUEVO
  const { toast } = useToast();

  const { data: lotes = [], isLoading } = useQuery<Lote[]>({
    queryKey: ["/api/lotes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/lotes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lotes"] });
      toast({
        title: "Lote eliminado",
        description: "El lote ha sido eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el lote",
        variant: "destructive",
      });
    },
  });

  const filteredLotes = lotes.filter(
    (lote) =>
      !lote.parentLoteId &&
      (lote.identification.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lote.foodRegime?.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const handleEdit = (lote: Lote) => {
    setSelectedLote(lote);
    setIsModalOpen(true);
  };

  const handleDelete = (lote: Lote) => {
    if (
      confirm(
        `¿Estás seguro de que quieres eliminar el lote ${lote.identification}?`,
      )
    ) {
      deleteMutation.mutate(lote.id);
    }
  };

  const handleNewLote = () => {
    // Asegura que cualquier plantilla cacheada se invalide antes de abrir el modal
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey.some(
          (k) => typeof k === "string" && k.includes("lote-template"),
        ),
    });
    setSelectedLote(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLote(null);
  };

  // Callback cuando se guarda la plantilla en el modal de plantillas
  const handleTemplateSaved = () => {
    // Invalida cualquier query relacionada con la plantilla
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey.some(
          (k) => typeof k === "string" && k.includes("lote-template"),
        ),
    });
    // Fuerza remount del LoteModal (volverá a leer la plantilla)
    setTemplateRefresh((prev) => prev + 1);
    setIsTemplateModalOpen(false);
    toast({
      title: "Plantilla actualizada",
      description: "Los nuevos campos estarán disponibles al crear un lote.",
    });
  };

  const toggleLoteExpansion = async (loteId: string) => {
    const newExpanded = new Set(expandedLotes);

    if (expandedLotes.has(loteId)) {
      newExpanded.delete(loteId);
    } else {
      newExpanded.add(loteId);
      if (!sublotesData[loteId]) {
        try {
          const res = await fetch(`/api/lotes/${loteId}/sublotes`);
          if (res.ok) {
            const sublotes = await res.json();
            setSublotesData((prev) => ({ ...prev, [loteId]: sublotes }));
          }
        } catch (error) {
          console.error("Error loading sublotes:", error);
        }
      }
    }

    setExpandedLotes(newExpanded);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              Gestión de Lotes
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Administra los lotes de animales
            </p>
          </div>
          <Button
            onClick={handleNewLote}
            data-testid="button-new-lote"
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Lote
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar lotes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-lotes"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTemplateModalOpen(true)}
                data-testid="button-template-settings"
                className="w-full md:w-auto"
              >
                <Settings className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Editar plantilla</span>
                <span className="sm:hidden">Plantilla</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="p-4 border border-border rounded-lg animate-pulse"
                  >
                    <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2 mb-3"></div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-muted rounded w-16"></div>
                      <div className="h-6 bg-muted rounded w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLotes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {searchTerm
                    ? "No se encontraron lotes"
                    : "No hay lotes creados"}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={handleNewLote}
                    data-testid="button-new-lote-empty"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primer lote
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLotes.map((lote) => {
                  const hasSubLotes = sublotesData[lote.id]?.length > 0;
                  const isExpanded = expandedLotes.has(lote.id);

                  return (
                    <div key={lote.id}>
                      <div
                        className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`lote-${lote.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {/* Expansion button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleLoteExpansion(lote.id)}
                                className="p-1 h-auto"
                                data-testid={`button-expand-lote-${lote.id}`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <h3
                                className="font-medium text-foreground"
                                data-testid={`lote-name-${lote.id}`}
                              >
                                {lote.identification}
                              </h3>
                              {hasSubLotes && (
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-700 text-xs"
                                >
                                  {sublotesData[lote.id].length} sublotes
                                </Badge>
                              )}
                            </div>
                            <p
                              className="text-sm text-muted-foreground"
                              data-testid={`lote-details-${lote.id}`}
                            >
                              {lote.initialAnimals} animales iniciales
                              {lote.finalAnimals &&
                                ` → ${lote.finalAnimals} finales`}
                              {lote.foodRegime && ` • ${lote.foodRegime}`}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge
                                variant={
                                  lote.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                                data-testid={`lote-status-${lote.id}`}
                              >
                                {lote.status === "active"
                                  ? "Activo"
                                  : "Finalizado"}
                              </Badge>
                              {lote.parentLoteId && (
                                <Badge
                                  variant="outline"
                                  data-testid={`lote-sublote-${lote.id}`}
                                >
                                  Sublote - {lote.pieceType}
                                </Badge>
                              )}
                              {/* Show "Sin ubicación" badge for lotes without active stays */}
                              <LoteLocationBadge loteId={lote.id} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <LoteAssignButton
                              lote={lote}
                              onAssign={() => {
                                setSelectedLote(lote);
                                setIsMoveModalOpen(true);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(lote)}
                              data-testid={`button-edit-lote-${lote.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(lote)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-lote-${lote.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Sublotes section */}
                      {isExpanded && hasSubLotes && (
                        <div className="ml-8 mt-4 space-y-2">
                          {sublotesData[lote.id].map((sublote) => (
                            <div
                              key={sublote.id}
                              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                              data-testid={`sublote-${sublote.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-orange-100 text-orange-700"
                                    >
                                      {sublote.pieceType || "Sublote"}
                                    </Badge>
                                    <h4 className="text-sm font-medium text-foreground">
                                      {sublote.identification}
                                    </h4>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {sublote.initialAnimals} piezas
                                    {sublote.foodRegime &&
                                      ` • ${sublote.foodRegime}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(sublote)}
                                    className="h-8 w-8 p-0"
                                    data-testid={`button-edit-sublote-${sublote.id}`}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(sublote)}
                                    disabled={deleteMutation.isPending}
                                    className="h-8 w-8 p-0"
                                    data-testid={`button-delete-sublote-${sublote.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* IMPORTANTE: key={templateRefresh} fuerza remount tras guardar plantilla */}
        <LoteModal
          key={templateRefresh}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          lote={selectedLote}
          onLoteCreated={(loteId) => {
            setNewlyCreatedLoteId(loteId);
            toast({
              title: "Lote creado",
              description: "El lote ha sido creado correctamente",
              action: (
                <Button
                  size="sm"
                  onClick={() => {
                    const lote = { id: loteId } as Lote;
                    setSelectedLote(lote);
                    setIsMoveModalOpen(true);
                  }}
                >
                  Asignar a una zona
                </Button>
              ),
            });
          }}
        />

        <TemplateEditorModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          onSaved={handleTemplateSaved} // <<--- NUEVO
        />

        <MoveToZoneModal
          isOpen={isMoveModalOpen}
          onClose={() => {
            setIsMoveModalOpen(false);
            setSelectedLote(null);
          }}
          lote={selectedLote}
        />
      </div>
    </MainLayout>
  );
}

export function BlockchainTab({ loteId }) {
  const { data } = useQuery({ queryKey: [`/api/blockchain/${loteId}`] });
  const publicUrl = `${window.location.origin}/public-trace/${loteId}`;

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Columna 1: El Ledger Inmutable */}
      <Card>
        <CardHeader>
          <CardTitle>Registro Blockchain Inmutable</CardTitle>
          <CardDescription>
            Estado de Integridad:{" "}
            {data?.isIntegrityVerified ? (
              <span className="text-green-600 font-bold">
                VERIFICADO (Seguro)
              </span>
            ) : (
              <span className="text-red-600 font-bold">CORRUPTO</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {data?.chain.map((block) => (
              <div
                key={block.hash}
                className="mb-4 p-3 border rounded bg-muted/50 text-xs font-mono"
              >
                <div className="flex justify-between text-primary font-bold">
                  <span>Block #{block.index}</span>
                  <span>{new Date(block.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="my-1 text-blue-600">{block.actionType}</div>
                <div className="truncate text-muted-foreground">
                  Prev: {block.previousHash}
                </div>
                <div className="truncate font-bold text-green-700">
                  Hash: {block.hash}
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Columna 2: Consumidor Final (QR) */}
      <Card>
        <CardHeader>
          <CardTitle>Etiquetado Inteligente</CardTitle>
          <CardDescription>Escanea para verificar origen</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4">
          <div className="bg-white p-4 rounded shadow-lg">
            <QRCode value={publicUrl} size={200} />
          </div>
          <p className="text-sm text-center text-muted-foreground">
            Este código QR permite a distribuidores y consumidores auditar la
            cadena de frío y alimentación sin intermediarios.
          </p>
          <Button onClick={() => window.open(publicUrl, "_blank")}>
            Simular Vista Cliente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component to show lote location status
function LoteLocationBadge({ loteId }: { loteId: string }) {
  const { data: activeStay } = useQuery({
    queryKey: ["/api/lotes", loteId, "active-stay"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/lotes/${loteId}/active-stay`);
      return res.status === 404 ? null : res.json();
    },
  });

  if (activeStay === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sin ubicación
      </Badge>
    );
  }

  return null;
}

// Helper component to show assign button for lotes without location
function LoteAssignButton({
  lote,
  onAssign,
}: {
  lote: Lote;
  onAssign: () => void;
}) {
  const { data: activeStay } = useQuery({
    queryKey: ["/api/lotes", lote.id, "active-stay"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/lotes/${lote.id}/active-stay`);
      return res.status === 404 ? null : res.json();
    },
  });

  if (activeStay === null && lote.status === "active") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onAssign}
        data-testid={`button-assign-lote-${lote.id}`}
      >
        <MapPin className="h-4 w-4 mr-1" />
        Asignar
      </Button>
    );
  }

  return null;
}
