import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, useAuthProvider, useAuth } from './hooks/useAuth';
import { ThemeContext, useThemeProvider } from './hooks/useTheme';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Notes from './pages/Notes';
import Calendar from './pages/Calendar';
import Todos from './pages/Todos';
import CoffeeTimer from './pages/CoffeeTimer';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error) => {
        const axiosError = error as { response?: { status?: number } };
        if (
          axiosError?.response?.status === 401 ||
          axiosError?.response?.status === 403
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/notes" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/notes" replace />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="notes" element={<Notes />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="todos" element={<Todos />} />
        <Route path="coffee" element={<CoffeeTimer />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthProvider();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeProvider();
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <AppRoutes />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
