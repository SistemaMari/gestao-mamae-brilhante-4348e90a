// E-mail "acesso liberado": link para criar a senha + login (o próprio e-mail).
// Usado pelo webhook do Asaas (compra confirmada) e pelo admin (reenviar acesso).
//
// generateLink só GERA o link — não envia nada. Quem envia é o
// send-transactional-email (template acesso-liberado), pela fila de e-mails.

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

export interface DadosEmailAcesso {
  email: string;
  nome: string;
  nomePlano: string | null;
  validade: Date | null;
  /** Mesma chave = mesmo e-mail (não duplica em retentativas). */
  idempotencyKey: string;
}

/** Retorna null se enfileirou o e-mail; senão, a mensagem de erro. */
export async function enviarEmailAcesso(
  supabase: SupabaseAdmin,
  dados: DadosEmailAcesso,
): Promise<string | null> {
  const appUrl = Deno.env.get("APP_PUBLIC_URL") ?? "https://maridmg.com.br";

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: dados.email,
    options: { redirectTo: `${appUrl}/nova-senha` },
  });
  const linkCriarSenha: string | undefined = linkData?.properties?.action_link;
  if (linkErr || !linkCriarSenha) {
    return `Falha ao gerar o link de senha: ${linkErr?.message ?? "link vazio"}`;
  }

  const { data, error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "acesso-liberado",
      recipientEmail: dados.email,
      idempotencyKey: dados.idempotencyKey,
      templateData: {
        nomeProfissional: dados.nome,
        nomePlano: dados.nomePlano ?? "MARI",
        email: dados.email,
        validadeFormatada: dados.validade
          ? dados.validade.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
          : null,
        linkCriarSenha,
        linkLogin: `${appUrl}/login`,
      },
    },
  });
  if (error) return `Falha ao enviar o e-mail de acesso: ${error.message}`;
  if (data?.success === false) return `E-mail de acesso não enviado: ${data?.reason ?? "motivo desconhecido"}`;
  return null;
}
