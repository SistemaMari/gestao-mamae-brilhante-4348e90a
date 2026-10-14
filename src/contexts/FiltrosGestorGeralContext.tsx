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
import { format, subDays, startOfYear } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PresetPeriodo = "7d" | "30d" | "90d" | "12m" | "ano" | "custom";

export interface UnidadeOpt {
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
  filtros: FiltrosState;
  setFiltros: (next: FiltrosState) => void;
  // RPCs precisam: null quando todas, array quando subset não vazio.
  // Quando o user desmarca tudo (selecionadas = []), retornamos [].
  unidadesEfetivas: string[] | null; // null = todas, [] = nenhuma, [...] = subset
  semSelecao: boolean; // true quando selecionadas = []
  refrescarTudo: () => Promise<{ ok: boolean; error?: string }>;
}

const Ctx = createContext<FiltrosCtx | null>(null);

const HOJE = () => new Date();

export function calcularPeriodo(
  preset: PresetPeriodo,
  custom?: { from?: Date; to?: Date },
): { inicio: string; fim: string } {
  const fim = HOJE();
  let inicio = subDays(fim, 30);
  switch (preset) {
    case "7d":
      inicio = subDays(fim, 7);
      break;
    case "30d":
      inicio = subDays(fim, 30);
      break;
    case "90d":
      inicio = subDays(fim, 90);
      break;
    case "12m":
      inicio = subDays(fim, 365);
      break;
    case "ano":
      inicio = startOfYear(fim);
      break;
    case "custom":
      if (custom?.from && custom?.to) {
        return {
          inicio: format(custom.from, "yyyy-MM-dd"),
          fim: format(custom.to, "yyyy-MM-dd"),
        };
      }
      break;
  }
  return { inicio: format(inicio, "yyyy-MM-dd"), fim: format(fim, "yyyy-MM-dd") };
}

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

  const periodoInicial = useRef(calcularPeriodo("30d"));
  const [filtros, setFiltrosState] = useState<FiltrosState>({
    unidadesSelecionadas: null,
    preset: "30d",
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
      setUnidades(list.map((u) => ({ id: u.id, nome: u.nome })));

      if (cts.length > 0) {
        const ord = [...cts].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
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
