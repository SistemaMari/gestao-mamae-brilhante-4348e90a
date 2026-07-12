import { useEffect, useMemo, useState } from "react";
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
  ativa: boolean;
}

const MAX_CHAR = 160;

export default function DicasAdminPage() {
  const [dicas, setDicas] = useState<Dica[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("dicas_dashboard")
        .select("id, slot, texto, ativa")
        .order("slot", { ascending: true });
      if (error) {
        toast.error("Erro ao carregar dicas: " + error.message);
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
        `Slot ${invalidas.map((d) => d.slot).join(", ")}: não é possível ativar dica vazia.`,
      );
      return;
    }
    const alteradas = dicas.filter((d) => dirty[d.id]);
    if (alteradas.length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const updates = alteradas.map((d) =>
      supabase
        .from("dicas_dashboard")
        .update({
          texto: d.texto.trim(),
          ativa: d.ativa,
          updated_by: user?.id ?? null,
        })
        .eq("id", d.id),
    );
    const results = await Promise.all(updates);
    const erros = results.filter((r) => r.error);
    setSaving(false);
    if (erros.length > 0) {
      toast.error(`Falha ao salvar ${erros.length} slot(s).`);
    } else {
      toast.success(`${alteradas.length} dica(s) atualizada(s).`);
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
              Dicas do dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Edite as frases exibidas no card "Dica do dia" do painel institucional. Uma dica ativa é
              sorteada por dia.
            </p>
          </div>
        </div>
      </div>

      {/* Contador + salvar sticky */}
      <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="text-sm">
          <span className="font-semibold text-foreground">{ativasValidas}</span>{" "}
          <span className="text-muted-foreground">de {dicas.length} dicas ativas</span>
          {ativasValidas === 0 && (
            <span className="ml-3 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              Nenhuma dica ativa — o painel usará frases padrão.
            </span>
          )}
        </div>
        <Button onClick={salvar} disabled={saving || Object.keys(dirty).length === 0}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar alterações
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
                    Slot {d.slot} de 30
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "text-xs " + (d.ativa ? "text-primary font-medium" : "text-muted-foreground")
                    }
                  >
                    {d.ativa ? "Ativa" : "Inativa"}
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
                placeholder="Digite a frase que aparecerá no card 'Dica do dia'…"
                rows={2}
                maxLength={MAX_CHAR + 40}
                className="resize-none"
              />
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
