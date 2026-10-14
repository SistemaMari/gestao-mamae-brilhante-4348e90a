// Peças visuais do relatório em PDF (painel da unidade e consolidado da rede).
// Tudo com estilo inline e largura fixa: o relatório é desenhado fora da tela
// numa coluna de LARGURA_RELATORIO px e capturado bloco a bloco (data-bloco)
// pelo motor (src/lib/relatorioPdf/motor.ts). Classes responsivas do Tailwind
// não servem aqui (dependem da largura da janela, não da coluna).
import type { CSSProperties, ReactNode } from "react";
import mariLogo from "@/assets/mari-logo.png";

export const LARGURA_RELATORIO = 760;

export const COR = {
  roxo: "#7E69AB",
  lilas: "#9b87f5",
  lilasClaro: "#F1F0FB",
  lilasMedio: "#E8E0FF",
  borda: "#E9E5F5",
  texto: "#1E293B",
  corpo: "#334155",
  muted: "#64748B",
  sutil: "#94A3B8",
  fundo: "#F8FAFC",
  verde: "#15803D",
  verdeClaro: "#DCFCE7",
  vermelho: "#B91C1C",
  vermelhoClaro: "#FEE2E2",
  ambar: "#B45309",
  ambarClaro: "#FEF3C7",
  cinza: "#475569",
  cinzaClaro: "#F1F5F9",
};

export const FONTE_TITULO = "'Sora', system-ui, sans-serif";
export const FONTE_CORPO = "'Plus Jakarta Sans', system-ui, Arial, sans-serif";

export type Tom = "bom" | "ruim" | "neutro" | "alerta";

/**
 * O html2canvas desenha o texto de elementos inline uns 3px abaixo do fundo
 * (métrica da fonte web). Texto dentro de pílulas/círculos vai num span com
 * este estilo para ficar centralizado na imagem do PDF.
 */
const TEXTO_CENTRALIZADO: CSSProperties = { position: "relative", top: -3 };

const TONS: Record<Tom, { fg: string; bg: string }> = {
  bom: { fg: COR.verde, bg: COR.verdeClaro },
  ruim: { fg: COR.vermelho, bg: COR.vermelhoClaro },
  alerta: { fg: COR.ambar, bg: COR.ambarClaro },
  neutro: { fg: COR.cinza, bg: COR.cinzaClaro },
};

/** Raiz do relatório (fora da tela). Cada filho direto com data-bloco vira um pedaço paginável. */
export function Documento({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: LARGURA_RELATORIO,
        background: "#ffffff",
        fontFamily: FONTE_CORPO,
        color: COR.texto,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Um pedaço que nunca é cortado entre páginas.
 * manterComProximo: título de seção — vai para a página seguinte junto com o bloco que vem depois.
 */
export function Bloco({
  children,
  manterComProximo,
  style,
}: {
  children: ReactNode;
  manterComProximo?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      data-bloco=""
      data-manter-com-proximo={manterComProximo ? "" : undefined}
      style={{ background: "#ffffff", padding: "2px 0 6px", ...style }}
    >
      {children}
    </div>
  );
}

/** Faixa do topo de toda página (capturada uma vez e repetida pelo motor). */
export function CabecalhoPagina({ titulo, contexto }: { titulo: string; contexto: string }) {
  return (
    <div
      data-cabecalho=""
      style={{
        width: LARGURA_RELATORIO,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 0 10px 0",
        borderBottom: `2px solid ${COR.lilasMedio}`,
        background: "#ffffff",
        fontFamily: FONTE_CORPO,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src={mariLogo} alt="MARI" style={{ height: 30, width: 30, borderRadius: 7, objectFit: "cover" }} />
        <div>
          <div style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 13, color: COR.roxo, letterSpacing: 0.3 }}>
            MARI · Inteligência Clínica
          </div>
          <div style={{ fontSize: 10.5, color: COR.muted }}>{titulo}</div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: COR.muted, textAlign: "right", maxWidth: 380 }}>{contexto}</div>
    </div>
  );
}

/** Abertura do relatório: faixa colorida com nome, período e resumo. */
export function Capa({
  sobretitulo,
  titulo,
  linhas,
  resumo,
  children,
}: {
  sobretitulo: string;
  titulo: string;
  linhas: string[];
  resumo: string[];
  children?: ReactNode;
}) {
  return (
    <Bloco>
      <div
        style={{
          borderRadius: 16,
          padding: "22px 24px",
          background: `linear-gradient(135deg, ${COR.roxo} 0%, ${COR.lilas} 100%)`,
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.9 }}>{sobretitulo}</div>
        <div style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 26, marginTop: 4, lineHeight: 1.2 }}>{titulo}</div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {linhas.map((l) => (
            <span
              key={l}
              style={{
                fontSize: 11,
                background: "rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "0 10px",
                height: 22,
                lineHeight: "22px",
                display: "inline-block",
              }}
            >
              <span style={TEXTO_CENTRALIZADO}>{l}</span>
            </span>
          ))}
        </div>
      </div>
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
      {resumo.length > 0 && (
        <div
          style={{
            marginTop: 12,
            borderRadius: 12,
            border: `1px solid ${COR.borda}`,
            background: COR.fundo,
            padding: "14px 18px",
          }}
        >
          <div style={{ fontFamily: FONTE_TITULO, fontWeight: 600, fontSize: 13.5, color: COR.roxo, marginBottom: 6 }}>
            Resumo do período
          </div>
          {resumo.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.55, color: COR.corpo, marginTop: 4 }}>
              <span style={{ color: COR.lilas, fontWeight: 700 }}>•</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      )}
    </Bloco>
  );
}

