import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Building2, Loader2, Mail, Search, ShieldCheck, UserPlus, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ModalCadastrarGestorRede, ModalConvidarProfissionalRede,
} from "@/components/gestor-geral/equipe/ModaisEquipeRede";

interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  perfil_clinico: string | null;
  pendente: boolean;
}

interface UnidadeEquipe {
  id: string;
  nome: string;
  contratante_nome: string | null;
  gestor: Pessoa | null;
  profissionais: Pessoa[];
  convites_pendentes: { email: string; expires_at: string }[];
}

const TODAS = "todas";

function useMockVitrine(): UnidadeEquipe[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const p = (id: string, nome: string, perfil: string, pendente = false): Pessoa => ({
      id, nome, email: `${id}@exemplo.com`, perfil_clinico: perfil, pendente,
    });
    const rede = t("consolidar.vitrine.contratante");
    return [
      {
        id: "u-lapa", nome: t("consolidar.vitrine.unidadeLapa"), contratante_nome: rede,
        gestor: p("gestor.lapa", "Carla Mendes", "outro"),
        profissionais: [p("ana.souza", "Dra. Ana Souza", "medico"), p("bruno.lima", "Bruno Lima", "enfermeiro", true)],
        convites_pendentes: [],
      },
      {
        id: "u-moema", nome: t("consolidar.vitrine.unidadeMoema"), contratante_nome: rede,
        gestor: null,
        profissionais: [p("julia.ramos", "Dra. Júlia Ramos", "medico")],
        convites_pendentes: [{ email: "paula.reis@exemplo.com", expires_at: new Date().toISOString() }],
      },
      {
        id: "u-pinheiros", nome: t("consolidar.vitrine.unidadePinheiros"), contratante_nome: rede,
        gestor: p("gestor.pinheiros", "Rafael Costa", "outro", true),
        profissionais: [p("marta.dias", "Marta Dias", "tecnico_enfermagem"), p("lucas.prado", "Dr. Lucas Prado", "medico")],
        convites_pendentes: [],
      },
      {
        id: "u-vilanova", nome: t("consolidar.vitrine.unidadeVilaNova"), contratante_nome: rede,
        gestor: p("gestor.vilanova", "Sônia Alves", "outro"),
        profissionais: [],
        convites_pendentes: [],
      },
    ];
  }, [t]);
}

/**
 * Equipe da rede (gestor geral): gestor e profissionais de cada unidade da
 * rede. O gestor geral convida profissionais e cadastra o gestor de unidades
 * sem gestor; criar unidade continua só com o admin. Tudo passa pelo
 * gerenciar-institucional, que confere se a unidade é da rede dele.
 */
