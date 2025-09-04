import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface CustomField {
  name: string;
  type: string;
  required: boolean;
}

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TemplateEditorModal({ isOpen, onClose }: TemplateEditorModalProps) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newField, setNewField] = useState<CustomField>({
    name: "",
    type: "text",
    required: false
  });
  const { toast } = useToast();

  const { data: template, isLoading } = useQuery<{customFields: CustomField[]}>({
    queryKey: ["/api/lote-template"],
    enabled: isOpen
  });

  useEffect(() => {
    if (isOpen) {
      if (template?.customFields) {
        setCustomFields(template.customFields);
      } else {
        setCustomFields([]);
      }
    }
  }, [template, isOpen]);

  const saveMutation = useMutation({
    mutationFn: async (fields: CustomField[]) => {
      const res = await apiRequest("PUT", "/api/lote-template", {
        customFields: fields
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lote-template"] });
      toast({
        title: "Plantilla actualizada",
        description: "La plantilla de lotes ha sido actualizada correctamente",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la plantilla",
        variant: "destructive",
      });
    },
  });


  const removeField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    saveMutation.mutate(customFields);
  };

  const addField = () => {
    if (!newField.name) return;
    
    const updatedFields = [...customFields, { ...newField }];
    setCustomFields(updatedFields);
    setNewField({ name: "", type: "text", required: false });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]" data-testid="modal-template-editor">
        <DialogHeader>
          <DialogTitle>Editor de Plantilla de Lotes</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Define campos opcionales que se aplicarán a los nuevos lotes. 
              Los campos obligatorios (identificación y número de animales) siempre están disponibles.
            </p>
          </div>

          {/* Existing custom fields */}
          {customFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Campos Personalizados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {customFields.map((field, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{field.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Tipo: {field.type} • {field.required ? "Obligatorio" : "Opcional"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(index)}
                      data-testid={`button-remove-field-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Add new field */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Añadir Campo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fieldName">Nombre del campo</Label>
                <Input
                  id="fieldName"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  placeholder="Peso inicial, Origen, etc."
                  data-testid="input-field-name"
                />
              </div>
              
              <div>
                <Label htmlFor="fieldType">Tipo de campo</Label>
                <Select 
                  value={newField.type} 
                  onValueChange={(value) => setNewField({ ...newField, type: value })}
                >
                  <SelectTrigger data-testid="select-field-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="date">Fecha</SelectItem>
                    <SelectItem value="select">Lista de opciones</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fieldRequired"
                  checked={newField.required}
                  onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                  data-testid="checkbox-field-required"
                />
                <Label htmlFor="fieldRequired">Campo obligatorio</Label>
              </div>

              <Button
                onClick={addField}
                disabled={!newField.name}
                size="sm"
                data-testid="button-add-field"
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir Campo
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1"
              data-testid="button-save-template"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Plantilla
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}