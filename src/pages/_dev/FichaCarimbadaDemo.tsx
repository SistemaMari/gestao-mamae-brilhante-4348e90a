import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Pencil, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CarimboAtendimento from "@/components/clinico/CarimboAtendimento";

const PACIENTE = {
  nome: "Maria Aparecida da Silva",
  idade: 32,
  ig: "28+3 sem",
  cartao: "Cartão SUS 700 1234 5678 9012",
  unidade: "UBS Vila Esperança",
};

const PROFISSIONAL_LOGADO = {
  nome: "Dra. Carolina Mendes",
  crm: "123456",
  unidade_nome: "UBS Vila Esperança",
};

const REGISTROS = [
  {
    id: "r1",
    tipo_operacao: "gerar_laudo",
    profissional_nome: "Dra. Carolina Mendes",
    profissional_crm: "123456",
    profissional_especialidade: "Endocrinologia",
    created_at: "2026-05-05T14:32:00",
  },
  {
    id: "r2",
    tipo_operacao: "preencher_ficha_bd",
    profissional_nome: "Dr. Rafael Tavares",
    profissional_crm: "987654",
    profissional_especialidade: "Ginecologia e Obstetrícia",
    created_at: "2026-05-04T10:15:00",
  },
  {
    id: "r3",
    tipo_operacao: "preencher_gtt",
    profissional_nome: "Enf. Ana Paula Souza",
    profissional_crm: "COREN 456789",
    profissional_especialidade: "Enfermagem Obstétrica",
    created_at: "2026-04-28T09:00:00",
  },
  {
    id: "r4",
    tipo_operacao: "retorno",
    profissional_nome: "Dra. Carolina Mendes",
    profissional_crm: "123456",
    profissional_especialidade: "Endocrinologia",
    created_at: "2026-04-22T15:40:00",
  },
  {
    id: "r5",
    tipo_operacao: "perfil_glicemico",
    profissional_nome: "Enf. Ana Paula Souza",
    profissional_crm: "COREN 456789",
    profissional_especialidade: "Enfermagem Obstétrica",
    created_at: "2026-04-15T08:20:00",
  },
  {
    id: "r6",
    tipo_operacao: "preencher_ficha_ac",
    profissional_nome: "Dr. Rafael Tavares",
    profissional_crm: "987654",
    profissional_especialidade: "Ginecologia e Obstetrícia",
    created_at: "2026-04-10T11:05:00",
  },
  {
    id: "r7",
    tipo_operacao: "consulta_inicial",
    profissional_nome: "Dr. Rafael Tavares",
    profissional_crm: "987654",
    profissional_especialidade: "Ginecologia e Obstetrícia",
    created_at: "2026-04-02T14:00:00",
  },
  {
    id: "r8",
    tipo_operacao: "abrir_ficha",
    profissional_nome: "Enf. Ana Paula Souza",
    profissional_crm: "COREN 456789",
    profissional_especialidade: "Enfermagem Obstétrica",
    created_at: "2026-04-02T13:48:00",
  },
];

const OPERACOES_RECENTES = REGISTROS.slice(0, 4);

function BotaoDemo({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button variant="outline" size="sm" disabled className="gap-2">
              <Icon className="h-4 w-4" />
              {children}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Demo — botão desabilitado</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function FichaCarimbadaDemo() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/vitrine"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a vitrine
        </Link>

        {/* Cabeçalho da paciente */}
        <div className="mb-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-[Sora] text-2xl font-bold text-foreground">{PACIENTE.nome}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {PACIENTE.idade} anos · IG {PACIENTE.ig} · {PACIENTE.cartao}
              </p>
              <p className="mt-1 text-sm text-[#7E69AB]">{PACIENTE.unidade}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <BotaoDemo icon={Pencil}>Editar</BotaoDemo>
              <BotaoDemo icon={FileText}>Gerar laudo</BotaoDemo>
            </div>
          </div>
        </div>

        {/* Banner Atendendo como (mock) */}
        <div className="mb-6">
          <CarimboAtendimento variant="banner" mockProfissional={PROFISSIONAL_LOGADO} />
        </div>

        {/* Operações recentes com carimbo inline */}
        <section className="mb-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-[Sora] text-lg font-semibold text-[#5B3A8E]">
            Operações recentes
          </h2>
          <ul className="space-y-3">
            {OPERACOES_RECENTES.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-[#F8FAFC] px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#9b87f5]/10">
                    <Stethoscope className="h-4 w-4 text-[#7E69AB]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {labelLocal(r.tipo_operacao)}
                    </div>
                    <div className="mt-0.5">
                      <CarimboAtendimento variant="inline" registro={r} />
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Histórico completo (lista) */}
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <CarimboAtendimento variant="lista" registros={REGISTROS} />
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Tela demo · dados fictícios para visualizar o carimbo CFM
        </p>
      </div>
    </div>
  );
}

function labelLocal(tipo: string) {
  const map: Record<string, string> = {
    abrir_ficha: "Abertura de ficha",
    preencher_ficha_ac: "Preenchimento ficha A/C",
    preencher_ficha_bd: "Preenchimento ficha B/D",
    preencher_gtt: "Resultado de GTT",
    consulta_inicial: "Consulta inicial",
    retorno: "Retorno clínico",
    perfil_glicemico: "Perfil glicêmico",
    gerar_laudo: "Geração de laudo",
    registrar_parto: "Registro de parto",
    encerramento: "Encerramento de caso",
    editar_dados_paciente: "Edição de dados",
  };
  return map[tipo] ?? tipo;
}
