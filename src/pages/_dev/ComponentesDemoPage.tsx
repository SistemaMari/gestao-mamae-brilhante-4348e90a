import AlertaCard from "@/components/admin/AlertaCard";
import MetricaCard from "@/components/admin/MetricaCard";
import TabelaOrdenavel, { type Coluna } from "@/components/admin/TabelaOrdenavel";
import GraficoEvolucao from "@/components/admin/GraficoEvolucao";

const ESTADOS = ["SP", "RJ", "MG", "BA", "PR", "RS", "SC", "PE", "CE", "GO"];
const CIDADES_BASE = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Salvador", "Curitiba",
  "Porto Alegre", "Florianópolis", "Recife", "Fortaleza", "Goiânia",
  "Campinas", "Santos", "Niterói", "Uberlândia", "Londrina",
  "Caxias do Sul", "Joinville", "Olinda", "Sobral", "Anápolis",
];

function gerarLinhasMock(qtd: number) {
  const linhas: { cidade: string; estado: string; profissionais: number }[] = [];
  for (let i = 0; i < qtd; i++) {
    const cidade = `${CIDADES_BASE[i % CIDADES_BASE.length]}${i >= CIDADES_BASE.length ? ` ${Math.floor(i / CIDADES_BASE.length) + 1}` : ""}`;
    const estado = ESTADOS[i % ESTADOS.length];
    const profissionais = Math.floor(Math.random() * 50) + 1;
    linhas.push({ cidade, estado, profissionais });
  }
  return linhas;
}

const COLUNAS_TABELA: Coluna[] = [
  { chave: "cidade", titulo: "Cidade" },
  { chave: "estado", titulo: "Estado", alinhamento: "center" },
  { chave: "profissionais", titulo: "Profissionais", alinhamento: "right" },
];

const MESES = [
  "Jan/26", "Fev/26", "Mar/26", "Abr/26", "Mai/26", "Jun/26",
  "Jul/26", "Ago/26", "Set/26", "Out/26", "Nov/26", "Dez/26",
];
const DADOS_GRAFICO = MESES.map((mes, i) => ({
  mes,
  valor: Math.round(5 + (37 * i) / (MESES.length - 1)),
}));

export default function ComponentesDemoPage() {
  const dadosTabela = gerarLinhasMock(60);

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC" }}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "Sora, sans-serif", color: "#1E293B" }}
        >
          Componentes Admin — Demonstração
        </h1>
        <p
          className="mt-2 text-[14px]"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif", color: "#64748B" }}
        >
          Esta é a vitrine dos componentes reutilizáveis do dashboard admin. Use para validar
          visualmente antes de plugar nas páginas reais.
        </p>

        {/* Seção 1 — AlertaCard */}
        <section className="mt-10">
          <h2
            className="mb-4 text-lg font-bold"
            style={{ fontFamily: "Sora, sans-serif", color: "#1E293B" }}
          >
            1. AlertaCard
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AlertaCard
              tipo="critico"
              titulo="Profissionais inativos 30d"
              numero={4}
              descricao="profissional_inativo_30d — sem laudos nos últimos 30 dias."
              linkVerDetalhes={() => console.log("ver profissionais inativos")}
            />
            <AlertaCard
              tipo="atencao"
              titulo="Plano Intermediária inativos"
              numero={2}
              descricao="intermediaria_inativo_30d — assinantes Intermediária sem uso recente."
              linkVerDetalhes={() => console.log("ver intermediaria inativos")}
            />
            <AlertaCard
              tipo="atencao"
              titulo="Plano Inicial inativos"
              numero={3}
              descricao="inicial_inativo_30d — assinantes Inicial sem uso recente."
            />
            <AlertaCard
              tipo="info"
              titulo="Unidades dormentes"
              numero={1}
              descricao="unidade_dormente — unidade institucional sem atividade no período."
              linkVerDetalhes={() => console.log("ver unidade dormente")}
            />
            <AlertaCard
              tipo="sucesso"
              titulo="Onboarding travado"
              numero={0}
              descricao="onboarding_travado — nenhum cadastro pendente. Tudo em dia."
            />
          </div>
        </section>

        {/* Seção 2 — MetricaCard */}
        <section className="mt-10">
          <h2
            className="mb-4 text-lg font-bold"
            style={{ fontFamily: "Sora, sans-serif", color: "#1E293B" }}
          >
            2. MetricaCard
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricaCard label="Total profissionais" valor={42} />
            <MetricaCard
              label="Profissionais ativos"
              valor={28}
              variacao={{ valor: 12, periodo: "mês anterior" }}
            />
            <MetricaCard label="Total unidades" valor={5} />
            <MetricaCard label="Total laudos" valor={1247} />
            <MetricaCard
              label="Taxa de retenção"
              valor={87}
              formato="percentual"
              variacao={{ valor: -3, periodo: "mês anterior" }}
            />
            <MetricaCard label="Receita mensal" valor={18450.9} formato="moeda" />
          </div>
        </section>

        {/* Seção 3 — TabelaOrdenavel */}
        <section className="mt-10">
          <h2
            className="mb-4 text-lg font-bold"
            style={{ fontFamily: "Sora, sans-serif", color: "#1E293B" }}
          >
            3. TabelaOrdenavel (60 linhas — paginação 3×20)
          </h2>
          <TabelaOrdenavel colunas={COLUNAS_TABELA} dados={dadosTabela} />
        </section>

        {/* Seção 4 — GraficoEvolucao */}
        <section className="mt-10 mb-16">
          <h2
            className="mb-4 text-lg font-bold"
            style={{ fontFamily: "Sora, sans-serif", color: "#1E293B" }}
          >
            4. GraficoEvolucao (12 meses)
          </h2>
          <GraficoEvolucao
            dados={DADOS_GRAFICO}
            titulo="Profissionais ativos por mês"
          />
        </section>
      </div>
    </div>
  );
}