export default function EquipeRedePage() {
  const { t } = useTranslation();
  const modoVitrine = useLocation().pathname.startsWith("/vitrine");
  const mock = useMockVitrine();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["gestor-geral", "equipe-rede"],
    enabled: !modoVitrine,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: "listar_equipe_rede" },
      });
      if (error) throw error;
      return (data?.unidades ?? []) as UnidadeEquipe[];
    },
  });
  const unidades = useMemo(() => (modoVitrine ? mock : data ?? []), [modoVitrine, mock, data]);

  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState(TODAS);
  const [convidar, setConvidar] = useState<{ aberto: boolean; unidade: string | null }>({ aberto: false, unidade: null });
  const [cadastrarGestor, setCadastrarGestor] = useState<{ aberto: boolean; unidade: string | null }>({ aberto: false, unidade: null });

  const opcoesUnidades = useMemo(() => unidades.map((u) => ({ id: u.id, nome: u.nome })), [unidades]);
  const unidadesSemGestor = useMemo(
    () => unidades.filter((u) => !u.gestor).map((u) => ({ id: u.id, nome: u.nome })),
    [unidades],
  );

  const resumo = useMemo(() => ({
    unidades: unidades.length,
    semGestor: unidades.filter((u) => !u.gestor).length,
    profissionais: unidades.reduce((s, u) => s + u.profissionais.filter((p) => !p.pendente).length, 0),
    pendentes: unidades.reduce(
      (s, u) => s + u.profissionais.filter((p) => p.pendente).length + (u.gestor?.pendente ? 1 : 0) + u.convites_pendentes.length,
      0,
    ),
  }), [unidades]);

  const termo = busca.trim().toLowerCase();
  const casa = (p: { nome?: string | null; email?: string | null }) =>
    !termo || (p.nome ?? "").toLowerCase().includes(termo) || (p.email ?? "").toLowerCase().includes(termo);

  const visiveis = unidades
    .filter((u) => filtroUnidade === TODAS || u.id === filtroUnidade)
    .map((u) => ({
      ...u,
      gestorVisivel: u.gestor && casa(u.gestor) ? u.gestor : null,
      profissionaisVisiveis: u.profissionais.filter(casa),
      convitesVisiveis: u.convites_pendentes.filter((c) => casa({ email: c.email })),
    }))
    .filter((u) =>
      !termo || u.gestorVisivel || u.profissionaisVisiveis.length > 0 || u.convitesVisiveis.length > 0,
    );

  const recarregar = () => { void refetch(); };

  return (
    <div className="flex flex-col gap-5 p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
            <Users className="h-6 w-6 text-[#7E69AB]" />
            {t("consolidar.equipeRede.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#64748B]">{t("consolidar.equipeRede.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-[#7E69AB]/40 text-[#5B3A8E]"
            onClick={() => setCadastrarGestor({ aberto: true, unidade: null })}
            disabled={unidadesSemGestor.length === 0}
          >
            <ShieldCheck className="h-4 w-4" />
            {t("consolidar.equipeRede.cadastrarGestor")}
          </Button>
          <Button
            className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
            onClick={() => setConvidar({ aberto: true, unidade: null })}
            disabled={unidades.length === 0}
          >
            <UserPlus className="h-4 w-4" />
            {t("consolidar.equipeRede.convidar")}
          </Button>
        </div>
      </div>

      {modoVitrine && (
        <p className="text-xs text-[#94A3B8]">{t("consolidar.equipeRede.vitrineAviso")}</p>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["unidades", resumo.unidades, Building2],
          ["semGestor", resumo.semGestor, AlertTriangle],
          ["profissionais", resumo.profissionais, Users],
          ["pendentes", resumo.pendentes, Mail],
        ] as const).map(([chave, valor, Icone]) => (
          <div key={chave} className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
              <Icone className={`h-4 w-4 ${chave === "semGestor" && valor > 0 ? "text-amber-500" : "text-[#9b87f5]"}`} />
              {t(`consolidar.equipeRede.resumo.${chave}`)}
            </div>
            <p className="mt-1 text-2xl font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
              {isLoading && !modoVitrine ? "—" : valor}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("consolidar.equipeRede.buscar")}
            className="pl-9"
          />
        </div>
        <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>{t("consolidar.equipeRede.todasUnidades")}</SelectItem>
            {opcoesUnidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista por unidade */}
      {isLoading && !modoVitrine ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#7E69AB]" /></div>
      ) : isError && !modoVitrine ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">
          {t("consolidar.equipeRede.erro")}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={recarregar}>{t("common.tryAgain")}</Button>
          </div>
        </div>
      ) : unidades.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">
          {t("consolidar.equipeRede.vazio")}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">
          {t("consolidar.equipeRede.nadaEncontrado")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visiveis.map((u) => (
            <div key={u.id} className="flex flex-col rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 rounded-t-xl bg-[#F5F0FF] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>{u.nome}</p>
                  <p className="text-xs text-[#64748B]">
                    {t("consolidar.equipeRede.profissionais", { count: u.profissionais.length })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-[#5B3A8E] hover:bg-[#E8E0FF]"
                  onClick={() => setConvidar({ aberto: true, unidade: u.id })}
                >
                  <UserPlus className="h-4 w-4" />
                  {t("consolidar.equipeRede.convidar")}
                </Button>
              </div>

              {/* Gestor */}
              <div className="border-b border-[#E2E8F0] px-4 py-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#94A3B8]">{t("consolidar.equipeRede.gestor")}</p>
                {u.gestor ? (
                  u.gestorVisivel ? <LinhaPessoa pessoa={u.gestorVisivel} /> : <p className="text-sm text-[#94A3B8]">—</p>
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2 text-sm text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">{t("consolidar.equipeRede.semGestor")}</p>
                        <p className="text-xs">{t("consolidar.equipeRede.semGestorDica")}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
                      onClick={() => setCadastrarGestor({ aberto: true, unidade: u.id })}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {t("consolidar.equipeRede.cadastrarGestor")}
                    </Button>
                  </div>
                )}
              </div>

              {/* Profissionais */}
              <div className="flex-1 px-4 py-3">
                {u.profissionais.length === 0 && u.convites_pendentes.length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">{t("consolidar.equipeRede.semProfissionais")}</p>
                ) : (
                  <ul className="divide-y divide-[#F1F5F9]">
                    {u.profissionaisVisiveis.map((p) => (
                      <li key={p.id} className="py-2"><LinhaPessoa pessoa={p} /></li>
                    ))}
                    {u.convitesVisiveis.map((c) => (
                      <li key={c.email} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-[#1E293B]">{c.email}</p>
                          <p className="text-xs text-[#94A3B8]">{t("consolidar.equipeRede.conviteSemConta")}</p>
                        </div>
                        <BadgePendente />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalConvidarProfissionalRede
        open={convidar.aberto}
        onOpenChange={(v) => setConvidar((s) => ({ ...s, aberto: v }))}
        unidades={opcoesUnidades}
        unidadeInicial={convidar.unidade}
        modoVitrine={modoVitrine}
        onSucesso={recarregar}
      />
      <ModalCadastrarGestorRede
        open={cadastrarGestor.aberto}
        onOpenChange={(v) => setCadastrarGestor((s) => ({ ...s, aberto: v }))}
        unidades={unidadesSemGestor}
        unidadeInicial={cadastrarGestor.unidade}
        modoVitrine={modoVitrine}
        onSucesso={recarregar}
      />
    </div>
  );
}

function BadgePendente() {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className="shrink-0 border-amber-400/50 text-amber-600">
      {t("consolidar.equipeRede.convitePendente")}
    </Badge>
  );
}

function LinhaPessoa({ pessoa }: { pessoa: Pessoa }) {
  const { t } = useTranslation();
  const perfil = pessoa.perfil_clinico && pessoa.perfil_clinico !== "outro"
    ? t(`consolidar.equipeRede.perfis.${pessoa.perfil_clinico}`, pessoa.perfil_clinico)
    : null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#1E293B]">{pessoa.nome}</p>
        <p className="truncate text-xs text-[#64748B]">
          {[pessoa.email, perfil].filter(Boolean).join(" · ")}
        </p>
      </div>
      {pessoa.pendente ? (
        <BadgePendente />
      ) : (
        <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">
          {t("consolidar.equipeRede.ativo")}
        </Badge>
      )}
    </div>
  );
}
