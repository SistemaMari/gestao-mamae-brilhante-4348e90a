import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { ShieldCheck, Upload, Trash2, FileText, File, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size: number; mimetype: string } | null;
}

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(selected)) {
      const { error } = await supabase.storage
        .from('base-conhecimento')
        .upload(file.name, file, { upsert: true });
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
              <p className="text-sm text-muted-foreground">Módulos clínicos e protocolos de referência</p>
            </div>
            <Badge className="ml-auto bg-primary/10 text-primary border-primary/20">Admin</Badge>
          </div>

          {/* Upload area */}
          <div className="mb-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-primary/50" />
            <p className="mb-3 text-sm text-muted-foreground">
              Arraste arquivos .pdf ou .docx ou clique para selecionar
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

          {/* File list */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h2 className="font-heading text-sm font-semibold text-foreground">
                Arquivos ({files.length})
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : files.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum arquivo enviado ainda
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {files.map((f) => (
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
