import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { FirebaseUserType } from '../types/firebaseTypes';

export const useAuth = () => {
    const [user, setUser] = useState<FirebaseUserType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            throw error;
        }
    };

    const isEmailVerified = () => {
        return user?.emailVerified || false;
    };

    return {
        user,
        loading,
        logout,
        isEmailVerified
    };
}; 