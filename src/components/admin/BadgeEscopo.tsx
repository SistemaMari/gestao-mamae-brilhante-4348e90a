export type EscopoBadge = "consultorio" | "institucional" | "ambos";

const STYLES: Record<EscopoBadge, { label: string; bg: string; fg: string; border: string }> = {
  consultorio: {
    label: "Consultório",
    bg: "#EDE9FE",
    fg: "#6D28D9",
    border: "#DDD6FE",
  },
  institucional: {
    label: "Institucional",
    bg: "#CCFBF1",
    fg: "#0F766E",
    border: "#99F6E4",
  },
  ambos: {
    label: "Consultório + Institucional",
    bg: "#F1F5F9",
    fg: "#334155",
    border: "#E2E8F0",
  },
};

export function BadgeEscopo({ escopo }: { escopo: EscopoBadge }) {
  const s = STYLES[escopo];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontFamily: "Plus Jakarta Sans, sans-serif",
        letterSpacing: "0.04em",
      }}
      title={`Escopo: ${s.label}`}
    >
      {s.label}
    </span>
  );
}

export default BadgeEscopo;
