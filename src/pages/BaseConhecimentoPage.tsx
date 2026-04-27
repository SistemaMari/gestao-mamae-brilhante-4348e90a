import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { ShieldCheck, Upload, Trash2, FileText, File, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size: number; mimetype: string } | null;
}

// Arquivos esperados pelo System Prompt MARI v5.2 (mantido em sync com supabase/functions/gerar-laudo/prompt-v52.ts)
interface ExpectedFile {
  name: string;
  rotulo: string;
  obrigatorio: boolean;
  cenarios: string[]; // cenários que ficam indisponíveis sem este arquivo
  descricao: string;
}

const ARQUIVOS_ESPERADOS: ExpectedFile[] = [
  { name: 'PROTOCOLO_DMG_Brasil_2016.pdf', rotulo: 'Protocolo Brasileiro DMG 2016', obrigatorio: true, cenarios: ['1','2','3','4','5','6','6B','7','8'], descricao: 'Fonte exclusiva do Bloco 2 (Justificativa Científica). Sem ele NENHUM laudo é gerado.' },
  { name: 'M2.pdf',  rotulo: 'Módulo 2 — Magnitude e riscos',          obrigatorio: true, cenarios: ['1','5','6','6B','8'],      descricao: 'Epidemiologia, complicações imediatas, riscos a longo prazo.' },
  { name: 'M3.pdf',  rotulo: 'Módulo 3 — Fisiopatologia',              obrigatorio: true, cenarios: ['1','3','6','6B','8'],      descricao: 'Hiperinsulinismo fetal, cascata neonatal, perfis Lancet.' },
  { name: 'M4.pdf',  rotulo: 'Módulo 4 — Classificação',               obrigatorio: true, cenarios: ['1','6','6B','8'],          descricao: 'Critérios diagnósticos e classificação clínica.' },
  { name: 'M6.pdf',  rotulo: 'Módulo 6 — Tratamento (Aula 2)',         obrigatorio: true, cenarios: ['1','2','3','4','6','6B','8'], descricao: 'Aula 2: dieta detalhada, atividade física, perfil glicêmico. CRÍTICO para profundidade.' },
  { name: 'M7.pdf',  rotulo: 'Módulo 7 — Insulinoterapia',             obrigatorio: true, cenarios: ['3','4','7'],               descricao: 'Critérios de insulinização, NPH, metformina como exceção.' },
  { name: 'M9.pdf',  rotulo: 'Módulo 9 — Acompanhamento pré-natal',    obrigatorio: true, cenarios: ['1','2','3','4','6','6B','8'], descricao: 'Frequência de retornos, AAS+cálcio, apoio multiprofissional.' },
  { name: 'M10.pdf', rotulo: 'Módulo 10 — Vigilância fetal',           obrigatorio: true, cenarios: ['1','2','3','4','6','6B','8'], descricao: 'A1: ≥34 sem; A2: ≥32 sem; Overt: ≥28 sem.' },
  { name: 'M12.pdf', rotulo: 'Módulo 12 — Pós-parto',                  obrigatorio: true, cenarios: ['5'],                       descricao: 'Suspensão de insulina, TOTG 6-12 sem, aleitamento.' },
  { name: 'M13.pdf', rotulo: 'Módulo 13 — Follow-up de longo prazo',   obrigatorio: true, cenarios: ['1','2','3','4','5','6','6B','7','8'], descricao: 'Janela de oportunidade, rastreamento DM2, MANTRA FINAL.' },
];

const TODOS_CENARIOS = ['1','2','3','4','5','6','6B','7','8'];

