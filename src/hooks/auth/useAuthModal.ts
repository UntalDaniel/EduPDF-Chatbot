import { useState } from 'react';
import { AuthModal } from '@/components/auth/AuthModal';

type AuthMode = 'login' | 'register' | 'forgot-password';

export function useAuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');

  const openModal = (modalMode: AuthMode = 'login') => {
    setMode(modalMode);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  const AuthModalComponent = ({
    onSuccess,
    defaultMode,
  }: {
    onSuccess?: () => void;
    defaultMode?: AuthMode;
  } = {}) => (
    <AuthModal
      open={isOpen}
      onOpenChange={setIsOpen}
      onSuccess={onSuccess}
      defaultMode={defaultMode || mode}
    />
  );

  return {
    openModal,
    closeModal,
    setMode,
    AuthModal: AuthModalComponent,
  };
}
