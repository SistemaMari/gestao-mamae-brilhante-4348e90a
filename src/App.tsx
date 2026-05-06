import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShellClinico from "@/components/AppShellClinico";
import PlanoGuard from "@/components/PlanoGuard";
import LoginPage from "./pages/LoginPage";
import RecuperarSenhaPage from "./pages/RecuperarSenhaPage";
import NovaSenhaPage from "./pages/NovaSenhaPage";

import DashboardPage from "./pages/DashboardPage";
import DashboardMetricasPage from "./pages/DashboardMetricasPage";
import GestaoPage from "./pages/GestaoPage";
import AdminLayout from "./pages/admin/AdminLayout";
import VisaoGeralPage from "./pages/admin/VisaoGeralPage";
import DiagnosticosPage from "./pages/admin/DiagnosticosPage";
import ExportarPage from "./pages/admin/ExportarPage";
import AdminsPage from "./pages/admin/AdminsPage";
import InstitucionaisPage from "./pages/admin/InstitucionaisPage";
import ProfissionaisConsultorioPage from "./pages/admin/ProfissionaisConsultorioPage";
import ConsolidarPage from "./pages/ConsolidarPage";
import PlanosPage from "./pages/PlanosPage";
import CompletarPerfilPage from "./pages/CompletarPerfilPage";
import GestaoEquipePage from "./pages/GestaoEquipePage";
import CadastroConvitePage from "./pages/CadastroConvitePage";

