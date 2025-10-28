
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
                <p className="text-foreground">
                  Gemelo Digital Ibérico – Trazabilidad y Eficiencia en la Cadena del Cerdo Ibérico.
                </p>
              </div>
            </section>

            {/* Descripción */}
            <section>
              <h2 className="text-xl font-semibold mb-3 text-primary">
                DESCRIPCIÓN DE LA OPERACIÓN/PROYECTO
              </h2>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-foreground leading-relaxed">
                  El proyecto consiste en el diseño e implementación de un gemelo digital de bajo coste que replica en tiempo casi real los procesos críticos del cerdo ibérico, abarcando desde la cría y el engorde hasta el matadero, el secadero y la distribución. La solución se integra con sensores IoT para capturar parámetros ambientales y operativos, registra los eventos clave en una blockchain de código abierto para asegurar la trazabilidad y la integridad de la información, y pone a disposición cuadros de mando interactivos que facilitan el análisis, la simulación de escenarios y la toma de decisiones basada en datos. La estrategia prioriza el uso de tecnologías existentes para minimizar costes, asegurar la escalabilidad y acelerar la adopción en entornos rurales.
                </p>
              </div>
            </section>

            {/* Objetivos */}
            <section>
              <h2 className="text-xl font-semibold mb-3 text-primary">
                OBJETIVOS
              </h2>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-foreground leading-relaxed">
                  El proyecto persigue mejorar la trazabilidad del producto "de la dehesa al consumidor" mediante un registro inmutable y verificable; optimizar la eficiencia operativa reduciendo errores manuales y habilitando decisiones ágiles con métricas en tiempo real; fomentar la innovación y la competitividad del sector a través de la adopción de IoT, blockchain y analítica abierta; y contribuir a la modernización del tejido productivo rural con soluciones digitales de bajo coste y alto impacto.
                </p>
              </div>
            </section>

            {/* Resultados Previstos */}
            <section>
              <h2 className="text-xl font-semibold mb-3 text-primary">
                RESULTADOS PREVISTOS
              </h2>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-foreground leading-relaxed">
                  Se espera disponer de una plataforma operativa de gemelo digital que integre ingesta IoT (temperatura, humedad, localización y eventos de proceso), un libro mayor de trazabilidad en blockchain de código abierto para altas, transformaciones y transferencias de lotes, y paneles de control con indicadores clave y simulación de escenarios. El piloto cubrirá al menos tres eslabones de la cadena (por ejemplo, engorde, matadero y secadero) con lotes reales, y tendrá como objetivos iniciales registrar el 90% o más de los eventos críticos con sello temporal verificable, reducir la latencia media desde la captura hasta la visualización a cinco minutos o menos y disminuir en torno a un 30% los errores de registro frente al proceso manual de referencia. Además, se elaborará una guía de uso y se impartirán dos sesiones formativas al personal implicado.
                </p>
              </div>
            </section>

            {/* Información Financiera */}
            <section className="border-t pt-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">PRESUPUESTO</h3>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-foreground font-semibold">
                      37.500 euros
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">AYUDA RECIBIDA</h3>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-foreground font-semibold">
                      30.000 euros
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold mb-2">FONDO/PROGRAMA</h3>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-foreground leading-relaxed">
                    Ayudas destinadas a la aceleración de ecosistemas de emprendimiento e innovación basados en Gemelos Digitales del programa Redes Territoriales de Especialización Tecnológica (RETECH) en el marco del Plan de Recuperación, Transformación y Resiliencia.
                  </p>
                </div>
              </div>
            </section>

            {/* Nota informativa */}
            <section className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Nota:</strong> Esta información corresponde al proyecto de Gemelo Digital Ibérico financiado por el Plan de Recuperación, Transformación y Resiliencia de la Unión Europea.
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
