import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

interface AdminHeaderProps {
  nomeAdmin: string;
}

export function AdminHeader({ nomeAdmin }: AdminHeaderProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="text-[#64748B]" />
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-lg shrink-0"
            style={{ background: "linear-gradient(135deg, #9b87f5, #5EEAD4)" }}
            aria-hidden
          />
          <h1
            className="font-semibold text-[#1E293B] truncate"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            <span className="hidden md:inline">Painel Administrativo — Dra. Mari DMG Diagnóstica</span>
            <span className="md:hidden">Painel Admin</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-sm text-[#64748B]">
          Olá, <span className="text-[#1E293B] font-medium">{nomeAdmin}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </header>
  );
}
