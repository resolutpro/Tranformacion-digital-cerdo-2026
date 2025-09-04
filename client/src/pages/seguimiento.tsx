import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdvancedMoveModal } from "@/components/modals/advanced-move-modal";
import { useDragAndDrop } from "@/lib/drag-drop";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Filter, 
  MoreVertical,
  Sprout,
  TrendingUp,
  Factory,
  Wind,
  Truck,
  Check,
  MapPin,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { Lote, Zone } from "@shared/schema";

interface ExtendedLote extends Lote {
  currentZone?: Zone;
  totalDays?: number;
}

interface TrackingBoard {
  sinUbicacion: { zones: Zone[]; lotes: ExtendedLote[] };
  cria: { zones: Zone[]; lotes: ExtendedLote[] };
  engorde: { zones: Zone[]; lotes: ExtendedLote[] };
  matadero: { zones: Zone[]; lotes: ExtendedLote[] };
  secadero: { zones: Zone[]; lotes: ExtendedLote[] };
  distribucion: { zones: Zone[]; lotes: ExtendedLote[] };
  finalizado: { zones: Zone[]; lotes: ExtendedLote[] };
}

const stageConfig = {
  sinUbicacion: { 
    title: "Sin Ubicación", 
    icon: MapPin, 
    color: "bg-orange-50/50 border-orange-200",
    headerColor: "bg-orange-100/50"
  },
  cria: { 
    title: "Cría", 
    icon: Sprout, 
    color: "bg-secondary/5 border-secondary/20",
    headerColor: "bg-secondary/10"
  },
  engorde: { 
    title: "Engorde", 
    icon: TrendingUp, 
    color: "bg-primary/5 border-primary/20",
    headerColor: "bg-primary/10"
  },
  matadero: { 
    title: "Matadero", 
    icon: Factory, 
    color: "bg-accent/5 border-accent/20",
    headerColor: "bg-accent/10"
  },
  secadero: { 
    title: "Secadero", 
    icon: Wind, 
    color: "bg-chart-3/5 border-chart-3/20",
    headerColor: "bg-chart-3/10"
  },
  distribucion: { 
    title: "Distribución", 
    icon: Truck, 
    color: "bg-chart-4/5 border-chart-4/20",
    headerColor: "bg-chart-4/10"
  },
  finalizado: { 
    title: "Finalizado", 
    icon: Check, 
    color: "bg-muted/5 border-muted/20",
    headerColor: "bg-muted/10"
  }
};

