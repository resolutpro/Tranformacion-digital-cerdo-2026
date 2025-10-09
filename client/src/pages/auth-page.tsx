import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Footer } from "@/components/layout/footer";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ 
    username: "", 
    email: "", 
    password: "", 
    confirmPassword: "",
    organizationName: "",
    organizationEmail: ""
  });

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      return;
    }
    registerMutation.mutate({
      username: registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
      organizationName: registerForm.organizationName,
      organizationEmail: registerForm.organizationEmail
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center min-h-screen">
          {/* Left side - Auth forms */}
          <div className="max-w-md mx-auto w-full">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                {/* Pig SVG Icon */}
                <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 100 100">
                  <path d="M50,15 C65,15 78,25 78,38 C78,45 75,50 70,53 L70,60 C70,70 62,78 50,78 C38,78 30,70 30,60 L30,53 C25,50 22,45 22,38 C22,25 35,15 50,15 Z"/>
                  <circle cx="42" cy="35" r="3" fill="white"/>
                  <circle cx="58" cy="35" r="3" fill="white"/>
                  <ellipse cx="50" cy="45" rx="8" ry="5" fill="white" opacity="0.8"/>
                  <circle cx="46" cy="43" r="1.5" fill="currentColor"/>
                  <circle cx="54" cy="43" r="1.5" fill="currentColor"/>
                  <path d="M35,25 Q30,20 25,25 Q30,30 35,25" fill="currentColor"/>
                  <path d="M65,25 Q70,20 75,25 Q70,30 65,25" fill="currentColor"/>
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Gemelo Digital</h1>
              <p className="text-muted-foreground">Sistema de Trazabilidad del Cerdo Ibérico</p>
            </div>

            {/* Auth Forms */}
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="register">Registrarse</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <Card>
                  <CardHeader>
                    <CardTitle>Iniciar Sesión</CardTitle>
                    <CardDescription>
                      Ingresa a tu cuenta para acceder al sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Correo electrónico</Label>
                        <Input
                          id="login-email"
                          type="email"
                          data-testid="input-login-email"
                          placeholder="usuario@empresa.com"
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Contraseña</Label>
                        <Input
                          id="login-password"
                          type="password"
                          data-testid="input-login-password"
                          placeholder="••••••••"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          required
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full"
                        data-testid="button-login"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Iniciar sesión
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="register">
                <Card>
                  <CardHeader>
                    <CardTitle>Crear Cuenta</CardTitle>
                    <CardDescription>
                      Registra tu organización en el sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="register-username">Usuario</Label>
                          <Input
                            id="register-username"
                            data-testid="input-register-username"
                            placeholder="usuario"
                            value={registerForm.username}
                            onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-email">Email personal</Label>
                          <Input
                            id="register-email"
                            type="email"
                            data-testid="input-register-email"
                            placeholder="tu@email.com"
                            value={registerForm.email}
                            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-org-name">Nombre de la organización</Label>
                        <Input
                          id="register-org-name"
                          data-testid="input-register-org-name"
                          placeholder="Jamones Ibéricos SA"
                          value={registerForm.organizationName}
                          onChange={(e) => setRegisterForm({ ...registerForm, organizationName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-org-email">Email de la organización</Label>
                        <Input
                          id="register-org-email"
                          type="email"
                          data-testid="input-register-org-email"
                          placeholder="contacto@empresa.com"
                          value={registerForm.organizationEmail}
                          onChange={(e) => setRegisterForm({ ...registerForm, organizationEmail: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="register-password">Contraseña</Label>
                          <Input
                            id="register-password"
                            type="password"
                            data-testid="input-register-password"
                            placeholder="••••••••"
                            value={registerForm.password}
                            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-confirm">Confirmar contraseña</Label>
                          <Input
                            id="register-confirm"
                            type="password"
                            data-testid="input-register-confirm"
                            placeholder="••••••••"
                            value={registerForm.confirmPassword}
                            onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full"
                        data-testid="button-register"
                        disabled={registerMutation.isPending || registerForm.password !== registerForm.confirmPassword}
                      >
                        {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Crear cuenta
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right side - Hero section */}
          <div className="hidden lg:block">
            <div className="text-center space-y-6">
              <div className="mb-8">
                {/* Large decorative pig illustration */}
                <div className="mx-auto w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="h-20 w-20 text-blue-600" fill="currentColor" viewBox="0 0 100 100">
                    <path d="M50,15 C65,15 78,25 78,38 C78,45 75,50 70,53 L70,60 C70,70 62,78 50,78 C38,78 30,70 30,60 L30,53 C25,50 22,45 22,38 C22,25 35,15 50,15 Z"/>
                    <circle cx="42" cy="35" r="3" fill="white"/>
                    <circle cx="58" cy="35" r="3" fill="white"/>
                    <ellipse cx="50" cy="45" rx="8" ry="5" fill="white" opacity="0.8"/>
                    <circle cx="46" cy="43" r="1.5" fill="currentColor"/>
                    <circle cx="54" cy="43" r="1.5" fill="currentColor"/>
                    <path d="M35,25 Q30,20 25,25 Q30,30 35,25" fill="currentColor"/>
                    <path d="M65,25 Q70,20 75,25 Q70,30 65,25" fill="currentColor"/>
                  </svg>
                </div>
              </div>
              
              <h2 className="text-4xl font-bold text-foreground">
                Trazabilidad Completa del Cerdo Ibérico
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Monitorea cada etapa de producción desde la cría hasta la distribución 
                con sensores IoT y códigos QR para el consumidor final.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-12">
                <div className="text-center p-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Seguimiento IoT</h3>
                  <p className="text-sm text-muted-foreground">Monitoreo 24/7 con sensores de temperatura y humedad</p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Trazabilidad</h3>
                  <p className="text-sm text-muted-foreground">Seguimiento completo desde cría hasta distribución</p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                      <rect x="14" y="3" width="7" height="7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                      <rect x="14" y="14" width="7" height="7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                      <path d="M5 5h2v2H5V5zm8 0h2v2h-2V5zm8 8h2v2h-2v-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                      <path d="M3 14h4m0 4v4m4-4h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">Certificación QR</h3>
                  <p className="text-sm text-muted-foreground">Códigos QR públicos para transparencia total</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
