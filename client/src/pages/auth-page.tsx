import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Microchip } from "lucide-react";

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
              <div className="mx-auto w-20 h-20 bg-primary rounded-xl flex items-center justify-center mb-4">
                <Microchip className="h-8 w-8 text-primary-foreground" />
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
              <h2 className="text-4xl font-bold text-foreground">
                Trazabilidad Completa del Cerdo Ibérico
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Monitorea cada etapa de producción desde la cría hasta la distribución 
                con sensores IoT y códigos QR para el consumidor final.
              </p>
              <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto mt-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground">Seguimiento en Tiempo Real</h3>
                  <p className="text-sm text-muted-foreground">Monitorea condiciones ambientales 24/7</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground">Certificación QR</h3>
                  <p className="text-sm text-muted-foreground">Códigos QR públicos para el consumidor</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
