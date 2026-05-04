import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type TipoConta = "todos" | "consultorio" | "institucional";
export type MomentoDiagnostico =
  | "todos"
  | "retorno_1"
  | "gtt"
  | "gtt_tardio"
  | "overt";

export interface AdminFiltros {
  periodo_inicio: string | null; // YYYY-MM-DD
  periodo_fim: string | null;
  pais: string;
  estado: string;
  cidade: string;
  tipo_conta: TipoConta;
  unidade_id: string;
  momento_diagnostico: MomentoDiagnostico;
}

const STORAGE_KEY = "admin:filtros";

function defaultsIniciais(): AdminFiltros {
  const fim = new Date();
  const inicio = new Date();
  inicio.setMonth(inicio.getMonth() - 6);
  return {
    periodo_inicio: inicio.toISOString().slice(0, 10),
    periodo_fim: fim.toISOString().slice(0, 10),
    pais: "todos",
    estado: "todos",
    cidade: "todos",
    tipo_conta: "todos",
    unidade_id: "todos",
    momento_diagnostico: "todos",
  };
}

const DEFAULTS_REF = defaultsIniciais();

function carregarSession(): AdminFiltros {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultsIniciais();
    return { ...defaultsIniciais(), ...JSON.parse(raw) };
  } catch {
    return defaultsIniciais();
  }
}

interface ContextoTipo {
  filtros: AdminFiltros;
  defaults: AdminFiltros;
  setFiltro: <K extends keyof AdminFiltros>(chave: K, valor: AdminFiltros[K]) => void;
  setFiltros: (parcial: Partial<AdminFiltros>) => void;
  resetFiltros: () => void;
  filtrosAtivosCount: number;
  contratoExportacao: Record<string, unknown>;
}

const Ctx = createContext<ContextoTipo | undefined>(undefined);

export function AdminFiltrosProvider({ children }: { children: React.ReactNode }) {
  const [filtros, setFiltrosState] = useState<AdminFiltros>(() => carregarSession());

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtros));
    } catch {
      /* ignore */
    }
  }, [filtros]);

  const setFiltro = useCallback(
    <K extends keyof AdminFiltros>(chave: K, valor: AdminFiltros[K]) => {
      setFiltrosState((prev) => {
        const novo = { ...prev, [chave]: valor };
        if (chave === "pais") {
          novo.estado = "todos";
          novo.cidade = "todos";
        } else if (chave === "estado") {
          novo.cidade = "todos";
        } else if (chave === "tipo_conta" && valor !== "institucional") {
          novo.unidade_id = "todos";
        }
        return novo;
      });
    },
    [],
  );

  const setFiltros = useCallback((parcial: Partial<AdminFiltros>) => {
    setFiltrosState((prev) => ({ ...prev, ...parcial }));
  }, []);

  const resetFiltros = useCallback(() => {
    setFiltrosState(defaultsIniciais());
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const filtrosAtivosCount = useMemo(() => {
    let n = 0;
    if (
      filtros.periodo_inicio !== DEFAULTS_REF.periodo_inicio ||
      filtros.periodo_fim !== DEFAULTS_REF.periodo_fim
    )
      n++;
    if (filtros.pais !== "todos") n++;
    if (filtros.estado !== "todos") n++;
    if (filtros.cidade !== "todos") n++;
    if (filtros.tipo_conta !== "todos") n++;
    if (filtros.unidade_id !== "todos") n++;
    if (filtros.momento_diagnostico !== "todos") n++;
    return n;
  }, [filtros]);

  const contratoExportacao = useMemo<Record<string, unknown>>(
    () => ({
      periodo_inicio: filtros.periodo_inicio,
      periodo_fim: filtros.periodo_fim,
      pais: filtros.pais === "todos" ? null : filtros.pais,
      estado: filtros.estado === "todos" ? null : filtros.estado,
      cidade: filtros.cidade === "todos" ? null : filtros.cidade,
      tipo_conta: filtros.tipo_conta === "todos" ? null : filtros.tipo_conta,
      unidade_id: filtros.unidade_id === "todos" ? null : filtros.unidade_id,
      momento_diagnostico:
        filtros.momento_diagnostico === "todos" ? null : filtros.momento_diagnostico,
    }),
    [filtros],
  );

  const valor: ContextoTipo = {
    filtros,
    defaults: DEFAULTS_REF,
    setFiltro,
    setFiltros,
    resetFiltros,
    filtrosAtivosCount,
    contratoExportacao,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAdminFiltros() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminFiltros precisa estar dentro de AdminFiltrosProvider");
  return ctx;
}

export function limparFiltrosAdminStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