/** Título de seção numerado (fica junto do bloco seguinte). */
export function Secao({ numero, titulo, descricao }: { numero: number | string; titulo: string; descricao?: string }) {
  return (
    <Bloco manterComProximo style={{ paddingTop: 14, paddingBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            background: COR.lilasMedio,
            color: COR.roxo,
            fontFamily: FONTE_TITULO,
            fontWeight: 700,
            fontSize: 12,
            display: "inline-block",
            lineHeight: "24px",
            textAlign: "center",
          }}
        >
          <span style={TEXTO_CENTRALIZADO}>{numero}</span>
        </span>
        <span style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 17, color: COR.texto }}>{titulo}</span>
      </div>
      {descricao && <div style={{ fontSize: 11, color: COR.muted, marginTop: 4, marginLeft: 34, lineHeight: 1.5 }}>{descricao}</div>}
    </Bloco>
  );
}

/** Subtítulo dentro de uma seção. */
export function Subtitulo({ children, nota }: { children: ReactNode; nota?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontFamily: FONTE_TITULO, fontWeight: 600, fontSize: 13, color: COR.texto }}>{children}</div>
      {nota && <div style={{ fontSize: 10.5, color: COR.muted, marginTop: 2, lineHeight: 1.45 }}>{nota}</div>}
    </div>
  );
}

export function Grade({
  colunas,
  children,
  gap = 10,
  alinharTopo,
}: {
  colunas: number;
  children: ReactNode;
  gap?: number;
  /** Cada cartão com a própria altura (em vez de esticar todos até o mais alto). */
  alinharTopo?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`,
        gap,
        alignItems: alinharTopo ? "start" : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function Cartao({ children, style, destaque }: { children: ReactNode; style?: CSSProperties; destaque?: boolean }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${destaque ? COR.lilas : COR.borda}`,
        background: "#ffffff",
        padding: "12px 14px",
        ...(destaque ? { borderLeft: `4px solid ${COR.lilas}` } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pilula({ texto, tom }: { texto: string; tom: Tom }) {
  const c = TONS[tom];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 9.5,
        fontWeight: 600,
        color: c.fg,
        background: c.bg,
        borderRadius: 999,
        padding: "0 8px",
        height: 18,
        lineHeight: "18px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={TEXTO_CENTRALIZADO}>{texto}</span>
    </span>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  variacao,
  selo,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  variacao?: { texto: string; tom: Tom } | null;
  selo?: { texto: string; tom: Tom; meta?: string } | null;
  destaque?: boolean;
}) {
  return (
    <Cartao destaque={destaque}>
      <div style={{ fontSize: 10.5, color: COR.muted, fontWeight: 600, lineHeight: 1.35 }}>{rotulo}</div>
      <div style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 24, color: COR.texto, marginTop: 4, lineHeight: 1.1 }}>
        {valor}
      </div>
      {detalhe && <div style={{ fontSize: 10, color: COR.muted, marginTop: 3, lineHeight: 1.4 }}>{detalhe}</div>}
      {(variacao || selo) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, alignItems: "center" }}>
          {variacao && <Pilula texto={variacao.texto} tom={variacao.tom} />}
          {selo && <Pilula texto={selo.texto} tom={selo.tom} />}
          {selo?.meta && <span style={{ fontSize: 9.5, color: COR.muted }}>{selo.meta}</span>}
        </div>
      )}
    </Cartao>
  );
}

/** Linha de barra horizontal (funil, faixas de idade, distribuição). */
export function LinhaBarra({
  rotulo,
  valor,
  pct,
  cor = COR.lilas,
  largRotulo = 170,
}: {
  rotulo: string;
  valor: string;
  pct: number;
  cor?: string;
  largRotulo?: number;
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <div style={{ width: largRotulo, fontSize: 11, color: COR.corpo, lineHeight: 1.3 }}>{rotulo}</div>
      <div style={{ flex: 1, height: 14, borderRadius: 7, background: COR.lilasClaro, overflow: "hidden" }}>
        <div style={{ width: `${p}%`, height: "100%", borderRadius: 7, background: cor, minWidth: p > 0 ? 4 : 0 }} />
      </div>
      <div style={{ width: 92, textAlign: "right", fontSize: 11, color: COR.texto, fontWeight: 600, whiteSpace: "nowrap" }}>{valor}</div>
    </div>
  );
}

