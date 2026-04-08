import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShellClinico from "@/components/AppShellClinico";
import LoginPage from "./pages/LoginPage";
import RecuperarSenhaPage from "./pages/RecuperarSenhaPage";
import NovaSenhaPage from "./pages/NovaSenhaPage";

import DashboardPage from "./pages/DashboardPage";
import GestaoPage from "./pages/GestaoPage";
import AdminPage from "./pages/AdminPage";
import ConsolidarPage from "./pages/ConsolidarPage";
import PlanosPage from "./pages/PlanosPage";
import CompletarPerfilPage from "./pages/CompletarPerfilPage";
import GestaoEquipePage from "./pages/GestaoEquipePage";
import CadastroConvitePage from "./pages/CadastroConvitePage";
import PreviewHubPage, {
  PreviewCompletarPerfilPage,
  PreviewGestaoEquipePage,
  PreviewCadastroConvitePage,
} from "./pages/PreviewHubPage";
import PreviewAppShell from "./components/PreviewAppShell";
import PacientePage from "./pages/PacientePage";
import PerfilPage from "./pages/PerfilPage";
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
            {/* Vitrine (preview sem login) */}
            <Route path="/" element={<PreviewHubPage />} />
            <Route path="/vitrine" element={<Navigate to="/" replace />} />
            <Route path="/vitrine/completar-perfil" element={<PreviewCompletarPerfilPage />} />
            <Route path="/vitrine/gestao" element={<GestaoPage />} />
            <Route path="/vitrine/gestao/equipe" element={<PreviewGestaoEquipePage />} />
            <Route path="/vitrine/admin" element={<AdminPage />} />
            <Route path="/vitrine/consolidar" element={<ConsolidarPage />} />
            <Route path="/vitrine/cadastro-convite" element={<PreviewCadastroConvitePage />} />

            {/* Vitrine com App Shell */}
            <Route element={<PreviewAppShell />}>
              <Route path="/vitrine/dashboard" element={<DashboardPage />} />
              <Route path="/vitrine/paciente/:id" element={<PacientePage />} />
              <Route path="/vitrine/planos" element={<PlanosPage />} />
              <Route path="/vitrine/perfil" element={<PerfilPage />} />
            </Route>

            {/* Redirects /preview → /vitrine */}
            <Route path="/preview" element={<Navigate to="/" replace />} />
            <Route path="/preview/completar-perfil" element={<Navigate to="/vitrine/completar-perfil" replace />} />
            <Route path="/preview/dashboard" element={<Navigate to="/vitrine/dashboard" replace />} />
            <Route path="/preview/gestao" element={<Navigate to="/vitrine/gestao" replace />} />
            <Route path="/preview/gestao/equipe" element={<Navigate to="/vitrine/gestao/equipe" replace />} />
            <Route path="/preview/admin" element={<Navigate to="/vitrine/admin" replace />} />
            <Route path="/preview/consolidar" element={<Navigate to="/vitrine/consolidar" replace />} />
            <Route path="/preview/cadastro-convite" element={<Navigate to="/vitrine/cadastro-convite" replace />} />

            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
            <Route path="/nova-senha" element={<NovaSenhaPage />} />
            <Route path="/reset-password" element={<Navigate to="/nova-senha" replace />} />
            <Route path="/convite/token-exemplo-preview" element={<Navigate to="/vitrine/cadastro-convite" replace />} />
            <Route path="/convite/:token" element={<CadastroConvitePage />} />

            {/* App Shell do profissional clínico */}
            <Route element={<ProtectedRoute><AppShellClinico /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/paciente/nova" element={<PacientePage />} />
              <Route path="/paciente/:id" element={<PacientePage />} />
              <Route path="/planos" element={<PlanosPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
            </Route>

            {/* Completar perfil (dentro do shell mas skip profile check) */}
            <Route element={<ProtectedRoute skipProfileCheck><AppShellClinico /></ProtectedRoute>}>
              <Route path="/completar-perfil" element={<CompletarPerfilPage />} />
            </Route>

            {/* Rotas que NÃO usam o shell clínico */}
            <Route path="/gestao" element={<ProtectedRoute><GestaoPage /></ProtectedRoute>} />
            <Route path="/gestao/equipe" element={<ProtectedRoute><GestaoEquipePage /></ProtectedRoute>} />
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