export default function Seguimiento() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLote, setSelectedLote] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [moveModalLote, setMoveModalLote] = useState<Lote | null>(null);
  const [moveModalStage, setMoveModalStage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: rawBoard, isLoading } = useQuery<TrackingBoard>({
    queryKey: ["/api/tracking/board"],
  });

  // Filter board data based on search and filters  
  const board = rawBoard ? {
    ...rawBoard,
    sinUbicacion: {
      ...rawBoard.sinUbicacion,
      lotes: (rawBoard.sinUbicacion?.lotes || []).filter(lote => 
        (searchTerm === "" || 
         lote.identification.toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.customData?.origen?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        ) && (statusFilter === "all" || lote.status === statusFilter)
      ) || []
    },
    cria: {
      ...rawBoard.cria,
      lotes: (rawBoard.cria?.lotes || []).filter(lote => 
        (searchTerm === "" || 
         lote.identification.toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.customData?.origen?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.currentZone?.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) && (statusFilter === "all" || lote.status === statusFilter)
      ) || []
    },
    engorde: {
      ...rawBoard.engorde,
      lotes: (rawBoard.engorde?.lotes || []).filter(lote => 
        (searchTerm === "" || 
         lote.identification.toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.customData?.origen?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.currentZone?.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) && (statusFilter === "all" || lote.status === statusFilter)
      ) || []
    },
    matadero: {
      ...rawBoard.matadero,
      lotes: (rawBoard.matadero?.lotes || []).filter(lote => 
        (searchTerm === "" || 
         lote.identification.toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.customData?.origen?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.currentZone?.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) && (statusFilter === "all" || lote.status === statusFilter)
      ) || []
    },
    secadero: {
      ...rawBoard.secadero,
      lotes: (rawBoard.secadero?.lotes || []).filter(lote => 
        (searchTerm === "" || 
         lote.identification.toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.customData?.origen?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.currentZone?.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) && (statusFilter === "all" || lote.status === statusFilter)
      ) || []
    },
    distribucion: {
      ...rawBoard.distribucion,
      lotes: (rawBoard.distribucion?.lotes || []).filter(lote => 
        (searchTerm === "" || 
         lote.identification.toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.customData?.origen?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.currentZone?.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) && (statusFilter === "all" || lote.status === statusFilter)
      ) || []
    },
    finalizado: {
      ...rawBoard.finalizado,
      lotes: (rawBoard.finalizado?.lotes || []).filter(lote => 
        (searchTerm === "" || 
         lote.identification.toLowerCase().includes(searchTerm.toLowerCase()) ||
         lote.customData?.origen?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        ) && (statusFilter === "all" || lote.status === statusFilter)
      ) || []
    }
  } : null;

  const moveMutation = useMutation({
    mutationFn: async ({ loteId, zoneId, entryTime }: { loteId: string; zoneId: string; entryTime: string }) => {
      const res = await apiRequest("POST", `/api/lotes/${loteId}/move`, {
        zoneId,
        entryTime,
      });
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
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo mover el lote",
        variant: "destructive",
      });
    },
  });

  const { draggedItem, dragHandlers } = useDragAndDrop({
    onDrop: (draggedLoteId: string, targetZoneId: string) => {
      // Find the lote to get current stage info
      const draggedLote = board ? Object.values(board).flat()
        .find(stage => stage.lotes.find(l => l.id === draggedLoteId))
        ?.lotes.find(l => l.id === draggedLoteId) : null;

      if (!draggedLote) return;

      // Determine current stage
      let currentStage = "sinUbicacion";
      if (draggedLote.currentZone) {
        currentStage = draggedLote.currentZone.stage;
      }

      // Open advanced move modal instead of direct mutation
      setMoveModalLote(draggedLote);
      setMoveModalStage(currentStage);
    }
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Seguimiento de Lotes</h1>
            <p className="text-muted-foreground">Tablero de control de movimientos</p>
          </div>
          <div className="h-96 bg-muted/20 rounded-lg animate-pulse"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Seguimiento de Lotes</h1>
            <p className="text-muted-foreground">Tablero de control de movimientos</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar lotes activos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
                data-testid="input-search-tracking"
              />
            </div>
            <Button 
              variant={showFilters ? "default" : "outline"} 
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-filters"
              className="w-full sm:w-auto"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="p-4 bg-muted/10 border-muted/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="text-sm font-medium">Filtros:</div>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                  data-testid="filter-all"
                >
                  Todos
                </Button>
                <Button 
                  size="sm" 
                  variant={statusFilter === "active" ? "default" : "outline"}
                  onClick={() => setStatusFilter("active")}
                  data-testid="filter-active"
                >
                  Activos
                </Button>
                <Button 
                  size="sm" 
                  variant={statusFilter === "finished" ? "default" : "outline"}
                  onClick={() => setStatusFilter("finished")}
                  data-testid="filter-finished"
                >
                  Finalizados
                </Button>
              </div>
              <div className="text-xs text-muted-foreground md:ml-auto">
                Resultados: {board ? Object.values(board).reduce((total, stage) => total + (stage.lotes?.length || 0), 0) : 0}
              </div>
            </div>
          </Card>
        )}

        {/* Kanban Board - Desktop View */}
        {!isMobile && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 kanban-column overflow-x-auto">
            {Object.entries(stageConfig).map(([stage, config]) => {
              const stageData = board?.[stage as keyof TrackingBoard];
              if (!stageData) return null;

              return (
                <Card key={stage} className={config.color} data-testid={`column-${stage}`}>
                  <CardHeader className={`p-4 border-b border-border ${config.headerColor}`}>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <config.icon className="h-4 w-4" />
                      {config.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {stageData.lotes?.length || 0} lotes
                    </p>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                  {stage === 'sinUbicacion' ? (
                    <div className="space-y-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
                        <Input
                          placeholder="Buscar lotes..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8 h-8 text-xs"
                          data-testid="input-search-sin-ubicacion"
                        />
                      </div>
                      {(stageData.lotes || []).map((lote) => (
                        <div
                          key={lote.id}
                          className={`batch-card bg-background border border-orange-200 rounded-md p-3 cursor-move transition-all hover:shadow-md border-l-4 border-l-orange-400 ${
                            draggedItem === lote.id ? 'batch-card-dragging opacity-50' : ''
                          } ${selectedLote === lote.id ? 'ring-2 ring-primary' : ''}`}
                          {...dragHandlers.getDraggableProps(lote.id)}
                          onClick={() => setSelectedLote(lote.id === selectedLote ? null : lote.id)}
                          data-testid={`lote-card-${lote.id}`}
                        >
                          <div className="font-medium text-sm" data-testid={`lote-name-${lote.id}`}>
                            {lote.identification}
                          </div>
                          <div className="text-xs text-muted-foreground" data-testid={`lote-animals-${lote.id}`}>
                            {lote.initialAnimals} animales
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                              Sin ubicar
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs h-6 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoveModalLote(lote);
                                setMoveModalStage("sinUbicacion");
                              }}
                              data-testid={`assign-zone-${lote.id}`}
                            >
                              Asignar zona
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : stage === 'finalizado' ? (
                    <div 
                      className="kanban-zone text-center p-4"
                      {...dragHandlers.getDropZoneProps('finalizado')}
                      data-testid="drop-zone-finalizado"
                    >
                      <div className="text-xs text-muted-foreground">
                        Arrastrar aquí para finalizar
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Zonas normales */}
                      {(stageData.zones || []).map((zone) => {
                        const zoneLotes = (stageData.lotes || []).filter((lote) => 
                          lote.currentZone?.id === zone.id
                        );

                        return (
                          <div 
                            key={zone.id}
                            className="kanban-zone p-2"
                            {...dragHandlers.getDropZoneProps(zone.id)}
                            data-testid={`drop-zone-${zone.id}`}
                          >
                            <div className="text-xs text-muted-foreground mb-2" data-testid={`zone-label-${zone.id}`}>
                              {zone.name}
                            </div>
                          <div className="space-y-2">
                            {zoneLotes.map((lote) => {
                              // Determine card styling based on duration
                              const days = lote.totalDays || 0;
                              let durationStyle = "";
                              let durationIndicator = "";

                              if (days < 30) {
                                durationStyle = "border-l-4 border-l-green-400";
                                durationIndicator = "bg-green-100 text-green-700";
                              } else if (days < 90) {
                                durationStyle = "border-l-4 border-l-yellow-400";
                                durationIndicator = "bg-yellow-100 text-yellow-700";
                              } else {
                                durationStyle = "border-l-4 border-l-red-400";
                                durationIndicator = "bg-red-100 text-red-700";
                              }

                              return (
                                <div
                                  key={lote.id}
                                  className={`batch-card bg-background border border-border rounded-md p-3 cursor-move transition-all hover:shadow-md ${durationStyle} ${
                                    draggedItem === lote.id ? 'batch-card-dragging opacity-50' : ''
                                  } ${selectedLote === lote.id ? 'ring-2 ring-primary' : ''}`}
                                  {...dragHandlers.getDraggableProps(lote.id)}
                                  onClick={() => setSelectedLote(lote.id === selectedLote ? null : lote.id)}
                                  data-testid={`lote-card-${lote.id}`}
                                >
                                <div className="font-medium text-sm" data-testid={`lote-name-${lote.id}`}>
                                  {lote.identification}
                                </div>
                                <div className="text-xs text-muted-foreground" data-testid={`lote-animals-${lote.id}`}>
                                  {lote.initialAnimals} animales
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs px-1.5 py-0.5 ${durationIndicator}`}
                                    data-testid={`lote-days-${lote.id}`}
                                  >
                                    {lote.totalDays || 0}d
                                  </Badge>
                                  {selectedLote === lote.id && (
                                    <div className="w-2 h-2 bg-primary rounded-full flex items-center justify-center">
                                      <MapPin className="h-1 w-1" />
                                    </div>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-auto p-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMoveModalLote(lote);
                                      setMoveModalStage(stage);
                                    }}
                                    data-testid={`button-lote-menu-${lote.id}`}
                                  >
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}

        {/* Mobile View */}
        {isMobile && (
          <div className="space-y-4">
            {Object.entries(stageConfig).map(([stage, config]) => {
              const stageData = board?.[stage as keyof TrackingBoard];
              if (!stageData) return null;

              const isCollapsed = collapsedStages[stage] ?? true;
              const toggleCollapse = () => {
                setCollapsedStages(prev => ({
                  ...prev,
                  [stage]: !isCollapsed
                }));
              };

              return (
                <Card key={stage} className={config.color} data-testid={`mobile-column-${stage}`}>
                  <CardHeader 
                    className={`p-4 border-b border-border ${config.headerColor} cursor-pointer`}
                    onClick={toggleCollapse}
                  >
                    <CardTitle className="text-sm flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.title}
                        {isCollapsed ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronUp className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {stageData.lotes?.length || 0} lotes
                        {stage !== 'sinUbicacion' && stage !== 'finalizado' && (
                          <span className="ml-1 text-muted-foreground">• {stageData.zones?.length || 0} zonas</span>
                        )}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  {!isCollapsed && (
                    <CardContent className="p-3">
                      <div className="grid grid-cols-1 gap-3">
                      {stage === 'sinUbicacion' ? (
                        (stageData.lotes || []).map((lote) => (
                          <div
                            key={lote.id}
                            className={`bg-background border border-border rounded-md p-3 border-l-4 border-l-orange-400 ${selectedLote === lote.id ? 'ring-2 ring-primary' : ''} mb-2`}
                            onClick={() => setSelectedLote(lote.id === selectedLote ? null : lote.id)}
                            {...dragHandlers.getDraggableProps(lote.id)}
                            data-testid={`mobile-lote-card-${lote.id}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium text-sm">{lote.identification}</div>
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                                Sin ubicar
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              {lote.initialAnimals} animales
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoveModalLote(lote);
                                setMoveModalStage("sinUbicacion");
                              }}
                              data-testid={`mobile-assign-zone-${lote.id}`}
                            >
                              Asignar zona
                            </Button>
                          </div>
                        ))
                      ) : stage === 'finalizado' ? (
                        <div>
                          <div 
                            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center mb-3"
                            {...dragHandlers.getDropZoneProps('finalizado')}
                          >
                            <div className="text-xs text-muted-foreground">
                              Arrastrar aquí para finalizar
                            </div>
                          </div>
                          {(stageData.lotes || []).map((lote) => (
                            <div
                              key={lote.id}
                              className={`bg-background border border-border rounded-md p-3 border-l-4 border-l-gray-400 ${selectedLote === lote.id ? 'ring-2 ring-primary' : ''} mb-2`}
                              onClick={() => setSelectedLote(lote.id === selectedLote ? null : lote.id)}
                              data-testid={`mobile-lote-card-${lote.id}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-sm">{lote.identification}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {lote.initialAnimals} animales
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700 border-gray-300">
                                  Finalizado
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        (stageData.zones || []).map((zone) => {
                          const zoneLotes = (stageData.lotes || []).filter((lote) => 
                            lote.currentZone?.id === zone.id
                          );

                          return (
                            <div key={zone.id} className="space-y-2">
                              <div className="text-xs text-muted-foreground font-medium bg-muted/30 p-2 rounded flex justify-between items-center">
                                <span>{zone.name}</span>
                                <span className="text-xs">({zoneLotes.length} lotes)</span>
                              </div>

                              {/* Drop zone for empty zones */}
                              {zoneLotes.length === 0 && (
                                <div 
                                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center"
                                  {...dragHandlers.getDropZoneProps(zone.id)}
                                >
                                  <div className="text-xs text-muted-foreground">
                                    Arrastrar lotes aquí
                                  </div>
                                </div>
                              )}

                              {/* Drop zone for zones with lotes */}
                              {zoneLotes.length > 0 && (
                                <div 
                                  className="border border-dashed border-muted-foreground/20 rounded-lg p-2 text-center mb-2"
                                  {...dragHandlers.getDropZoneProps(zone.id)}
                                >
                                  <div className="text-xs text-muted-foreground">
                                    Zona de destino
                                  </div>
                                </div>
                              )}

                              {(zoneLotes || []).map((lote) => {
                                const days = lote.totalDays || 0;
                                let durationStyle = "";
                                let durationIndicator = "";

                                if (days < 30) {
                                  durationStyle = "border-l-4 border-l-green-400";
                                  durationIndicator = "bg-green-100 text-green-700";
                                } else if (days < 90) {
                                  durationStyle = "border-l-4 border-l-yellow-400";
                                  durationIndicator = "bg-yellow-100 text-yellow-700";
                                } else {
                                  durationStyle = "border-l-4 border-l-red-400";
                                  durationIndicator = "bg-red-100 text-red-700";
                                }

                                return (
                                  <div
                                    key={lote.id}
                                    className={`bg-background border border-border rounded-md p-3 ${durationStyle} ${
                                      draggedItem === lote.id ? 'opacity-50' : ''
                                    } ${selectedLote === lote.id ? 'ring-2 ring-primary' : ''}`}
                                    onClick={() => setSelectedLote(lote.id === selectedLote ? null : lote.id)}
                                    {...dragHandlers.getDraggableProps(lote.id)}
                                    data-testid={`mobile-lote-card-${lote.id}`}
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <div className="font-medium text-sm">{lote.identification}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {lote.initialAnimals} animales
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs px-1.5 py-0.5 ${durationIndicator}`}
                                        >
                                          {days}d
                                        </Badge>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-auto p-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMoveModalLote(lote);
                                            setMoveModalStage(stage);
                                          }}
                                          data-testid={`mobile-button-lote-menu-${lote.id}`}
                                        >
                                          <ArrowRight className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })
                      )}
                    </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Advanced Move Modal */}
        <AdvancedMoveModal
          isOpen={!!moveModalLote}
          onClose={() => {
            setMoveModalLote(null);
            setMoveModalStage(null);
          }}
          lote={moveModalLote}
          currentStage={moveModalStage}
        />
      </div>
    </MainLayout>
  );
}