import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import type { Lote } from "@shared/schema";

interface CustomField {
  name: string;
  type: string;
  required: boolean;
}

interface LoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  lote?: Lote | null;
  onLoteCreated?: (loteId: string) => void;
}

export function LoteModal({ isOpen, onClose, lote, onLoteCreated }: LoteModalProps) {
  const [formData, setFormData] = useState({
    identification: "",
    initialAnimals: "",
    finalAnimals: "",
    foodRegime: "",
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  // Load lote template for custom fields
  const { data: template, isLoading: isLoadingTemplate, error: templateError, refetch: refetchTemplate } = useQuery<{customFields: CustomField[]}>({
    queryKey: ["/api/lote-template"],
    enabled: isOpen && !!user, // Only load when modal is open AND user is authenticated
    retry: 3,
    retryDelay: 1000,
  });

  // Invalidate template when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen && user) {
      queryClient.invalidateQueries({ queryKey: ["/api/lote-template"] });
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (lote) {
      setFormData({
        identification: lote.identification,
        initialAnimals: lote.initialAnimals.toString(),
        finalAnimals: lote.finalAnimals?.toString() || "",
        foodRegime: lote.foodRegime || "",
      });
      setCustomFieldsData(lote.customData || {});
    } else {
      setFormData({
        identification: "",
        initialAnimals: "",
        finalAnimals: "",
        foodRegime: "",
      });
      setCustomFieldsData({});
    }
  }, [lote, isOpen]);

  // Separate effect for template changes to initialize custom fields for new lotes
  useEffect(() => {
    if (!lote && template?.customFields && template.customFields.length > 0 && isOpen) {
      const initialCustomData: Record<string, any> = {};
      template.customFields.forEach(field => {
        initialCustomData[field.name] = "";
      });
      setCustomFieldsData(initialCustomData);
    }
  }, [template, lote, isOpen]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = lote ? `/api/lotes/${lote.id}` : "/api/lotes";
      const method = lote ? "PUT" : "POST";
      const res = await apiRequest(method, endpoint, data);
      return res.json();
    },
    onSuccess: (createdLote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lotes"] });
      if (lote) {
        toast({
          title: "Lote actualizado",
          description: "El lote ha sido actualizado correctamente",
        });
      } else {
        // For new lotes, call the callback instead of showing toast here
        onLoteCreated?.(createdLote.id);
      }
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el lote",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      identification: formData.identification,
      initialAnimals: parseInt(formData.initialAnimals),
      finalAnimals: formData.finalAnimals ? parseInt(formData.finalAnimals) : undefined,
      foodRegime: formData.foodRegime || undefined,
      customData: customFieldsData,
    };
    
    console.log('[DEBUG] LoteModal submitting data:', data);
    console.log('[DEBUG] customFieldsData state:', customFieldsData);
    console.log('[DEBUG] template:', template);

    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[350px] max-h-[80vh]" data-testid="modal-lote">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {lote ? "Editar Lote" : "Nuevo Lote"}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(80vh-120px)]">
          <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="identification" className="text-sm">Identificación *</Label>
            <Input
              id="identification"
              value={formData.identification}
              onChange={(e) => setFormData({ ...formData, identification: e.target.value })}
              placeholder="LOTE-2024-003"
              required
              data-testid="input-lote-identification"
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="initialAnimals" className="text-sm">Nº de animales iniciales *</Label>
            <Input
              id="initialAnimals"
              type="number"
              min="1"
              value={formData.initialAnimals}
              onChange={(e) => setFormData({ ...formData, initialAnimals: e.target.value })}
              placeholder="45"
              required
              data-testid="input-lote-initial-animals"
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="foodRegime" className="text-sm">Régimen de comida</Label>
            <Select 
              value={formData.foodRegime} 
              onValueChange={(value) => setFormData({ ...formData, foodRegime: value })}
            >
              <SelectTrigger data-testid="select-lote-food-regime">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bellota">Bellota</SelectItem>
                <SelectItem value="recebo">Recebo</SelectItem>
                <SelectItem value="cebo">Cebo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="finalAnimals" className="text-sm">Nº de animales finales</Label>
            <Input
              id="finalAnimals"
              type="number"
              min="1"
              value={formData.finalAnimals}
              onChange={(e) => setFormData({ ...formData, finalAnimals: e.target.value })}
              placeholder="45"
              data-testid="input-lote-final-animals"
            />
          </div>
          
          {/* Loading indicator for template */}
          {isLoadingTemplate && (
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando campos personalizados...</span>
              </div>
            </div>
          )}

          {/* Dynamic custom fields from template */}
          {template?.customFields && template.customFields.length > 0 && (
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium text-sm">Campos personalizados ({template.customFields.length})</h4>
              {template.customFields.map((field, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`custom-${field.name}`}>
                    {field.name} {field.required && "*"}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={`custom-${field.name}`}
                      value={customFieldsData[field.name] || ""}
                      onChange={(e) => setCustomFieldsData({
                        ...customFieldsData,
                        [field.name]: e.target.value
                      })}
                      placeholder={`Ingrese ${field.name.toLowerCase()}`}
                      required={field.required}
                      data-testid={`input-custom-${field.name.toLowerCase().replace(/\\s+/g, '-')}`}
                    />
                  ) : field.type === "number" ? (
                    <Input
                      id={`custom-${field.name}`}
                      type="number"
                      value={customFieldsData[field.name] || ""}
                      onChange={(e) => setCustomFieldsData({
                        ...customFieldsData,
                        [field.name]: e.target.value
                      })}
                      placeholder={`Ingrese ${field.name.toLowerCase()}`}
                      required={field.required}
                      data-testid={`input-custom-${field.name.toLowerCase().replace(/\\s+/g, '-')}`}
                    />
                  ) : (
                    <Input
                      id={`custom-${field.name}`}
                      type="text"
                      value={customFieldsData[field.name] || ""}
                      onChange={(e) => setCustomFieldsData({
                        ...customFieldsData,
                        [field.name]: e.target.value
                      })}
                      placeholder={`Ingrese ${field.name.toLowerCase()}`}
                      required={field.required}
                      data-testid={`input-custom-${field.name.toLowerCase().replace(/\\s+/g, '-')}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="flex-1"
                data-testid="button-save-lote"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {lote ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
