import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Image as ImageIcon, Loader2, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

/**
 * MAQUETE DE DEMONSTRAÇÃO — isolada, sem API, sem Supabase, sem IA.
 * Rota: /demo/perfil-por-foto. Nenhum dado é salvo.
 */

type Etapa = 1 | 2 | 3 | 4;
type Celula = { valor: string; daFoto: boolean; incerta: boolean };
type Linha = { dia: string; jejum: Celula; cafe: Celula; almoco: Celula; jantar: Celula };

const COLS = [
  { key: "jejum", titulo: "Jejum", meta: "< 95 mg/dL", limite: 95 },
  { key: "cafe", titulo: "1h pós café", meta: "< 140", limite: 140 },
  { key: "almoco", titulo: "1h pós almoço", meta: "< 140", limite: 140 },
  { key: "jantar", titulo: "1h pós jantar", meta: "< 140", limite: 140 },
] as const;

const vazia = (): Celula => ({ valor: "", daFoto: false, incerta: false });

const gradeVazia = (): Linha[] =>
  Array.from({ length: 7 }, (_, i) => ({
    dia: `Dia ${i + 1}`,
    jejum: vazia(),
    cafe: vazia(),
    almoco: vazia(),
    jantar: vazia(),
  }));

const LIDOS: [string, string, string, string][] = [
  ["92", "112", "120", "125"],
  ["92", "114", "120", "125"],
  ["96", "112", "120", "125"],
  ["95", "114", "", "125"],
  ["96", "112", "125", "125"],
  ["", "114", "120", "125"],
  ["92", "120", "125", "125"],
];

const gradeLida = (): Linha[] =>
  LIDOS.map((vals, i) => {
    const cel = (v: string): Celula =>
      v === "" ? { valor: "", daFoto: true, incerta: true } : { valor: v, daFoto: true, incerta: false };
    return { dia: `Dia ${i + 1}`, jejum: cel(vals[0]), cafe: cel(vals[1]), almoco: cel(vals[2]), jantar: cel(vals[3]) };
  });

