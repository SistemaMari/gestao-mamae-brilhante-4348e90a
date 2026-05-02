import { useEffect, useMemo, useState } from "react";
import { Loader2, Copy, Check, AlertCircle, UserPlus, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Perfil = "admin" | "consultorio" | "institucional" | "gestor" | "gestor_geral";

interface Unidade { id: string; nome: string; }
interface Plano { id: string; slug: string; nome: string; }

interface ItemLista {
  nome: string;
  email: string;
  perfil: Perfil;
  plano_slug: string | null;
  unidade_id: string | null;
  // campos brutos da importação (para mostrar o que veio errado)
  raw?: string;
  erro?: string;
}

interface Resultado {
  email: string;
  ok: boolean;
  motivo?: string;
  action_link?: string;
}

const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Admin",
  consultorio: "Médico (consultório)",
  institucional: "Médico (institucional)",
  gestor: "Gestor de unidade",
  gestor_geral: "Gestor geral institucional",
};

const PERFIS_QUE_PRECISAM_UNIDADE: Perfil[] = ["institucional", "gestor", "gestor_geral"];
const PERFIS_QUE_TEM_PLANO: Perfil[] = ["consultorio", "institucional", "gestor"];

export default function UsuariosPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregandoMeta, setCarregandoMeta] = useState(true);

  useEffect(() => {
    (async () => {
      const [u, p] = await Promise.all([
        supabase.from("unidades").select("id, nome").order("nome"),
        supabase.from("planos").select("id, slug, nome").order("ordem"),
      ]);
      setUnidades(u.data ?? []);
      setPlanos(p.data ?? []);
      setCarregandoMeta(false);
    })();
  }, []);

  if (carregandoMeta) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#9b87f5]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1F2937] font-[Sora]">Criar usuários</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Cadastre contas sem senha. O sistema envia um link "Definir senha" por e-mail.
        </p>
      </div>

      <Alert className="bg-[#FEF3C7] border-[#FDE68A]">
        <AlertCircle className="h-4 w-4 text-[#92400E]" />
        <AlertTitle className="text-[#92400E]">Pendência: Marilza, Iracema e Claudia</AlertTitle>
        <AlertDescription className="text-[#92400E]">
          O documento original lista essas usuárias como "Admin", mas também menciona
          "gestor geral institucional". Confirmar com a Mari antes de criá-las
          — pode ser que o perfil correto seja <strong>Gestor geral</strong> (ligado a
          unidade), e não Admin de plataforma.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">
            <UserPlus className="h-4 w-4 mr-2" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="lote">
            <Upload className="h-4 w-4 mr-2" />
            Importar lista
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <FormIndividual unidades={unidades} planos={planos} />
        </TabsContent>

        <TabsContent value="lote">
          <FormLote unidades={unidades} planos={planos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- FORM INDIVIDUAL ----------

function FormIndividual({
  unidades,
  planos,
}: {
  unidades: Unidade[];
  planos: Plano[];
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("consultorio");
  const [planoSlug, setPlanoSlug] = useState<string>("inicial");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const precisaUnidade = PERFIS_QUE_PRECISAM_UNIDADE.includes(perfil);
  const temPlano = PERFIS_QUE_TEM_PLANO.includes(perfil);

  async function submit() {
    if (!nome.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    if (precisaUnidade && !unidadeId) {
      toast.error("Selecione a unidade.");
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("criar-usuario", {
        body: {
          item: {
            nome: nome.trim(),
            email: email.trim().toLowerCase(),
            perfil,
            plano_slug: temPlano ? planoSlug : null,
            unidade_id: precisaUnidade ? unidadeId : null,
          },
        },
      });
      if (error) throw error;
      const r: Resultado | undefined = data?.resultados?.[0];
      if (!r) throw new Error("Resposta vazia.");
      setResultado(r);
      if (r.ok) {
        toast.success("Conta criada e link de definir senha gerado.");
        setNome("");
        setEmail("");
      } else {
        toast.error(r.motivo ?? "Falha ao criar.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Dra. Marilza" />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" />
        </div>
        <div className="space-y-2">
          <Label>Perfil</Label>
          <Select value={perfil} onValueChange={(v) => setPerfil(v as Perfil)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERFIL_LABEL) as Perfil[]).map((p) => (
                <SelectItem key={p} value={p}>{PERFIL_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {temPlano && (
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={planoSlug} onValueChange={setPlanoSlug}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.id} value={p.slug}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {precisaUnidade && (
          <div className="space-y-2 md:col-span-2">
            <Label>Unidade</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={enviando} className="bg-[#9b87f5] hover:bg-[#7E69AB]">
          {enviando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando…</> : "Criar conta"}
        </Button>
      </div>

      {resultado && (
        <ResultadoCard resultado={resultado} />
      )}
    </Card>
  );
}

// ---------- FORM LOTE ----------

function FormLote({ unidades, planos }: { unidades: Unidade[]; planos: Plano[] }) {
  const [texto, setTexto] = useState(
`# Cole abaixo no formato (um por linha, separado por vírgula):
# nome, email, perfil, plano, unidade
# Perfis aceitos: admin, consultorio, institucional, gestor, gestor_geral
# Plano aceitos: inicial, intermediario, profissional (ou - se admin)
# Unidade: nome exato da unidade (deixe - se admin/consultorio)
Raul Silva, raul@email.com, admin, -, -
Moara Souza, gestaodaoh@gmail.com, consultorio, profissional, -`
  );
  const [itens, setItens] = useState<ItemLista[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const unidadePorNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of unidades) m.set(u.nome.trim().toLowerCase(), u.id);
    return m;
  }, [unidades]);

  const planoSlugs = useMemo(() => new Set(planos.map((p) => p.slug)), [planos]);

  function parsear() {
    const linhas = texto
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    const novos: ItemLista[] = [];
    for (const linha of linhas) {
      const partes = linha.split(",").map((s) => s.trim());
      if (partes.length < 3) {
        novos.push({
          raw: linha, nome: "", email: "", perfil: "consultorio",
          plano_slug: null, unidade_id: null,
          erro: "Esperado: nome, email, perfil, plano, unidade",
        });
        continue;
      }
      const [nome, email, perfilStr, planoStr = "-", unidadeStr = "-"] = partes;
      let erro: string | undefined;

      const perfil = perfilStr.toLowerCase().replace(/-/g, "_") as Perfil;
      if (!(["admin", "consultorio", "institucional", "gestor", "gestor_geral"] as Perfil[]).includes(perfil)) {
        erro = `Perfil inválido: "${perfilStr}"`;
      }
      let planoSlug: string | null = null;
      if (PERFIS_QUE_TEM_PLANO.includes(perfil)) {
        const slug = (planoStr || "inicial").toLowerCase();
        if (slug === "-" || !slug) {
          planoSlug = "inicial";
        } else if (planoSlugs.has(slug)) {
          planoSlug = slug;
        } else {
          erro = erro ?? `Plano inválido: "${planoStr}"`;
        }
      }
      let unidadeId: string | null = null;
      if (PERFIS_QUE_PRECISAM_UNIDADE.includes(perfil)) {
        if (!unidadeStr || unidadeStr === "-") {
          erro = erro ?? "Unidade obrigatória para esse perfil.";
        } else {
          const id = unidadePorNome.get(unidadeStr.toLowerCase());
          if (!id) erro = erro ?? `Unidade não encontrada: "${unidadeStr}"`;
          else unidadeId = id;
        }
      }
      if (!nome) erro = erro ?? "Nome vazio.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) {
        erro = erro ?? `E-mail inválido: "${email}"`;
      }

      novos.push({
        raw: linha,
        nome,
        email: (email || "").toLowerCase(),
        perfil,
        plano_slug: planoSlug,
        unidade_id: unidadeId,
        erro,
      });
    }
    setItens(novos);
    setResultados([]);
  }

  async function criarTodos() {
    const validos = itens.filter((i) => !i.erro);
    if (validos.length === 0) {
      toast.error("Nenhum item válido para criar.");
      return;
    }
    setEnviando(true);
    setResultados([]);
    try {
      const { data, error } = await supabase.functions.invoke("criar-usuario", {
        body: {
          itens: validos.map((i) => ({
            nome: i.nome,
            email: i.email,
            perfil: i.perfil,
            plano_slug: i.plano_slug,
            unidade_id: i.unidade_id,
          })),
        },
      });
      if (error) throw error;
      setResultados(data?.resultados ?? []);
      const oks = (data?.resultados ?? []).filter((r: Resultado) => r.ok).length;
      toast.success(`${oks} de ${validos.length} contas criadas.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        <Label>Lista (CSV)</Label>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={parsear}>Validar lista</Button>
        <Button
          onClick={criarTodos}
          disabled={enviando || itens.length === 0 || itens.every((i) => !!i.erro)}
          className="bg-[#9b87f5] hover:bg-[#7E69AB]"
        >
          {enviando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando…</> : "Criar válidos"}
        </Button>
      </div>

      {itens.length > 0 && (
        <div className="border border-[#E2E8F0] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-[#64748B]">
              <tr>
                <th className="text-left p-2">Nome</th>
                <th className="text-left p-2">E-mail</th>
                <th className="text-left p-2">Perfil</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i, idx) => {
                const r = resultados.find((x) => x.email === i.email);
                return (
                  <tr key={idx} className="border-t border-[#E2E8F0]">
                    <td className="p-2">{i.nome || <span className="text-[#94A3B8]">—</span>}</td>
                    <td className="p-2">{i.email}</td>
                    <td className="p-2">{PERFIL_LABEL[i.perfil] ?? i.perfil}</td>
                    <td className="p-2">
                      {i.erro ? (
                        <span className="text-[#DC2626] text-xs">⚠ {i.erro}</span>
                      ) : r ? (
                        r.ok ? (
                          <span className="text-[#16A34A] text-xs flex items-center gap-1">
                            <Check className="h-3 w-3" /> Criado
                          </span>
                        ) : (
                          <span className="text-[#DC2626] text-xs">⚠ {r.motivo}</span>
                        )
                      ) : (
                        <span className="text-[#16A34A] text-xs">Pronto para criar</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {resultados.filter((r) => r.ok && r.action_link).length > 0 && (
        <Card className="p-4 bg-[#F0FDF4] border-[#BBF7D0]">
          <p className="text-sm text-[#166534] mb-2">
            Links de "definir senha" gerados (use caso o e-mail não chegue):
          </p>
          <ul className="space-y-1">
            {resultados.filter((r) => r.ok && r.action_link).map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="text-[#166534] flex-1 truncate">{r.email}</span>
                <CopyButton value={r.action_link!} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Card>
  );
}

function ResultadoCard({ resultado }: { resultado: Resultado }) {
  if (!resultado.ok) {
    return (
      <Alert className="bg-[#FEF2F2] border-[#FECACA]">
        <AlertCircle className="h-4 w-4 text-[#B91C1C]" />
        <AlertDescription className="text-[#B91C1C]">{resultado.motivo}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert className="bg-[#F0FDF4] border-[#BBF7D0]">
      <Check className="h-4 w-4 text-[#166534]" />
      <AlertTitle className="text-[#166534]">Conta criada</AlertTitle>
      <AlertDescription className="text-[#166534] space-y-2">
        <div>O usuário receberá um e-mail com link para definir a senha.</div>
        {resultado.action_link && (
          <div className="flex items-center gap-2">
            <Input value={resultado.action_link} readOnly className="text-xs font-mono" />
            <CopyButton value={resultado.action_link} />
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
    >
      {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}
