
export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center">
          <img 
            src="/footer-logos.png" 
            alt="Financiado por la Unión Europea, Ministerio para la Transformación Digital y de la Función Pública, Plan de Recuperación Transformación y Resiliencia, Junta de Extremadura" 
            className="h-16 md:h-20 lg:h-24 w-auto object-contain max-w-full"
          />
        </div>
      </div>
    </footer>
  );
}
