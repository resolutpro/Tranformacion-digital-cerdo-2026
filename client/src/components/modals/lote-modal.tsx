import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Lote } from "@shared/schema";

type TemplateField =
  | {
      key: string;
      label: string;
      type: "text";
      required?: boolean;
      defaultValue?: string;
    }
  | {
      key: string;
      label: string;
      type: "number";
      required?: boolean;
      defaultValue?: number;
    }
  | {
      key: string;
      label: string;
      type: "select";
      required?: boolean;
      options: string[];
      defaultValue?: string;
    }
  | {
      key: string;
      label: string;
      type: "date";
      required?: boolean;
      defaultValue?: string;
    };

interface LoteTemplateDTO {
  id: string;
  organizationId: string;
  customFields: TemplateField[]; // definición, no valores
  defaults?: Record<string, any>;
  updatedAt?: string;
}

interface CustomFieldValue {
  key: string;
  label?: string;
  type?: TemplateField["type"];
  value: any;
}

export function LoteModal({
  isOpen,
  onClose,
  lote,
  onLoteCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  lote: Lote | null; // si viene -> edición
  onLoteCreated?: (id: string) => void;
}) {
  const { toast } = useToast();

  // 1) Cargar plantilla al abrir
  const { data: template } = useQuery<LoteTemplateDTO>({
    queryKey: ["/api/lote-template"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/lote-template");
      if (!res.ok) throw new Error("No se pudo cargar la plantilla");
      const t = await res.json();
      return {
        ...t,
        customFields: Array.isArray(t?.customFields) ? t.customFields : [],
      };
    },
    enabled: isOpen,
  });

  // 2) Estado base del lote
  const [identification, setIdentification] = useState(
    lote?.identification ?? "",
  );
  const [initialAnimals, setInitialAnimals] = useState<number>(
    lote?.initialAnimals ?? 0,
  );
  const [foodRegime, setFoodRegime] = useState<string>(lote?.foodRegime ?? "");

  // 3) Estado dinámico
  const initialDynamicValues = useMemo(() => {
    // Si edito, mapear valores existentes (array → objeto)
    const existingObj: Record<string, any> = (lote?.customFields ?? []).reduce(
      (acc: any, it: CustomFieldValue) => {
        acc[it.key] = it.value;
        return acc;
      },
      {},
    );
    // Defaults de plantilla
    const defsFromTemplate = Object.fromEntries(
      (template?.customFields ?? []).map((f) => [
        f.key,
        existingObj[f.key] ??
          ("defaultValue" in f ? (f as any).defaultValue : undefined),
      ]),
    );
    return { ...defsFromTemplate, ...existingObj };
  }, [template, lote]);

  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});
  useEffect(() => {
    setDynamicValues(initialDynamicValues);
  }, [initialDynamicValues]);

  const setDynamicValue = (key: string, value: any) =>
    setDynamicValues((s) => ({ ...s, [key]: value }));

  // 4) Mutaciones
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/lotes", payload);
      if (!res.ok)
        throw new Error(
          (await res.json()).message ?? "No se pudo crear el lote",
        );
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lotes"] });
      toast({
        title: "Lote creado",
        description: "El lote se ha guardado correctamente",
      });
      onLoteCreated?.(data.id);
      onClose();
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e?.message ?? "No se pudo crear el lote",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("PUT", `/api/lotes/${lote!.id}`, payload);
      if (!res.ok)
        throw new Error(
          (await res.json()).message ?? "No se pudo actualizar el lote",
        );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lotes"] });
      toast({
        title: "Lote actualizado",
        description: "Los cambios se han guardado",
      });
      onClose();
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e?.message ?? "No se pudo actualizar el lote",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 5) Construir array de valores a partir de la definición + estado
    const defs = template?.customFields ?? [];
    const customFields: CustomFieldValue[] = defs
      .map((f) => {
        const raw = dynamicValues[f.key];
        const value =
          f.type === "number"
            ? raw === "" || raw === undefined
              ? undefined
              : Number(raw)
            : raw;

        if (f.required && (value === undefined || value === "")) {
          throw new Error(`El campo "${f.label}" es obligatorio`);
        }
        if (value === undefined || value === "") return null;

        return { key: f.key, label: f.label, type: f.type, value };
      })
      .filter(Boolean) as CustomFieldValue[];

    const base = {
      identification: identification.trim(),
      initialAnimals: Number(initialAnimals) || 0,
      foodRegime: foodRegime || null,
      customFields, // <-- VALORES que irán a lotes.customFields
    };

    if (lote) updateMutation.mutate(base);
    else createMutation.mutate(base);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lote ? "Editar lote" : "Nuevo lote"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label>Identificación</Label>
            <Input
              value={identification}
              onChange={(e) => setIdentification(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Animales iniciales</Label>
            <Input
              type="number"
              min={0}
              value={initialAnimals}
              onChange={(e) =>
                setInitialAnimals(
                  e.target.value === "" ? 0 : Number(e.target.value),
                )
              }
            />
          </div>
          <div>
            <Label>Régimen alimentario</Label>
            <Input
              value={foodRegime}
              onChange={(e) => setFoodRegime(e.target.value)}
            />
          </div>

          {/* Campos dinámicos */}
          {(template?.customFields ?? []).map((f) => {
            const v = dynamicValues[f.key] ?? "";
            if (f.type === "select") {
              return (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Select
                    value={v ?? ""}
                    onValueChange={(val) => setDynamicValue(f.key, val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            if (f.type === "number") {
              return (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    type="number"
                    value={v}
                    onChange={(e) => setDynamicValue(f.key, e.target.value)}
                    required={!!f.required}
                  />
                </div>
              );
            }
            if (f.type === "date") {
              return (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    type="date"
                    value={v}
                    onChange={(e) => setDynamicValue(f.key, e.target.value)}
                    required={!!f.required}
                  />
                </div>
              );
            }
            return (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input
                  value={v}
                  onChange={(e) => setDynamicValue(f.key, e.target.value)}
                  required={!!f.required}
                />
              </div>
            );
          })}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {lote ? "Guardar cambios" : "Crear lote"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LoteModal;
