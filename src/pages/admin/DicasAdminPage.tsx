import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Lightbulb, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface Dica {
  id: string;
  slot: number;
  texto: string;
  /** Item 19 — traduções opcionais. Vazio = o painel mostra o texto em português. */
  texto_en?: string | null;
  texto_es?: string | null;
  ativa: boolean;
}

const MAX_CHAR = 160;

export default function DicasAdminPage() {
  const { t } = useTranslation();
  const [dicas, setDicas] = useState<Dica[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("dicas_dashboard")
        // Item 19 — select("*") para tolerar a ausência das colunas de tradução
        // antes da migration ser aplicada.
        .select("*")
        .order("slot", { ascending: true });
      if (error) {
        toast.error(t("admin.dicas.loadError", { error: error.message }));
      } else {
        setDicas((data as Dica[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  const ativasValidas = useMemo(
    () => dicas.filter((d) => d.ativa && d.texto.trim().length > 0).length,
    [dicas],
  );

  const atualizar = (id: string, patch: Partial<Dica>) => {
    setDicas((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setDirty((prev) => ({ ...prev, [id]: true }));
  };

  const salvar = async () => {
    // Validação: nenhuma dica pode estar ativa com texto vazio
    const invalidas = dicas.filter((d) => d.ativa && d.texto.trim().length === 0);
    if (invalidas.length > 0) {
      toast.error(
        t("admin.dicas.emptyActiveError", { slots: invalidas.map((d) => d.slot).join(", ") }),
      );
      return;
    }
    const alteradas = dicas.filter((d) => dirty[d.id]);
    if (alteradas.length === 0) {
      toast.info(t("admin.dicas.noChanges"));
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const updates = alteradas.map((d) => {
      const payload: Record<string, unknown> = {
        texto: d.texto.trim(),
        ativa: d.ativa,
        updated_by: user?.id ?? null,
      };
      // Item 19 — só envia as traduções se as colunas existirem no registro
      // carregado (tolera o período antes da migration).
      if ("texto_en" in d) payload.texto_en = (d.texto_en ?? "").trim() || null;
      if ("texto_es" in d) payload.texto_es = (d.texto_es ?? "").trim() || null;
      return supabase.from("dicas_dashboard").update(payload).eq("id", d.id);
    });
    const results = await Promise.all(updates);
    const erros = results.filter((r) => r.error);
    setSaving(false);
    if (erros.length > 0) {
      toast.error(t("admin.dicas.saveFailed", { count: erros.length }));
    } else {
      toast.success(t("admin.dicas.saveSuccess", { count: alteradas.length }));
      setDirty({});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lightbulb className="h-6 w-6" />
          </div>
          <div>
            <h1
              className="text-3xl font-semibold text-foreground"
              style={{ fontFamily: "Sora, sans-serif" }}
            >
              {t("admin.dicas.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("admin.dicas.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Contador + salvar sticky */}
      <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="text-sm">
          <span className="font-semibold text-foreground">{ativasValidas}</span>{" "}
          <span className="text-muted-foreground">{t("admin.dicas.activeCount", { total: dicas.length })}</span>
          {ativasValidas === 0 && (
            <span className="ml-3 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              {t("admin.dicas.noneActive")}
            </span>
          )}
        </div>
        <Button onClick={salvar} disabled={saving || Object.keys(dirty).length === 0}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("admin.dicas.saveButton")}
          {Object.keys(dirty).length > 0 && !saving && (
            <span className="ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
              {Object.keys(dirty).length}
            </span>
          )}
        </Button>
      </div>

      {/* Lista de slots */}
      <div className="space-y-3">
        {dicas.map((d) => {
          const charCount = d.texto.length;
          const tooLong = charCount > MAX_CHAR;
          const isDirty = !!dirty[d.id];
          return (
            <div
              key={d.id}
              className={
                "rounded-xl border bg-card p-4 transition-shadow " +
                (isDirty ? "border-primary/40 shadow-sm" : "border-border")
              }
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                    {d.slot}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("admin.dicas.slotLabel", { slot: d.slot })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "text-xs " + (d.ativa ? "text-primary font-medium" : "text-muted-foreground")
                    }
                  >
                    {d.ativa ? t("admin.dicas.active") : t("admin.dicas.inactive")}
                  </span>
                  <Switch
                    checked={d.ativa}
                    onCheckedChange={(v) => atualizar(d.id, { ativa: v })}
                  />
                </div>
              </div>
              <Textarea
                value={d.texto}
                onChange={(e) => atualizar(d.id, { texto: e.target.value })}
                placeholder={t("admin.dicas.textPlaceholder")}
                rows={2}
                maxLength={MAX_CHAR + 40}
                className="resize-none"
              />

              {/* Item 19 — traduções opcionais; vazio = mostra o texto em português. */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("admin.dicas.textEnLabel")}
                  </label>
                  <Textarea
                    value={d.texto_en ?? ""}
                    onChange={(e) => atualizar(d.id, { texto_en: e.target.value })}
                    placeholder={t("admin.dicas.textTranslationPlaceholder")}
                    rows={2}
                    maxLength={MAX_CHAR + 40}
                    className="resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("admin.dicas.textEsLabel")}
                  </label>
                  <Textarea
                    value={d.texto_es ?? ""}
                    onChange={(e) => atualizar(d.id, { texto_es: e.target.value })}
                    placeholder={t("admin.dicas.textTranslationPlaceholder")}
                    rows={2}
                    maxLength={MAX_CHAR + 40}
                    className="resize-none"
                  />
                </div>
              </div>
              <div className="mt-1 flex justify-end">
                <span
                  className={
                    "text-xs " + (tooLong ? "text-red-600 font-medium" : "text-muted-foreground")
                  }
                >
                  {charCount}/{MAX_CHAR}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
