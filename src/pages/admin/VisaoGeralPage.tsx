import { useEffect, useState } from "react";
import { CardResumo } from "@/components/admin/CardResumo";
import { PlaceholderSecao } from "@/components/admin/PlaceholderSecao";
import { supabase } from "@/integrations/supabase/client";

interface Resumo {
  profissionais: number | null;
  unidades: number | null;
  pacientes: number | null;
  laudos: number | null;
}

export default function VisaoGeralPage() {
  const [resumo, setResumo] = useState<Resumo>({
    profissionais: null,
    unidades: null,
    pacientes: null,
    laudos: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      const [profs, unids, pacs, lauds] = await Promise.all([
        supabase.from("profissionais").select("*", { count: "exact", head: true }),
        supabase.from("unidades").select("*", { count: "exact", head: true }),
        supabase.from("pacientes").select("*", { count: "exact", head: true }),
        // Nota: Prompt 22 cita "laudos_historico"; tabela real é "laudos".
        supabase.from("laudos").select("*", { count: "exact", head: true }),
      ]);

      if (cancelado) return;

      setResumo({
        profissionais: profs.count ?? 0,
        unidades: unids.count ?? 0,
        pacientes: pacs.count ?? 0,
        laudos: lauds.count ?? 0,
      });
      setLoading(false);
    };

    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2
          className="text-2xl font-semibold mb-1"
          style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
        >
          Visão Geral
        </h2>
        <p className="text-sm" style={{ color: "#64748B" }}>
          Resumo rápido do sistema.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardResumo label="Total de profissionais" valor={resumo.profissionais} loading={loading} />
        <CardResumo label="Total de unidades" valor={resumo.unidades} loading={loading} />
        <CardResumo label="Total de pacientes" valor={resumo.pacientes} loading={loading} />
        <CardResumo label="Total de laudos gerados" valor={resumo.laudos} loading={loading} />
      </div>

      <PlaceholderSecao titulo="Métricas gerais — em breve" />
    </div>
  );
}
