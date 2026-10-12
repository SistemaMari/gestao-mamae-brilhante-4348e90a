// E-mail "acesso liberado": link para criar a senha + login (o próprio e-mail).
// Usado pelo webhook do Asaas (compra confirmada) e pelo admin (reenviar acesso).
//
// generateLink só GERA o link — não envia nada. O envio segue o mesmo caminho do
// send-transactional-email (lista de bloqueio, token de descadastro, fila
// transactional_emails), mas montado aqui: não depende de outra edge function
// estar publicada. O process-email-queue entrega.

import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { template as acessoLiberado } from "./transactional-email-templates/acesso-liberado.tsx";

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

const SITE_NAME = "Mari's Health Companion";
// Precisa ser o subdomínio verificado no Lovable (igual ao send-transactional-email).
const SENDER_DOMAIN = "notify.maridmg.com.br";

function gerarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Token de descadastro do e-mail (exigido na fila transacional). null = bloqueado. */
async function tokenDescadastro(
  supabase: SupabaseAdmin,
  email: string,
): Promise<{ token: string | null; erro: string | null }> {
  const { data: bloqueado, error: blqErr } = await supabase
    .from("suppressed_emails").select("id").eq("email", email).maybeSingle();
  if (blqErr) return { token: null, erro: `Falha ao checar bloqueio: ${blqErr.message}` };
  if (bloqueado) return { token: null, erro: "E-mail na lista de bloqueio (descadastrado ou devolvido)" };

  const { data: existente, error: lerErr } = await supabase
    .from("email_unsubscribe_tokens").select("token, used_at").eq("email", email).maybeSingle();
  if (lerErr) return { token: null, erro: `Falha ao ler token: ${lerErr.message}` };
  if (existente?.used_at) return { token: null, erro: "E-mail descadastrado" };
  if (existente?.token) return { token: existente.token, erro: null };

  await supabase
    .from("email_unsubscribe_tokens")
    .upsert({ token: gerarToken(), email }, { onConflict: "email", ignoreDuplicates: true });
  const { data: salvo } = await supabase
    .from("email_unsubscribe_tokens").select("token").eq("email", email).maybeSingle();
  return salvo?.token
    ? { token: salvo.token, erro: null }
    : { token: null, erro: "Falha ao criar token de descadastro" };
}

export interface DadosEmailAcesso {
  email: string;
  nome: string;
  nomePlano: string | null;
  validade: Date | null;
  /** Identifica o envio no log (email_send_log). */
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

  const props = {
    nomeProfissional: dados.nome,
    nomePlano: dados.nomePlano ?? "MARI",
    email: dados.email,
    validadeFormatada: dados.validade
      ? dados.validade.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : undefined,
    linkCriarSenha,
    linkLogin: `${appUrl}/login`,
  };

  let html: string;
  let text: string;
  try {
    html = await renderAsync(React.createElement(acessoLiberado.component, props));
    text = await renderAsync(React.createElement(acessoLiberado.component, props), { plainText: true });
  } catch (e) {
    return `Falha ao montar o e-mail de acesso: ${(e as Error).message}`;
  }

  const emailNormalizado = dados.email.toLowerCase();
  const { token: unsubscribeToken, erro: erroToken } = await tokenDescadastro(supabase, emailNormalizado);
  if (!unsubscribeToken) return erroToken ?? "Falha ao preparar o e-mail";

  const messageId = crypto.randomUUID();
  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: "acesso-liberado",
    recipient_email: dados.email,
    status: "pending",
  });

  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: dados.email,
      from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: acessoLiberado.subject,
      html,
      text,
      purpose: "transactional",
      label: "acesso-liberado",
      idempotency_key: dados.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
  if (error) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "acesso-liberado",
      recipient_email: dados.email,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    return `Falha ao enfileirar o e-mail de acesso: ${error.message}`;
  }
  return null;
}
