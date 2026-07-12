/**
 * Grade glicêmica readonly compacta para o laudo.
 * 4 ou 6 pontos × N dias, células coloridas conforme alvo, "—" para vazio.
 */
import { useTranslation } from "react-i18next";

export interface GradeGlicemicaProps {
  pontos: 4 | 6;
  /** Matriz [dia][ponto] = valor mg/dL ou null */
  valores: (number | null)[][];
  percentual: number;
  diasPreenchidos?: number;
}

const PONTOS_4_KEYS = ['jejum', 'posCafe', 'posAlmoco', 'posJantar'];
const PONTOS_6_KEYS = ['jejum', 'posCafe', 'preAlmoco', 'posAlmoco', 'preJantar', 'posJantar'];

// Alvos (mg/dL): jejum < 95; pré-prandial 70–100; pós-prandial ≤ 140 (1h)
function dentroMeta(valor: number, indicePonto: number, pontos: 4 | 6): boolean {
  // 4 pontos: idx 0 = jejum (< 95); demais = pós (≤ 140)
  // 6 pontos: idx 0 = jejum (< 95); idx 2 e 4 = pré-prandial (70–100); demais = pós (≤ 140)
  if (pontos === 4) {
    return indicePonto === 0 ? valor < 95 : valor <= 140;
  }
  if (indicePonto === 0) return valor < 95;
  if (indicePonto === 2 || indicePonto === 4) return valor >= 70 && valor <= 100;
  return valor <= 140;
}

export default function GradeGlicemicaCompacta({ pontos, valores, percentual, diasPreenchidos }: GradeGlicemicaProps) {
  const { t } = useTranslation();
  const labelKeys = pontos === 4 ? PONTOS_4_KEYS : PONTOS_6_KEYS;
  const labels = labelKeys.map((k) => t(`laudo.gradeGlicemica.pontos.${k}`));
  const dias = valores.length;
  const adequado = percentual >= 70;

  return (
    <section className="laudo-grade rounded-xl border border-border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-heading text-xs font-semibold text-foreground">
          {t("laudo.gradeGlicemica.title", { pontos, dias })}
        </h3>
        {diasPreenchidos !== undefined && (
          <span className="text-[10px] text-muted-foreground">
            {t("laudo.gradeGlicemica.diasPreenchidos", { preenchidos: diasPreenchidos, dias })}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="border border-border bg-muted px-1.5 py-1 text-left font-semibold text-foreground">{t("laudo.gradeGlicemica.dia")}</th>
              {labels.map((l) => (
                <th key={l} className="border border-border bg-muted px-1.5 py-1 text-center font-semibold text-foreground">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {valores.map((linha, idxDia) => (
              <tr key={idxDia}>
                <td className="border border-border bg-muted/50 px-1.5 py-1 text-center font-medium text-foreground">
                  {idxDia + 1}
                </td>
                {linha.map((v, idxPonto) => {
                  if (v == null) {
                    return (
                      <td key={idxPonto} className="border border-border bg-white px-1.5 py-1 text-center text-muted-foreground">
                        —
                      </td>
                    );
                  }
                  const ok = dentroMeta(v, idxPonto, pontos);
                  return (
                    <td
                      key={idxPonto}
                      className={`border border-border px-1.5 py-1 text-center font-medium ${
                        ok ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'
                      }`}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t("laudo.gradeGlicemica.dentroDaMeta")}</span>
        <span className={`font-semibold ${adequado ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
          {t("laudo.gradeGlicemica.resultado", {
            percentual,
            controle: adequado
              ? t("laudo.gradeGlicemica.controleAdequado")
              : t("laudo.gradeGlicemica.controleInadequado"),
          })}
        </span>
      </div>
    </section>
  );
}
