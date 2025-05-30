import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'error' | 'success' | 'info';
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 5000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'error':
                return <AlertCircle className="w-6 h-6 text-red-500" />;
            case 'success':
                return <CheckCircle2 className="w-6 h-6 text-green-500" />;
            default:
                return null;
        }
    };

    const getBackgroundColor = () => {
        switch (type) {
            case 'error':
                return 'bg-red-50 border-red-200';
            case 'success':
                return 'bg-green-50 border-green-200';
            default:
                return 'bg-gray-50 border-gray-200';
        }
    };

    const getTextColor = () => {
        switch (type) {
            case 'error':
                return 'text-red-800';
            case 'success':
                return 'text-green-800';
            default:
                return 'text-gray-800';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-50">
            <div className={`flex items-center p-4 rounded-lg shadow-lg border ${getBackgroundColor()} max-w-md animate-slide-up`}>
                <div className="flex items-center">
                    {getIcon()}
                    <p className={`ml-3 text-sm font-medium ${getTextColor()}`}>{message}</p>
                </div>
                <button
                    onClick={onClose}
                    className="ml-6 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default Toast; 