export default function BaseConhecimentoPage() {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage
      .from('base-conhecimento')
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) {
      toast.error('Erro ao carregar arquivos');
      console.error(error);
    }
    setFiles((data as StorageFile[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, []);

  // Status do checklist
  const status = useMemo(() => {
    const presentes = new Set(files.map((f) => f.name));
    const items = ARQUIVOS_ESPERADOS.map((esp) => ({
      ...esp,
      presente: presentes.has(esp.name),
    }));
    const faltando = items.filter((i) => !i.presente);
    const cenariosBloqueados = new Set<string>();
    for (const item of faltando) {
      for (const c of item.cenarios) cenariosBloqueados.add(c);
    }
    const sistemaPronto = faltando.length === 0;
    const protocoloOk = presentes.has('PROTOCOLO_DMG_Brasil_2016.pdf');
    return { items, faltando, cenariosBloqueados, sistemaPronto, protocoloOk };
  }, [files]);

  const arquivosExtras = useMemo(() => {
    const esperados = new Set(ARQUIVOS_ESPERADOS.map((e) => e.name));
    return files.filter((f) => !esperados.has(f.name));
  }, [files]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(selected)) {
      const { error } = await supabase.storage
        .from('base-conhecimento')
        .upload(file.name, file, { upsert: true, contentType: file.type || 'application/pdf' });
      if (error) {
        toast.error(`Erro ao enviar ${file.name}: ${error.message}`);
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} arquivo(s) enviado(s) com sucesso`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    fetchFiles();
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Remover "${fileName}"?`)) return;
    const { error } = await supabase.storage
      .from('base-conhecimento')
      .remove([fileName]);
    if (error) {
      toast.error('Erro ao remover arquivo');
    } else {
      toast.success('Arquivo removido');
      fetchFiles();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = (name: string) => {
    if (name.endsWith('.pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (name.endsWith('.docx') || name.endsWith('.doc')) return <FileText className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const getFileMeta = (name: string) => files.find((f) => f.name === name);

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Base de Conhecimento</h1>
              <p className="text-sm text-muted-foreground">Módulos clínicos consultados pela Mari ao gerar laudos</p>
            </div>
            <Badge className="ml-auto bg-primary/10 text-primary border-primary/20">Admin</Badge>
          </div>

          {/* Status Banner */}
          {loading ? null : status.sistemaPronto ? (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-900 text-sm">Sistema pronto para gerar laudos</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Todos os {ARQUIVOS_ESPERADOS.length} arquivos obrigatórios estão presentes. A Mari pode atender aos 9 cenários clínicos.
                </p>
              </div>
            </div>
          ) : !status.protocoloOk ? (
            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-destructive text-sm">Geração de laudos BLOQUEADA</p>
                <p className="text-xs text-destructive/80 mt-0.5">
                  O <strong>PROTOCOLO_DMG_Brasil_2016.pdf</strong> é obrigatório para QUALQUER laudo. Faça o upload antes de prosseguir.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">
                  {status.faltando.length} arquivo(s) faltando — {status.cenariosBloqueados.size} cenário(s) com qualidade reduzida
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  A Mari ainda gera laudos com os arquivos disponíveis, mas pula trechos que dependem de módulos ausentes.
                  Cenários afetados: <strong>{Array.from(status.cenariosBloqueados).sort().join(', ')}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Upload area */}
          <div className="mb-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-primary/50" />
            <p className="mb-1 text-sm text-foreground font-medium">
              Envie os PDFs com os nomes EXATOS abaixo
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Você pode selecionar vários arquivos de uma vez. Reenvio sobrescreve a versão anterior.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Enviando...' : 'Selecionar arquivos'}
            </Button>
          </div>

          {/* Checklist de arquivos esperados */}
          <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-5 py-3 flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-foreground">
                Checklist v5.2 — Arquivos esperados
              </h2>
              <span className="text-xs text-muted-foreground">
                {status.items.filter((i) => i.presente).length} / {ARQUIVOS_ESPERADOS.length}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {status.items.map((item) => {
                  const meta = getFileMeta(item.name);
                  return (
                    <li key={item.name} className={`px-5 py-3 transition-colors ${item.presente ? 'hover:bg-muted/30' : 'bg-amber-50/30'}`}>
                      <div className="flex items-start gap-3">
                        {item.presente ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{item.rotulo}</p>
                            <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.name}</code>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            {item.presente && meta?.metadata?.size ? (
                              <span className="text-xs text-emerald-700">
                                {formatSize(meta.metadata.size)} · enviado em {new Date(meta.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-700 font-medium">
                                Cenários afetados: {item.cenarios.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        {item.presente && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 flex-shrink-0"
                            onClick={() => handleDelete(item.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Arquivos extras (não esperados) */}
          {arquivosExtras.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-heading text-sm font-semibold text-foreground">
                  Outros arquivos no bucket ({arquivosExtras.length})
                </h2>
                <span className="text-xs text-muted-foreground ml-auto">
                  Não consultados pela Mari (nome fora do checklist v5.2)
                </span>
              </div>
              <ul className="divide-y divide-border">
                {arquivosExtras.map((f) => (
                  <li key={f.id || f.name} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {getIcon(f.name)}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.metadata?.size ? formatSize(f.metadata.size) : '—'} · {new Date(f.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(f.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