/** Régua da taxa de diagnóstico com a faixa esperada (ex.: 7–18%). */
export function ReguaFaixa({ valor, min, max }: { valor: number | null; min: number; max: number }) {
  const topo = Math.max(30, Math.ceil(((valor ?? 0) + 5) / 5) * 5);
  const x = (v: number) => `${(Math.max(0, Math.min(topo, v)) / topo) * 100}%`;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 12, borderRadius: 6, background: COR.cinzaClaro }}>
        <div
          style={{
            position: "absolute",
            left: x(min),
            width: `calc(${x(max)} - ${x(min)})`,
            top: 0,
            bottom: 0,
            background: "#BBF7D0",
            borderRadius: 6,
          }}
        />
        {valor != null && (
          <div
            style={{
              position: "absolute",
              left: x(valor),
              top: -4,
              width: 4,
              height: 20,
              marginLeft: -2,
              borderRadius: 2,
              background: COR.roxo,
            }}
          />
        )}
      </div>
      <div style={{ position: "relative", height: 14, fontSize: 9.5, color: COR.muted, marginTop: 3 }}>
        <span style={{ position: "absolute", left: 0 }}>0%</span>
        <span style={{ position: "absolute", left: x(min), transform: "translateX(-50%)" }}>{min}%</span>
        <span style={{ position: "absolute", left: x(max), transform: "translateX(-50%)" }}>{max}%</span>
        <span style={{ position: "absolute", right: 0 }}>{topo}%</span>
      </div>
      <div style={{ fontSize: 9.5, color: COR.muted }}>Faixa verde: taxa esperada para a população geral (Febrasgo).</div>
    </div>
  );
}

export interface ColunaTabela {
  titulo: string;
  alinhar?: "left" | "right" | "center";
  largura?: number | string;
  /** Não quebrar a linha (valores curtos: metas, datas, números). */
  semQuebra?: boolean;
}

/** Tabela simples. Para tabelas longas use TabelaEmBlocos (repete o cabeçalho a cada pedaço). */
export function Tabela({ colunas, linhas }: { colunas: ColunaTabela[]; linhas: ReactNode[][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
      <thead>
        <tr style={{ background: COR.lilasMedio }}>
          {colunas.map((c, i) => (
            <th
              key={i}
              style={{
                textAlign: c.alinhar ?? "left",
                padding: "7px 8px",
                fontWeight: 600,
                color: COR.texto,
                fontFamily: FONTE_TITULO,
                fontSize: 10,
                width: c.largura,
                whiteSpace: c.semQuebra ? "nowrap" : undefined,
                borderTopLeftRadius: i === 0 ? 8 : 0,
                borderTopRightRadius: i === colunas.length - 1 ? 8 : 0,
              }}
            >
              {c.titulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, r) => (
          <tr key={r} style={{ background: r % 2 === 1 ? COR.fundo : "#ffffff", borderBottom: `1px solid ${COR.borda}` }}>
            {l.map((cel, i) => (
              <td
                key={i}
                style={{
                  padding: "6px 8px",
                  textAlign: colunas[i]?.alinhar ?? "left",
                  color: COR.corpo,
                  verticalAlign: "middle",
                  whiteSpace: colunas[i]?.semQuebra ? "nowrap" : undefined,
                }}
              >
                {cel}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Tabela longa partida em blocos (cada pedaço cabe numa página e repete o cabeçalho). */
export function TabelaEmBlocos({
  colunas,
  linhas,
  porBloco = 22,
  vazio,
}: {
  colunas: ColunaTabela[];
  linhas: ReactNode[][];
  porBloco?: number;
  vazio?: string;
}) {
  if (linhas.length === 0) {
    return (
      <Bloco>
        <div style={{ fontSize: 11, color: COR.sutil, padding: "8px 0" }}>{vazio ?? "Nada a mostrar."}</div>
      </Bloco>
    );
  }
  const pedacos: ReactNode[][][] = [];
  for (let i = 0; i < linhas.length; i += porBloco) pedacos.push(linhas.slice(i, i + porBloco));
  return (
    <>
      {pedacos.map((p, i) => (
        <Bloco key={i}>
          <Tabela colunas={colunas} linhas={p} />
        </Bloco>
      ))}
    </>
  );
}

export function Nota({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 10, color: COR.muted, lineHeight: 1.55 }}>{children}</div>;
}

/** Cartão de pendência (gargalo) com cor por gravidade. */
export function CartaoGargalo({
  titulo,
  descricao,
  valor,
  cor,
  fundo,
}: {
  titulo: string;
  descricao: string;
  valor: number;
  cor: string;
  fundo: string;
}) {
  return (
    <div style={{ borderRadius: 12, padding: "12px 14px", background: fundo, border: `1px solid ${cor}33` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontFamily: FONTE_TITULO, fontWeight: 600, fontSize: 12, color: COR.texto, lineHeight: 1.3 }}>{titulo}</div>
        <div style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 24, color: cor, lineHeight: 1 }}>{valor}</div>
      </div>
      <div style={{ fontSize: 10, color: COR.corpo, marginTop: 6, lineHeight: 1.45 }}>{descricao}</div>
    </div>
  );
}
