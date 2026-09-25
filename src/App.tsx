import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes/router';
import { AuthProvider } from '@/hooks/useAuth';
import { AppleDialogProvider } from '@/components/shared/AppleDialog';
import { Toaster } from '@/components/ui/sonner';
import './App.css';

export function App() {
  return (
    <AuthProvider>
      <AppleDialogProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </AppleDialogProvider>
    </AuthProvider>
  );
}

export default App;
