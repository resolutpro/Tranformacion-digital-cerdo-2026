import { useQuery, useMutation } from "@tanstack/react-query";
import { Alert, Zone, Sensor } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Sistema de Alertas</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Incidencias</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor Recibido</TableHead>
                <TableHead>Límite</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts?.map((alert) => (
                <TableRow
                  key={alert.id}
                  className={!alert.isRead ? "bg-red-50/50" : ""}
                >
                  <TableCell>
                    {format(new Date(alert.createdAt), "PPp", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        alert.type === "min_breach"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {alert.type === "min_breach"
                        ? "Mínimo Superado"
                        : "Máximo Superado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold">{alert.value}</TableCell>
                  <TableCell>{alert.threshold}</TableCell>
                  <TableCell>
                    {alert.isRead ? (
                      <Badge variant="outline" className="text-green-600">
                        Revisada
                      </Badge>
                    ) : (
                      <Badge variant="default">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!alert.isRead && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markRead.mutate(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Resolver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
