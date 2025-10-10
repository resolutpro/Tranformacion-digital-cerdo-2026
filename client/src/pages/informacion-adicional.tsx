
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function InformacionAdicional() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              Información del Proyecto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Nombre de la Operación/Proyecto */}
            <section>
              <h2 className="text-xl font-semibold mb-3 text-primary">
                NOMBRE DE LA OPERACIÓN/PROYECTO
              </h2>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-muted-foreground italic">
                  [Nombre del proyecto a completar]
                </p>
              </div>
            </section>

            {/* Descripción */}
            <section>
              <h2 className="text-xl font-semibold mb-3 text-primary">
                DESCRIPCIÓN DE LA OPERACIÓN/PROYECTO
              </h2>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-muted-foreground italic">
                  [Descripción detallada del proyecto a completar]
                </p>
              </div>
            </section>

            {/* Objetivos */}
            <section>
              <h2 className="text-xl font-semibold mb-3 text-primary">
                OBJETIVOS
              </h2>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-muted-foreground italic">
                  [Objetivos del proyecto a completar]
                </p>
              </div>
            </section>

            {/* Resultados Previstos */}
            <section>
              <h2 className="text-xl font-semibold mb-3 text-primary">
                RESULTADOS PREVISTOS
              </h2>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-muted-foreground italic">
                  [Resultados esperados del proyecto a completar]
                </p>
              </div>
            </section>

            {/* Información Financiera */}
            <section className="border-t pt-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">PRESUPUESTO</h3>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-muted-foreground italic">
                      _________ euros
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">AYUDA RECIBIDA</h3>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-muted-foreground italic">
                      _________ euros
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold mb-2">FONDO/PROGRAMA</h3>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-muted-foreground italic">
                    [Nombre del fondo o programa a completar]
                  </p>
                </div>
              </div>
            </section>

            {/* Nota informativa */}
            <section className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Nota:</strong> Esta información será completada con los datos específicos del proyecto.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
