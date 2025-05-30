import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoginForm } from './forms/LoginForm';
import { RegisterForm } from './forms/RegisterForm';
import { ForgotPasswordForm } from './forms/ForgotPasswordForm';

type AuthMode = 'login' | 'register' | 'forgot-password';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultMode?: AuthMode;
}

export function AuthModal({
  open,
  onOpenChange,
  onSuccess,
  defaultMode = 'login',
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState('');

  const handleSuccess = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  const getTitle = () => {
    switch (mode) {
      case 'login':
        return 'Iniciar sesión';
      case 'register':
        return 'Crear una cuenta';
      case 'forgot-password':
        return 'Restablecer contraseña';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">{getTitle()}</DialogTitle>
        </DialogHeader>
        
        {mode === 'login' && (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToRegister={() => setMode('register')}
            onForgotPassword={() => setMode('forgot-password')}
          />
        )}
        
        {mode === 'register' && (
          <RegisterForm
            onSuccess={handleSuccess}
            onSwitchToLogin={() => setMode('login')}
          />
        )}
        
        {mode === 'forgot-password' && (
          <ForgotPasswordForm
            onSuccess={() => setMode('login')}
            onBackToLogin={() => setMode('login')}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
