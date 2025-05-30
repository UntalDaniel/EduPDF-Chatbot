import React from 'react';
import { RegisterForm } from '@/components/auth/forms/RegisterForm';
import { Link } from 'react-router-dom';

const RegisterScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Crear cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          O{' '}
          <Link 
            to="/login" 
            className="font-medium text-sky-600 hover:text-sky-500"
          >
            inicia sesión si ya tienes una cuenta
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <RegisterForm 
            onSuccess={() => window.location.href = '/dashboard'}
          />
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;
