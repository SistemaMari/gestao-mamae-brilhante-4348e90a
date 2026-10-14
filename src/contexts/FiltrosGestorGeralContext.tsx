import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calcularPeriodo, PERIODO_PADRAO_PAINEL, type PresetPeriodo } from "@/lib/periodo";

// Presets e cálculo do período ficam em src/lib/periodo.ts (o painel da unidade usa também).
export { calcularPeriodo, type PresetPeriodo };

export interface UnidadeOpt {
  id: string;
  nome: string;
  /** Rede (contratante) da unidade — as metas da rede são por rede. */
  contratante_id?: string;
}

export interface RedeOpt {
  id: string;
  nome: string;
}

export interface PerfilGestorGeral {
  id: string;
  nome: string | null;
}

export interface ContratantesInfo {
  primeiro: string;
  outros: number;
}

export interface FiltrosState {
  // null = estado inicial / default = TODAS as unidades
  // [] (array vazio) = usuário desmarcou todas via toggle => mostrar estado vazio
  // string[] não vazio = subset selecionado
  unidadesSelecionadas: string[] | null;
  preset: PresetPeriodo;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;
}

interface FiltrosCtx {
  carregandoPerfil: boolean;
  gestor: PerfilGestorGeral | null;
  unidades: UnidadeOpt[];
  contratantes: ContratantesInfo;
  /** Redes ativas do gestor geral (para as metas da rede). */
  redes: RedeOpt[];
  filtros: FiltrosState;
  setFiltros: (next: FiltrosState) => void;
  // RPCs precisam: null quando todas, array quando subset não vazio.
  // Quando o user desmarca tudo (selecionadas = []), retornamos [].
  unidadesEfetivas: string[] | null; // null = todas, [] = nenhuma, [...] = subset
  semSelecao: boolean; // true quando selecionadas = []
  refrescarTudo: () => Promise<{ ok: boolean; error?: string }>;
}

const Ctx = createContext<FiltrosCtx | null>(null);

export function FiltrosGestorGeralProvider({
  children,
  modoVitrine = false,
  mockData,
}: {
  children: ReactNode;
  modoVitrine?: boolean;
  mockData?: {
    gestor: PerfilGestorGeral;
    unidades: UnidadeOpt[];
    contratantes: ContratantesInfo;
    redes?: RedeOpt[];
  };
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [carregandoPerfil, setCarregandoPerfil] = useState(!modoVitrine);
  const [gestor, setGestor] = useState<PerfilGestorGeral | null>(
    modoVitrine ? mockData?.gestor ?? null : null,
  );
  const [unidades, setUnidades] = useState<UnidadeOpt[]>(
    modoVitrine ? mockData?.unidades ?? [] : [],
  );
  const [contratantes, setContratantes] = useState<ContratantesInfo>(
    modoVitrine ? mockData?.contratantes ?? { primeiro: "", outros: 0 } : { primeiro: "", outros: 0 },
  );

  const [redes, setRedes] = useState<RedeOpt[]>(modoVitrine ? mockData?.redes ?? [] : []);

  const periodoInicial = useRef(calcularPeriodo(PERIODO_PADRAO_PAINEL));
  const [filtros, setFiltrosState] = useState<FiltrosState>({
    unidadesSelecionadas: null,
    preset: PERIODO_PADRAO_PAINEL,
    dataInicio: periodoInicial.current.inicio,
    dataFim: periodoInicial.current.fim,
  });

  const setFiltros = useCallback((next: FiltrosState) => {
    setFiltrosState(next);
  }, []);

  useEffect(() => {
    if (modoVitrine) return;
    if (!user?.id) return;
    let cancelado = false;
    (async () => {
      const { data: gg } = await supabase
        .from("gestores_gerais")
        .select("id, nome")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelado) return;

      if (!gg) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const role = roles?.[0]?.role;
        const dest =
          role === "admin"
            ? "/admin"
            : role === "gestor"
              ? "/gestao"
              : "/dashboard";
        navigate(dest, { replace: true });
        return;
      }

      setGestor(gg as PerfilGestorGeral);

      const { data: vincs } = await supabase
        .from("gestores_gerais_unidades")
        .select("unidade_id, unidades:unidade_id(id, nome, contratante_id)")
        .eq("gestor_geral_id", gg.id);

      if (cancelado) return;

      type Vinc = {
        unidades: { id: string; nome: string; contratante_id: string } | null;
      };
      const todas = ((vincs ?? []) as Vinc[])
        .map((v) => v.unidades)
        .filter(Boolean) as { id: string; nome: string; contratante_id: string }[];

      // Rede encerrada pelo admin sai do filtro (o banco já não devolve os dados dela).
      const ids = Array.from(new Set(todas.map((u) => u.contratante_id))).filter(Boolean);
      const { data: ctsTodas } = ids.length > 0
        ? await supabase.from("contratantes").select("id, nome, status").in("id", ids)
        : { data: [] as { id: string; nome: string; status: string }[] };
      if (cancelado) return;
      const cts = (ctsTodas ?? []).filter((c) => c.status !== "encerrado");
      const redesAtivas = new Set(cts.map((c) => c.id));
      const list = todas.filter((u) => redesAtivas.has(u.contratante_id));
      list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setUnidades(list.map((u) => ({ id: u.id, nome: u.nome, contratante_id: u.contratante_id })));

      if (cts.length > 0) {
        const ord = [...cts].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        setRedes(ord.map((c) => ({ id: c.id, nome: c.nome })));
        setContratantes({
          primeiro: ord[0]?.nome ?? "",
          outros: Math.max(0, ord.length - 1),
        });
      }

      setCarregandoPerfil(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.id, navigate, modoVitrine]);

  const unidadesEfetivas = useMemo<string[] | null>(() => {
    const sel = filtros.unidadesSelecionadas;
    if (sel === null) return null; // todas
    return sel; // pode ser []
  }, [filtros.unidadesSelecionadas]);

  const semSelecao = filtros.unidadesSelecionadas !== null && filtros.unidadesSelecionadas.length === 0;

  const refrescarTudo = useCallback(async () => {
    if (modoVitrine) {
      await qc.invalidateQueries({ queryKey: ["painel-gg"] });
      return { ok: true };
    }
    const { error } = await supabase.rpc("refresh_mv_metricas_unidade_manual");
    if (error) return { ok: false, error: error.message };
    await qc.invalidateQueries({ queryKey: ["painel-gg"] });
    return { ok: true };
  }, [qc, modoVitrine]);

  const value: FiltrosCtx = {
    carregandoPerfil,
    gestor,
    unidades,
    contratantes,
    redes,
    filtros,
    setFiltros,
    unidadesEfetivas,
    semSelecao,
    refrescarTudo,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFiltrosGestorGeral() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFiltrosGestorGeral fora do Provider");
  return v;
}
