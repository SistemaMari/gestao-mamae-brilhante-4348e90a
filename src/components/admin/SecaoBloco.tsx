import { ReactNode } from "react";

interface SecaoBlocoProps {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  loading?: boolean;
  skeletonHeight?: number;
  skeleton?: ReactNode;
  children: ReactNode;
}

export function SecaoBloco({
  titulo,
  descricao,
  acao,
  loading,
  skeletonHeight = 120,
  skeleton,
  children,
}: SecaoBlocoProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3
            style={{
              fontFamily: "Sora, sans-serif",
              color: "#1E293B",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {titulo}
          </h3>
          {descricao && (
            <p
              style={{
                fontFamily: "Plus Jakarta Sans, sans-serif",
                color: "#64748B",
                fontSize: 13,
              }}
            >
              {descricao}
            </p>
          )}
        </div>
        {acao}
      </div>
      {loading ? (
        skeleton ?? (
          <div
            className="rounded-lg animate-pulse"
            style={{ background: "#E2E8F0", height: skeletonHeight }}
          />
        )
      ) : (
        children
      )}
    </section>
  );
}

export default SecaoBloco;
