import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import GestaoPage from "./pages/GestaoPage";
import AdminPage from "./pages/AdminPage";
import ConsolidarPage from "./pages/ConsolidarPage";
import PlanosPage from "./pages/PlanosPage";
import CompletarPerfilPage from "./pages/CompletarPerfilPage";
import PreviewHubPage, { PreviewCompletarPerfilPage } from "./pages/PreviewHubPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PreviewHubPage />} />
            <Route path="/vitrine" element={<Navigate to="/" replace />} />
            <Route path="/vitrine/completar-perfil" element={<PreviewCompletarPerfilPage />} />
            <Route path="/vitrine/dashboard" element={<DashboardPage />} />
            <Route path="/vitrine/gestao" element={<GestaoPage />} />
            <Route path="/vitrine/admin" element={<AdminPage />} />
            <Route path="/vitrine/consolidar" element={<ConsolidarPage />} />
            <Route path="/preview" element={<Navigate to="/" replace />} />
            <Route path="/preview/completar-perfil" element={<Navigate to="/vitrine/completar-perfil" replace />} />
            <Route path="/preview/dashboard" element={<Navigate to="/vitrine/dashboard" replace />} />
            <Route path="/preview/gestao" element={<Navigate to="/vitrine/gestao" replace />} />
            <Route path="/preview/admin" element={<Navigate to="/vitrine/admin" replace />} />
            <Route path="/preview/consolidar" element={<Navigate to="/vitrine/consolidar" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/planos" element={<PlanosPage />} />
            <Route path="/completar-perfil" element={<ProtectedRoute skipProfileCheck><CompletarPerfilPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/gestao" element={<ProtectedRoute><GestaoPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/consolidar" element={<ProtectedRoute><ConsolidarPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
