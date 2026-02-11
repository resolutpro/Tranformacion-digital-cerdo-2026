import { useQuery, useMutation } from "@tanstack/react-query";
import { Alert } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, ArrowLeft, BellRing } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";

export default function AlertasPage() {
  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/alerts/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unread-count"] });
    },
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Sistema de Alertas
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitorización de incidencias en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <BellRing className="h-3 w-3 mr-2 text-primary" />
              {alerts?.filter((a) => !a.isRead).length || 0} Pendientes
            </Badge>
          </div>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
            <CardTitle className="text-lg font-medium">
              Historial de Incidencias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Zona / Sensor</TableHead>
                    <TableHead>Tipo de Alerta</TableHead>
                    <TableHead className="text-center">Valor</TableHead>
                    <TableHead className="text-center">Límite</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right pr-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell
                          colSpan={6}
                          className="h-16 animate-pulse bg-muted/20"
                        />
                      </TableRow>
                    ))
                  ) : alerts?.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-muted-foreground"
                      >
                        No hay alertas registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    alerts?.map((alert) => (
                      <TableRow
                        key={alert.id}
                        className={`group transition-colors ${!alert.isRead ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/50"}`}
                      >
                        <TableCell className="text-sm font-medium">
                          {format(new Date(alert.createdAt), "dd MMM, HH:mm", {
                            locale: es,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">
                              {(alert as any).zoneName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(alert as any).sensorName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <AlertTriangle
                              className={`h-4 w-4 ${alert.type === "min_breach" ? "text-amber-500" : "text-destructive"}`}
                            />
                            <span className="text-sm">
                              {alert.type === "min_breach"
                                ? "Mínimo Superado"
                                : "Máximo Superado"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold font-mono">
                          {alert.value}
                        </TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {alert.threshold}
                        </TableCell>
                        <TableCell>
                          {alert.isRead ? (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-none"
                            >
                              Resuelta
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="animate-pulse"
                            >
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {!alert.isRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30 dark:hover:text-green-400"
                              onClick={() => markRead.mutate(alert.id)}
                              disabled={markRead.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Resolver
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
