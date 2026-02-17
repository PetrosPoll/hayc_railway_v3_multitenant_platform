import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/ui/authContext";
import { Eye, EyeOff } from "lucide-react";


const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  phone: z.string().min(10, "Phone number must be at least 10 characters").optional(),
});

type FormData = z.infer<typeof schema>;

export default function Auth() {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      username: "",
      phone: ""
    }
  });

  const authMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const endpoint = isRegistering ? "/api/register" : "/api/login";
      const response = await apiRequest("POST", endpoint, data);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      toast({
        title: isRegistering ? t("auth.registrationSuccessful") : t("auth.loginSuccessful"),
        description: t("auth.welcome")
      });
      // Add a small delay to show the toast before redirecting
      setTimeout(() => {
        // Redirect based on user role: staff go to admin, subscribers go to dashboard
        const redirectPath = data.user?.role !== 'subscriber' ? '/admin' : '/dashboard';
        window.location.href = redirectPath;
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: isRegistering ? t("auth.registrationFailed") : t("auth.loginFailed"),
        // description: error.message || t("auth.invalidCredentials"),
        variant: "destructive",
      });

      form.reset();
    }
  });

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // Redirect based on user role if already authenticated
  if (user) {
    const redirectPath = user.role !== 'subscriber' ? '/admin' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  const onSubmit = async (formData: FormData) => {
    try {
      if (authMutation.isPending) {
        return;
      }
      await authMutation.mutateAsync(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isRegistering ? t('auth.register') : t('auth.login')}</CardTitle>
          {/*CardDescription removed as it wasn't in the original code and the changes didn't provide a proper translation replacement*/}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const data = form.getValues();
                onSubmit(data);
              }} 
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.email')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="your@email.com" 
                        {...field}
                        disabled={authMutation.isPending} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* {isRegistering && (
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.username')}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="username" 
                          {...field}
                          disabled={authMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {isRegistering && (
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{"Phone"}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="phone" 
                          {...field}
                          disabled={authMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )} */}

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="your password" 
                          {...field}
                          disabled={authMutation.isPending}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          disabled={authMutation.isPending}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          data-testid="button-toggle-password-visibility"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isRegistering && (
                <div className="text-right">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-primary hover:underline"
                    data-testid="link-forgot-password"
                  >
                    {t('auth.forgotPassword') || 'Forgot Password?'}
                  </Link>
                </div>
              )}

              <Button 
                type="submit"
                className="w-full" 
                disabled={authMutation.isPending}
              >
                {authMutation.isPending ? t('auth.processing') : (isRegistering ? t('auth.register') : t('auth.login'))}
              </Button>

              {/* <p className="text-center text-sm text-muted-foreground mt-4">
                {isRegistering ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}{" "}
                <Button 
                  variant="link" 
                  className="p-0" 
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    form.reset();
                    authMutation.reset();
                  }}
                  type="button"
                  disabled={authMutation.isPending}
                >
                  {isRegistering ? t('auth.loginLink') : t('auth.registerLink')}
                </Button>
              </p> */}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}