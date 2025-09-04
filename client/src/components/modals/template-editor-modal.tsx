import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FieldType = "text" | "number" | "select" | "date";

interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // solo para select
  defaultValue?: any;
}

interface TemplateDTO {
  id?: string;
  customFields: TemplateField[];
}

export function TemplateEditorModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();

  const { data: template } = useQuery<TemplateDTO>({
    queryKey: ["/api/lote-template"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/lote-template");
      if (!res.ok) throw new Error("No se pudo cargar la plantilla");
      const t = await res.json();
      return {
        id: t?.id,
        customFields: Array.isArray(t?.customFields) ? t.customFields : [],
      };
    },
    enabled: isOpen,
  });

  const [fields, setFields] = useState<TemplateField[]>([]);
  useEffect(() => {
    setFields(template?.customFields ?? []);
  }, [template]);

  const addField = () =>
    setFields((f) => [
      ...f,
      { key: "", label: "", type: "text", required: false },
    ]);

  const updateField = (idx: number, patch: Partial<TemplateField>) =>
    setFields((arr) => arr.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const removeField = (idx: number) =>
    setFields((arr) => arr.filter((_, i) => i !== idx));

  const saveMutation = useMutation({
    mutationFn: async () => {
      // limpieza básica de campos vacíos y opciones
      const cleaned = fields
        .map((f) => ({
          ...f,
          key: f.key.trim(),
          label: f.label.trim(),
          options:
            f.type === "select"
              ? (f.options ?? []).map((o) => String(o).trim()).filter(Boolean)
              : undefined,
        }))
        .filter((f) => f.key && f.label);

      const res = await apiRequest("PUT", "/api/lote-template", {
        customFields: cleaned,
      });
      if (!res.ok)
        throw new Error(
          (await res.json()).message ?? "No se pudo guardar la plantilla",
        );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lote-template"] });
      onSaved?.();
      toast({
        title: "Plantilla guardada",
        description: "Los cambios se han aplicado.",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e?.message ?? "No se pudo guardar la plantilla",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editor de plantilla de lotes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {fields.map((f, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-2 p-3 border rounded-lg"
            >
              <div className="col-span-3">
                <Label>Clave</Label>
                <Input
                  value={f.key}
                  onChange={(e) => updateField(idx, { key: e.target.value })}
                  placeholder="pH, curado, ..."
                />
              </div>
              <div className="col-span-3">
                <Label>Etiqueta</Label>
                <Input
                  value={f.label}
                  onChange={(e) => updateField(idx, { label: e.target.value })}
                  placeholder="pH del jamón"
                />
              </div>
              <div className="col-span-2">
                <Label>Tipo</Label>
                <Select
                  value={f.type}
                  onValueChange={(v: FieldType) =>
                    updateField(idx, { type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="select">Selección</SelectItem>
                    <SelectItem value="date">Fecha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Obligatorio</Label>
                <Select
                  value={String(!!f.required)}
                  onValueChange={(v) =>
                    updateField(idx, { required: v === "true" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="true">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12">
                {f.type === "select" ? (
                  <>
                    <Label>Opciones (separadas por coma)</Label>
                    <Input
                      value={(f.options ?? []).join(", ")}
                      onChange={(e) =>
                        updateField(idx, {
                          options: e.target.value
                            .split(",")
                            .map((s) => s.trim()),
                        })
                      }
                      placeholder="ej: bellota, cebo, recebo"
                    />
                  </>
                ) : (
                  <>
                    <Label>Valor por defecto</Label>
                    <Input
                      value={f.defaultValue ?? ""}
                      onChange={(e) =>
                        updateField(idx, { defaultValue: e.target.value })
                      }
                      placeholder="Opcional"
                    />
                  </>
                )}
              </div>
              <div className="col-span-12 text-right">
                <Button variant="outline" onClick={() => removeField(idx)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={addField}>
              Añadir campo
            </Button>
            <div className="space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateEditorModal;