/** Tabelinha manuscrita fictícia, embutida como data-URI SVG. */
const FOTO_EXEMPLO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="820" viewBox="0 0 640 820">
<rect width="640" height="820" fill="#f6f1e4"/>
<g stroke="#8a8778" stroke-width="1.5" fill="none">
${Array.from({ length: 9 }, (_, i) => `<path d="M30 ${90 + i * 78 + (i % 2 ? 3 : -2)} L610 ${92 + i * 78}"/>`).join("")}
${[30, 190, 300, 415, 530, 610].map((x, i) => `<path d="M${x} 88 L${x + (i % 2 ? 4 : -3)} 790"/>`).join("")}
</g>
<g font-family="Segoe Script, Bradley Hand, cursive" fill="#1f3d7a">
<text x="40" y="60" font-size="30">Controle glicêmico - Maria</text>
<text x="45" y="120" font-size="22">dia</text><text x="205" y="118" font-size="22">jej</text>
<text x="315" y="122" font-size="22">café</text><text x="428" y="119" font-size="22">almoço</text><text x="545" y="121" font-size="22">jantar</text>
${LIDOS.map((r, i) => {
  const y = 200 + i * 78;
  const cells = [r[0] || "—", r[1], r[2] || "—", r[3]];
  const xs = [200, 312, 425, 545];
  return (
    `<text x="50" y="${y}" font-size="24">${i + 1}</text>` +
    cells.map((c, j) => `<text x="${xs[j]}" y="${y + (j % 2 ? 5 : -4)}" font-size="26" transform="rotate(${j % 2 ? -2 : 2} ${xs[j]} ${y})">${c}</text>`).join("")
  );
}).join("")}
</g></svg>`);

export default function DemoPerfilPorFoto() {
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [foto, setFoto] = useState<string | null>(null);
  const [grade, setGrade] = useState<Linha[]>(gradeVazia);
  const [modalFoto, setModalFoto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dataAnexo = "21/08/2026";

  function processar(src: string) {
    setFoto(src);
    setEtapa(2);
    window.setTimeout(() => {
      setGrade(gradeLida());
      setEtapa(3);
    }, 2000);
  }

  function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => processar(String(reader.result));
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  function editar(i: number, key: (typeof COLS)[number]["key"], valor: string) {
    setGrade((g) =>
      g.map((l, idx) => (idx === i ? { ...l, [key]: { ...l[key], valor, incerta: false } } : l)),
    );
  }

  function confirmar() {
    setGrade((g) =>
      g.map((l) => {
        const out = { ...l };
        for (const c of COLS) out[c.key] = { ...l[c.key], daFoto: false, incerta: false };
        return out;
      }),
    );
    setEtapa(4);
  }

  function recomeçar() {
    setGrade(gradeVazia());
    setFoto(null);
    setEtapa(1);
  }

  const incertas = grade.reduce(
    (n, l) => n + COLS.filter((c) => l[c.key].incerta).length,
    0,
  );

  const Grade = ({ editavel, marcada }: { editavel: boolean; marcada: boolean }) => (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#D6BCFA" }}>
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr style={{ background: "#F5F0FF" }}>
            <th className="px-2 py-2 text-left font-semibold" style={{ color: "#5B21B6" }}>Dia</th>
            {COLS.map((c) => (
              <th key={c.key} className="px-2 py-2 text-center font-semibold" style={{ color: "#5B21B6" }}>
                <div>{c.titulo}</div>
                <div className="text-[10px] font-normal text-muted-foreground">{c.meta}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grade.map((l, i) => (
            <tr key={l.dia} className="border-t" style={{ borderColor: "#EDE4FB" }}>
              <td className="px-2 py-1.5 font-medium" style={{ color: "#5B21B6" }}>{l.dia}</td>
              {COLS.map((c) => {
                const cel = l[c.key];
                const num = Number(cel.valor);
                const fora = cel.valor !== "" && !Number.isNaN(num) && num >= c.limite;
                const style: React.CSSProperties = {};
                if (marcada && cel.daFoto) {
                  style.background = fora ? "#FDECEC" : "#FEF9E7";
                  style.borderLeft = `3px solid ${cel.incerta ? "#B45309" : "#F0C36D"}`;
                } else if (fora) {
                  style.background = "#FDECEC";
                }
                return (
                  <td key={c.key} className="px-1.5 py-1.5 text-center" style={style}>
                    <input
                      inputMode="numeric"
                      readOnly={!editavel}
                      value={cel.valor}
                      onChange={(e) => editar(i, c.key, e.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="w-full max-w-[64px] rounded-md border bg-white/70 px-1 py-1 text-center outline-none focus:ring-2"
                      style={{
                        borderColor: marcada && cel.incerta ? "#B45309" : "#E4DAF7",
                        color: fora ? "#B91C1C" : "#1E293B",
                      }}
                    />
                    {marcada && cel.incerta && (
                      <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-medium" style={{ color: "#B45309" }}>
                        <AlertTriangle className="h-3 w-3" /> confira
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFE" }}>
      <div
        className="px-4 py-2 text-center text-[11px] font-semibold tracking-wide"
        style={{ background: "#EDE9FE", color: "#5B21B6" }}
      >
        DEMONSTRAÇÃO — dados fictícios, nenhuma informação é salva
      </div>

      <div className="mx-auto max-w-4xl px-4 py-5">
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#D6BCFA" }}>
          <h1 className="text-base font-bold sm:text-lg" style={{ color: "#5B21B6" }}>
            Perfil glicêmico — 4 pontos
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Gestante: Maria Aparecida · IG: 29s 3d · Data: 21/08/2026
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onArquivo}
        />

        {/* ETAPA 1 */}
        {etapa === 1 && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1 text-white hover:opacity-90"
                style={{ background: "#5B21B6" }}
                onClick={() => inputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" /> Preencher por foto
              </Button>
              <Button variant="outline" className="flex-1" style={{ borderColor: "#D6BCFA", color: "#5B21B6" }}>
                Digitar manualmente
              </Button>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>Você pode digitar normalmente — a foto é um atalho, não uma substituição.</span>
              <button
                className="self-start underline"
                style={{ color: "#5B21B6" }}
                onClick={() => processar(FOTO_EXEMPLO)}
              >
                usar foto de exemplo
              </button>
            </div>
            <Grade editavel marcada={false} />
          </div>
        )}

        {/* ETAPA 2 */}
        {etapa === 2 && (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border bg-white py-16" style={{ borderColor: "#D6BCFA" }}>
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#5B21B6" }} />
            <p className="text-sm font-medium" style={{ color: "#5B21B6" }}>
              Lendo o controle da gestante...
            </p>
          </div>
        )}

        {/* ETAPA 3 */}
        {etapa === 3 && (
          <div className="mt-4 space-y-3">
            <div
              className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm"
              style={{ background: "#FEF9E7", borderColor: "#F0C36D", color: "#92400E" }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Confira os valores antes de salvar. {incertas} campos não puderam ser lidos com segurança.
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-2" style={{ borderColor: "#D6BCFA" }}>
                {foto && <img src={foto} alt="Foto do controle glicêmico da gestante" className="w-full rounded-lg" />}
              </div>
              <div className="space-y-2">
                <Grade editavel marcada />
                <p className="text-[11px] text-muted-foreground">
                  <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: "#FEF9E7", border: "1px solid #F0C36D" }} />
                  Células em amarelo vieram da foto. Valores em vermelho estão fora da meta.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1 text-white hover:opacity-90" style={{ background: "#5B21B6" }} onClick={confirmar}>
                Confirmar e salvar
              </Button>
              <Button variant="outline" className="flex-1" style={{ borderColor: "#D6BCFA", color: "#5B21B6" }} onClick={() => inputRef.current?.click()}>
                Tirar outra foto
              </Button>
              <Button variant="ghost" className="flex-1" onClick={recomeçar}>
                Descartar e digitar
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 4 */}
        {etapa === 4 && (
          <div className="mt-4 space-y-3">
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm"
              style={{ background: "#ECFDF5", borderColor: "#6EE7B7", color: "#065F46" }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Perfil glicêmico salvo. A foto ficou anexada a esta ficha.
            </div>

            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold" style={{ color: "#5B21B6" }}>
                Perfil glicêmico registrado
              </h2>
              <Button size="sm" variant="outline" style={{ borderColor: "#D6BCFA", color: "#5B21B6" }} onClick={() => setModalFoto(true)}>
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Ver foto original
              </Button>
            </div>

            <Grade editavel marcada={false} />

            <Button variant="ghost" onClick={recomeçar} style={{ color: "#5B21B6" }}>
              <RotateCcw className="mr-2 h-4 w-4" /> Recomeçar demonstração
            </Button>
          </div>
        )}
      </div>

      <Dialog open={modalFoto} onOpenChange={setModalFoto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: "#5B21B6" }}>Foto original</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Anexada em {dataAnexo}</p>
          {foto && <img src={foto} alt="Foto original do controle glicêmico" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
