import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const forgotPasswordSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onBackToLogin?: () => void;
  className?: string;
}

export function ForgotPasswordForm({
  onSuccess,
  onBackToLogin,
  className,
}: ForgotPasswordFormProps) {
  const { resetPassword, loading } = useAuth();
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await resetPassword(data.email);
      setEmailSent(true);
      toast({
        title: 'Correo enviado',
        description: 'Hemos enviado un correo para restablecer tu contraseña',
      });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al enviar el correo de restablecimiento',
        variant: 'destructive',
      });
    }
  };

  if (emailSent) {
    return (
      <div className={cn('text-center', className)}>
        <div className="mb-6 rounded-full bg-green-100 p-3 inline-block">
          <Icons.checkCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Revisa tu correo</h2>
        <p className="text-muted-foreground mb-6">
          Hemos enviado un enlace para restablecer tu contraseña a tu dirección de correo electrónico.
        </p>
        <Button onClick={onBackToLogin} className="w-full">
          Volver al inicio de sesión
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-6', className)}>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">¿Olvidaste tu contraseña?</h2>
        <p className="text-muted-foreground mb-6">
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            placeholder="nombre@ejemplo.com"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={loading}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
          Enviar enlace
        </Button>
      </form>
      <div className="text-center text-sm">
        <button
          type="button"
          onClick={onBackToLogin}
          className="font-medium text-primary hover:underline"
          disabled={loading}
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}