import AppShellGestor from "@/components/gestor/AppShellGestor";
import AppShellGestorGeral from "@/components/gestor-geral/AppShellGestorGeral";
import StubEmConstrucao from "@/components/StubEmConstrucao";
import FichasUnidadePage from "./pages/gestao/FichasUnidadePage";
import OnboardingPage from "./pages/OnboardingPage";
import PacientePage from "./pages/PacientePage";
import MeusCursosPage from "./pages/MeusCursosPage";
import PerfilPage from "./pages/PerfilPage";
import HistoricoLaudosPage from "./pages/HistoricoLaudosPage";
import LaudoViewerPage from "./pages/LaudoViewerPage";
import NotFound from "./pages/NotFound";
import PreviewHubPage, {
  PreviewCompletarPerfilPage,
  PreviewGestaoEquipePage,
  PreviewCadastroConvitePage,
} from "./pages/PreviewHubPage";
import PreviewAppShell from "./components/PreviewAppShell";
import PreviewAdminLayout from "./pages/admin/PreviewAdminLayout";
import ComponentesDemoPage from "./pages/_dev/ComponentesDemoPage";
import FichaCarimbadaDemo from "./pages/_dev/FichaCarimbadaDemo";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Domínio raiz redireciona para login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
            <Route path="/nova-senha" element={<NovaSenhaPage />} />
            <Route path="/reset-password" element={<Navigate to="/nova-senha" replace />} />
            <Route path="/convite/:token" element={<CadastroConvitePage />} />

            {/* Vitrine pública (sem login) — acessível por URL direta */}
            <Route path="/vitrine" element={<PreviewHubPage />} />
            <Route path="/vitrine/completar-perfil" element={<PreviewCompletarPerfilPage />} />
            <Route element={<AppShellGestor />}>
              <Route path="/vitrine/gestao" element={<GestaoPage />} />
              <Route path="/vitrine/gestao/equipe" element={<PreviewGestaoEquipePage />} />
              <Route path="/vitrine/gestao/fichas" element={<FichasUnidadePage />} />
              <Route path="/vitrine/gestao/fichas/:id" element={<PacientePage />} />
              <Route path="/vitrine/gestao/configuracoes" element={<StubEmConstrucao titulo="Configurações" />} />
            </Route>
            <Route element={<AppShellGestorGeral />}>
              <Route path="/vitrine/consolidar" element={<ConsolidarPage />} />
              <Route path="/vitrine/consolidar/configuracoes" element={<StubEmConstrucao titulo="Configurações" />} />
            </Route>
            <Route path="/vitrine/cadastro-convite" element={<PreviewCadastroConvitePage />} />
            <Route path="/vitrine/ficha-carimbada" element={<FichaCarimbadaDemo />} />

            {/* Vitrine com App Shell de demonstração */}
            <Route element={<PreviewAppShell />}>
              <Route path="/vitrine/dashboard" element={<DashboardPage />} />
              <Route path="/vitrine/dashboard/metricas" element={<DashboardMetricasPage />} />
              <Route path="/vitrine/paciente/nova" element={<PacientePage />} />
              <Route path="/vitrine/paciente/:id" element={<PacientePage />} />
              <Route path="/vitrine/laudos" element={<HistoricoLaudosPage />} />
              <Route path="/vitrine/laudo/:id" element={<LaudoViewerPage />} />
              <Route path="/vitrine/meus-cursos" element={<MeusCursosPage />} />
              <Route path="/vitrine/planos" element={<PlanosPage />} />
              <Route path="/vitrine/perfil" element={<PerfilPage />} />
            </Route>

            {/* Vitrine do painel admin (sem auth) */}
            <Route element={<PreviewAdminLayout />}>
              <Route path="/vitrine/admin" element={<VisaoGeralPage />} />
              <Route path="/vitrine/admin/diagnosticos" element={<DiagnosticosPage />} />
              <Route path="/vitrine/admin/exportar" element={<ExportarPage />} />
              <Route path="/vitrine/admin/admins" element={<AdminsPage />} />
              <Route path="/vitrine/admin/institucionais" element={<InstitucionaisPage />} />
            </Route>

            {/* Vitrine de componentes admin (sem layout/auth) — AJ1 */}
            <Route path="/vitrine/admin/componentes" element={<ComponentesDemoPage />} />

            {/* App Shell do profissional clínico — rotas clínicas (consultorio + institucional) */}
            <Route element={<ProtectedRoute allowedProfiles={['consultorio', 'institucional']}><AppShellClinico /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/dashboard/metricas"
                element={
                  <PlanoGuard
                    planosPermitidos={['profissional']}
                    nomePlanoNecessario="Profissional"
                    titulo="Dashboard analítico"
                    descricao="Acompanhe métricas avançadas do seu consultório: evolução de pacientes, taxas de controle, desfechos. Disponível no plano Profissional."
                  >
                    <DashboardMetricasPage />
                  </PlanoGuard>
                }
              />
              <Route path="/paciente/nova" element={<PacientePage />} />
              <Route path="/paciente/:id" element={<PacientePage />} />
              <Route path="/laudos" element={<HistoricoLaudosPage />} />
              <Route path="/laudo/:id" element={<LaudoViewerPage />} />
              <Route path="/meus-cursos" element={<MeusCursosPage />} />
            </Route>

            {/* Planos — exclusivo do consultório */}
            <Route element={<ProtectedRoute allowedProfiles={['consultorio']}><AppShellClinico /></ProtectedRoute>}>
              <Route path="/planos" element={<PlanosPage />} />
            </Route>

            {/* Perfil — todos os perfis autenticados */}
            <Route element={<ProtectedRoute allowedProfiles={['consultorio', 'institucional', 'gestor', 'gestor_geral', 'admin']}><AppShellClinico /></ProtectedRoute>}>
              <Route path="/perfil" element={<PerfilPage />} />
            </Route>

            {/* Onboarding (autenticado, sem perfil ainda) */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute skipProfileCheck skipOnboardingRedirect>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* Completar perfil (apenas consultório/institucional precisam completar cadastro) */}
            <Route element={<ProtectedRoute skipProfileCheck allowedProfiles={['consultorio', 'institucional']}><AppShellClinico /></ProtectedRoute>}>
              <Route path="/completar-perfil" element={<CompletarPerfilPage />} />
            </Route>

            {/* Rotas que NÃO usam o shell clínico — com role guards */}
            {/* Gestor de Unidade — shell dedicado */}
            <Route element={<ProtectedRoute allowedProfiles={['gestor']}><AppShellGestor /></ProtectedRoute>}>
              <Route path="/gestao" element={<GestaoPage />} />
              <Route path="/gestao/equipe" element={<GestaoEquipePage />} />
              <Route path="/gestao/fichas" element={<FichasUnidadePage />} />
              <Route path="/gestao/fichas/:id" element={<PacientePage />} />
              <Route path="/gestao/configuracoes" element={<StubEmConstrucao titulo="Configurações" />} />
            </Route>
            {/* Painel Administrativo (Prompt 22) */}
            <Route element={<ProtectedRoute allowedProfiles={['admin']}><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<VisaoGeralPage />} />
              <Route path="/admin/diagnosticos" element={<DiagnosticosPage />} />
              <Route path="/admin/exportar" element={<ExportarPage />} />
              <Route path="/admin/admins" element={<AdminsPage />} />
              <Route path="/admin/institucionais" element={<InstitucionaisPage />} />
              <Route path="/admin/profissionais" element={<ProfissionaisConsultorioPage />} />
            </Route>
            {/* Gestor Geral — shell dedicado. /consolidar é exclusivo de gestor_geral.
                Dívida técnica: criar /admin/consolidar futuramente para suporte/debug do admin. */}
            <Route element={<ProtectedRoute allowedProfiles={['gestor_geral']}><AppShellGestorGeral /></ProtectedRoute>}>
              <Route path="/consolidar" element={<ConsolidarPage />} />
              <Route path="/consolidar/configuracoes" element={<StubEmConstrucao titulo="Configurações" />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
