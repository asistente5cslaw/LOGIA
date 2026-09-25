import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';

import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { RegisterIdentityPage } from '@/pages/RegisterIdentityPage';
import { RegisterConfirmationPage } from '@/pages/RegisterConfirmationPage';
import { DashboardPage } from '@/pages/app/DashboardPage';
import { CalendarPage } from '@/pages/app/CalendarPage';
import { MinutesPage } from '@/pages/app/MinutesPage';
import { AttendancePage } from '@/pages/app/AttendancePage';
import { MembersPage } from '@/pages/app/MembersPage';
import { ErrorPage } from '@/pages/ErrorPage';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <ErrorPage /> },
  {
    path: '/login',
    element: <AuthLayout backTo="/"><LoginPage /></AuthLayout>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/registro',
    element: <AuthLayout backTo="/"><RegisterPage /></AuthLayout>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/registro/identidad',
    element: <AuthLayout backTo="/registro"><RegisterIdentityPage /></AuthLayout>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/registro/confirmacion',
    element: <AuthLayout showBack={false}><RegisterConfirmationPage /></AuthLayout>,
    errorElement: <ErrorPage />,
  },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'calendario', element: <CalendarPage /> },
      { path: 'actas', element: <MinutesPage /> },
      { path: 'asistencia', element: <AttendancePage /> },
      { path: 'miembros', element: <MembersPage /> },
      { path: 'ajustes', element: <Navigate to="/app" replace /> },
    ],
  },
  // Catch-all: cualquier ruta desconocida
  { path: '*', element: <ErrorPage /> },
]);
