// Motor do relatório em PDF: desenha um elemento React fora da tela (coluna de
// LARGURA_RELATORIO px), captura cada [data-bloco] como imagem e encaixa os
// blocos em páginas A4 — um bloco nunca é cortado (a não ser que sozinho seja
// maior que a página), títulos de seção descem junto com o bloco seguinte, e
// toda página ganha o cabeçalho da marca ([data-cabecalho]) e o rodapé.
import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { LARGURA_RELATORIO } from "@/components/relatorioPdf/primitivos";

const A4 = { w: 595.28, h: 841.89 }; // pt
const MARGEM_X = 30; // pt
const MARGEM_TOPO = 24; // pt
const ESPACO_CABECALHO = 12; // pt entre o cabeçalho e o conteúdo
const ALTURA_RODAPE = 28; // pt
const ESPACO_ENTRE_BLOCOS = 8; // pt
const JPEG_QUALIDADE = 0.92;

async function carregarFontes() {
  try {
    await Promise.all([
      document.fonts.load('600 16px "Sora"'),
      document.fonts.load('700 20px "Sora"'),
      document.fonts.load('400 14px "Plus Jakarta Sans"'),
      document.fonts.load('600 14px "Plus Jakarta Sans"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* fallback: fonte do sistema */
  }
}

/** Altura máxima de um canvas com folga (Chrome/Safari limitam em ~16 mil px). */
const LIMITE_CANVAS_PX = 15000;

function captureToCanvas(el: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  return html2canvas(el, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
}

function baixarPdf(pdf: jsPDF, filename: string) {
  const url = URL.createObjectURL(pdf.output("blob"));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface OpcoesRelatorio {
  /** Texto à esquerda do rodapé (ex.: "Unidade Centro · 01/07/2026 a 30/09/2026"). */
  rodape: string;
  nomeArquivo: string;
}

// Quadro de pintura com plano B: em aba em segundo plano o navegador pausa o
// requestAnimationFrame, e o PDF ficava parado até a pessoa voltar para a aba.
const quadro = () =>
  new Promise<void>((r) => {
    const t = setTimeout(r, 60);
    requestAnimationFrame(() => {
      clearTimeout(t);
      r();
    });
  });

async function esperarPintura(ms = 700) {
  await quadro();
  await quadro();
  await new Promise((r) => setTimeout(r, ms));
  await quadro();
}

async function esperarImagens(raiz: HTMLElement) {
  const imgs = Array.from(raiz.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((ok) => {
            img.onload = () => ok();
            img.onerror = () => ok();
          }),
    ),
  );
}

export async function gerarRelatorioPdf(
  conteudo: ReactElement,
  opcoes: OpcoesRelatorio,
): Promise<{ ok: boolean; tempoMs: number; error?: string }> {
  const t0 = performance.now();
  const host = document.createElement("div");
  host.style.cssText = `position: fixed; left: -12000px; top: 0; width: ${LARGURA_RELATORIO}px; background: #ffffff; z-index: -1;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await carregarFontes();
    root.render(createElement("div", null, conteudo));
    await esperarPintura();
    await esperarImagens(host);

    const cabecalhoEl = host.querySelector<HTMLElement>("[data-cabecalho]");
    const blocos = Array.from(host.querySelectorAll<HTMLElement>("[data-bloco]")).filter(
      (el) => !el.parentElement?.closest("[data-bloco]"),
    );
    if (blocos.length === 0) throw new Error("Relatório vazio");

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const larguraUtil = A4.w - MARGEM_X * 2;
    const k = larguraUtil / LARGURA_RELATORIO; // pt por px

    // Recorte de um elemento. Rápido: uma única foto do relatório inteiro, recortada
    // por posição (cada chamada ao html2canvas clona o app todo; uma por bloco levava
    // quase 2 minutos). Relatório muito longo para um canvas só: foto por bloco.
    const alturaTotal = host.scrollHeight;
    const escalaUnica = Math.min(2, LIMITE_CANVAS_PX / Math.max(alturaTotal, 1));
    const fotoInteira = escalaUnica >= 1.25 ? await captureToCanvas(host, escalaUnica) : null;
    const topoHost = host.getBoundingClientRect().top;
    const recortar = async (el: HTMLElement): Promise<HTMLCanvasElement> => {
      if (!fotoInteira) return captureToCanvas(el, 2);
      const y0 = Math.round((el.getBoundingClientRect().top - topoHost) * escalaUnica);
      const h = Math.max(1, Math.round(el.offsetHeight * escalaUnica));
      const c = document.createElement("canvas");
      c.width = fotoInteira.width;
      c.height = h;
      c.getContext("2d")!.drawImage(fotoInteira, 0, y0, fotoInteira.width, h, 0, 0, fotoInteira.width, h);
      return c;
    };

    // Cabeçalho: recortado uma vez, repetido em todas as páginas.
    let cabecalho: { url: string; h: number } | null = null;
    if (cabecalhoEl) {
      const c = await recortar(cabecalhoEl);
      cabecalho = { url: c.toDataURL("image/jpeg", JPEG_QUALIDADE), h: cabecalhoEl.offsetHeight * k };
    }
    const topoConteudo = MARGEM_TOPO + (cabecalho ? cabecalho.h + ESPACO_CABECALHO : 0);
    const limite = A4.h - ALTURA_RODAPE;
    const alturaUtil = limite - topoConteudo;

    const alturas = blocos.map((el) => el.offsetHeight * k);
    let y = topoConteudo;
    let paginaVazia = true;
    const novaPagina = () => {
      pdf.addPage();
      y = topoConteudo;
      paginaVazia = true;
    };

    for (let i = 0; i < blocos.length; i++) {
      const el = blocos[i];
      let precisa = alturas[i];
      // Título de seção: só fica nesta página se o bloco seguinte também couber
      // (em cadeia: título da seção + título do grupo + começo da tabela).
      for (let j = i; j + 1 < blocos.length && blocos[j].hasAttribute("data-manter-com-proximo"); j++) {
        const prox = blocos[j + 1];
        precisa += ESPACO_ENTRE_BLOCOS + (prox.hasAttribute("data-manter-com-proximo") ? alturas[j + 1] : Math.min(alturas[j + 1], alturaUtil * 0.5));
      }
      if (!paginaVazia && y + precisa > limite) novaPagina();

      const canvas = await recortar(el);
      const hPt = alturas[i];
      if (hPt <= alturaUtil) {
        pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_QUALIDADE), "JPEG", MARGEM_X, y, larguraUtil, hPt);
        y += hPt + ESPACO_ENTRE_BLOCOS;
        paginaVazia = false;
        continue;
      }
      // Bloco maior que uma página inteira: fatia (raro — tabelas já vêm em pedaços).
      if (!paginaVazia) novaPagina();
      const pxPorPt = canvas.height / hPt;
      let feito = 0;
      while (feito < hPt) {
        const fatiaPt = Math.min(alturaUtil, hPt - feito);
        const fatia = document.createElement("canvas");
        fatia.width = canvas.width;
        fatia.height = Math.round(fatiaPt * pxPorPt);
        fatia
          .getContext("2d")!
          .drawImage(canvas, 0, Math.round(feito * pxPorPt), canvas.width, fatia.height, 0, 0, canvas.width, fatia.height);
        pdf.addImage(fatia.toDataURL("image/jpeg", JPEG_QUALIDADE), "JPEG", MARGEM_X, y, larguraUtil, fatiaPt);
        feito += fatiaPt;
        y += fatiaPt + ESPACO_ENTRE_BLOCOS;
        paginaVazia = false;
        if (feito < hPt) novaPagina();
      }
    }

    // Cabeçalho e rodapé em todas as páginas.
    const total = pdf.getNumberOfPages();
    const geradoEm = new Date();
    const carimbo = `Gerado em ${geradoEm.toLocaleDateString("pt-BR")} às ${geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    for (let p = 1; p <= total; p++) {
      pdf.setPage(p);
      if (cabecalho) pdf.addImage(cabecalho.url, "JPEG", MARGEM_X, MARGEM_TOPO, larguraUtil, cabecalho.h);
      pdf.setDrawColor(233, 229, 245);
      pdf.setLineWidth(0.6);
      pdf.line(MARGEM_X, A4.h - ALTURA_RODAPE + 6, A4.w - MARGEM_X, A4.h - ALTURA_RODAPE + 6);
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${opcoes.rodape} · ${carimbo}`, MARGEM_X, A4.h - 12, { maxWidth: larguraUtil - 70 });
      pdf.text(`Página ${p} de ${total}`, A4.w - MARGEM_X, A4.h - 12, { align: "right" });
    }

    baixarPdf(pdf, opcoes.nomeArquivo);
    return { ok: true, tempoMs: Math.round(performance.now() - t0) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Falha ao gerar PDF";
    console.error("[relatorioPdf] erro:", e);
    return { ok: false, tempoMs: Math.round(performance.now() - t0), error: msg };
  } finally {
    try {
      root.unmount();
    } catch {
      /* ignore */
    }
    host.remove();
  }
}
