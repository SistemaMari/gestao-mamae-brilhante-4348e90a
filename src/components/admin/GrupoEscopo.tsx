import { ReactNode } from "react";
import { Briefcase, Building2 } from "lucide-react";

type Escopo = "consultorio" | "institucional";

const STYLES: Record<
  Escopo,
  { label: string; sub: string; bg: string; fg: string; bar: string; ring: string; icon: ReactNode }
> = {
  consultorio: {
    label: "Consultório",
    sub: "Profissionais autônomos, assinantes individuais.",
    bg: "linear-gradient(90deg, #F5F0FF 0%, #EDE9FE 100%)",
    fg: "#6D28D9",
    bar: "#7C4DBA",
    ring: "#DDD6FE",
    icon: <Briefcase size={22} style={{ color: "#6D28D9" }} />,
  },
  institucional: {
    label: "Institucional",
    sub: "Profissionais vinculados a UBS, hospitais e clínicas.",
    bg: "linear-gradient(90deg, #ECFDF5 0%, #CCFBF1 100%)",
    fg: "#0F766E",
    bar: "#0F766E",
    ring: "#99F6E4",
    icon: <Building2 size={22} style={{ color: "#0F766E" }} />,
  },
};

interface Props {
  escopo: Escopo;
  titulo?: string;
  descricao?: string;
  children: ReactNode;
}

export function GrupoEscopo({ escopo, titulo, descricao, children }: Props) {
  const s = STYLES[escopo];
  return (
    <section className="space-y-5">
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{
          background: s.bg,
          borderLeft: `6px solid ${s.bar}`,
          border: `1px solid ${s.ring}`,
        }}
      >
        <div
          className="rounded-xl bg-white flex items-center justify-center"
          style={{ width: 44, height: 44, border: `1px solid ${s.ring}` }}
        >
          {s.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                background: "white",
                color: s.fg,
                border: `1px solid ${s.ring}`,
                fontFamily: "Plus Jakarta Sans, sans-serif",
                letterSpacing: "0.08em",
              }}
            >
              Escopo · {s.label}
            </span>
            {titulo && (
              <h3
                className="text-lg font-semibold"
                style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
              >
                {titulo}
              </h3>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: "#475569" }}>
            {descricao ?? s.sub}
          </p>
        </div>
      </div>
      <div
        className="pl-0 md:pl-4 space-y-6 md:border-l-2"
        style={{ borderColor: escopo === "consultorio" ? "#DDD6FE" : "#99F6E4" }}
      >
        {children}
      </div>
    </section>
  );
}

export default GrupoEscopo;
