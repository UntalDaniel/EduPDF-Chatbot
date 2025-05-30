import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthScreen from '../screens/AuthScreen';
import StudentAuthScreen from '../screens/StudentAuthScreen';
import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import StudentDashboard from '../screens/student/StudentDashboard';
import ChatWithPdfScreen from '../screens/ChatWithPdfScreen';
import CreateActivityScreen from '../screens/teacher/CreateActivityScreen';
import CreateExamScreen from '../screens/teacher/CreateExamScreen';
import ViewExamScreen from '../screens/student/ViewExamScreen';
import ViewActivityScreen from '../screens/student/ViewActivityScreen';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireEmailVerification?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
    children, 
    requireEmailVerification = true 
}) => {
    const { user, loading, isEmailVerified } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    if (requireEmailVerification && !isEmailVerified()) {
        return <Navigate to="/auth" replace state={{ requireVerification: true }} />;
    }

    return <>{children}</>;
};

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/auth" element={<AuthScreen />} />
            <Route path="/student-auth" element={<StudentAuthScreen />} />
            
            {/* Rutas protegidas para profesores */}
            <Route
                path="/teacher"
                element={
                    <ProtectedRoute>
                        <TeacherDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/create-activity"
                element={
                    <ProtectedRoute>
                        <CreateActivityScreen />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/create-exam"
                element={
                    <ProtectedRoute>
                        <CreateExamScreen />
                    </ProtectedRoute>
                }
            />

            {/* Rutas protegidas para estudiantes */}
            <Route
                path="/student"
                element={
                    <ProtectedRoute requireEmailVerification={false}>
                        <StudentDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/student/view-exam/:examId"
                element={
                    <ProtectedRoute requireEmailVerification={false}>
                        <ViewExamScreen />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/student/view-activity/:activityId"
                element={
                    <ProtectedRoute requireEmailVerification={false}>
                        <ViewActivityScreen />
                    </ProtectedRoute>
                }
            />

            {/* Ruta del chat protegida */}
            <Route
                path="/chat"
                element={
                    <ProtectedRoute>
                        <ChatWithPdfScreen />
                    </ProtectedRoute>
                }
            />

            {/* Ruta por defecto */}
            <Route path="/" element={<Navigate to="/auth" replace />} />
        </Routes>
    );
};

export default AppRoutes; 