
export function Footer() {
  // En desarrollo, Vite necesita que importemos las imágenes
  const footerLogoUrl = '/footer-logos.png';
  
  console.log('[FOOTER] Renderizando footer con imagen:', footerLogoUrl);
  console.log('[FOOTER] Base URL:', window.location.origin);
  console.log('[FOOTER] Ruta completa esperada:', window.location.origin + footerLogoUrl);

  return (
    <footer className="border-t border-border bg-card mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center items-center">
          <img 
            src={footerLogoUrl}
            alt="Financiado por la Unión Europea, Ministerio para la Transformación Digital y de la Función Pública, Plan de Recuperación Transformación y Resiliencia, Junta de Extremadura" 
            className="h-16 md:h-20 lg:h-24 w-auto object-contain max-w-full"
            onLoad={(e) => {
              console.log('[FOOTER] ✅ Imagen cargada correctamente:', e.currentTarget.src);
              console.log('[FOOTER] Dimensiones naturales:', e.currentTarget.naturalWidth, 'x', e.currentTarget.naturalHeight);
            }}
            onError={(e) => {
              console.error('[FOOTER] ❌ Error cargando imagen');
              console.error('[FOOTER] Ruta intentada:', e.currentTarget.src);
              console.error('[FOOTER] Tipo de error:', e.type);
              
              // Intentar rutas alternativas
              const alternatives = [
                './footer-logos.png',
                '../public/footer-logos.png',
                'footer-logos.png'
              ];
              
              console.error('[FOOTER] Rutas alternativas a probar:', alternatives);
              e.currentTarget.alt = 'Financiado por la Unión Europea - Next Generation EU';
            }}
          />
        </div>
      </div>
    </footer>
  );
}
