// E-mail "acesso liberado": link para criar a senha + login (o próprio e-mail).
// Usado pelo webhook do Asaas (compra confirmada) e pelo admin (reenviar acesso).
//
// generateLink só GERA o link — não envia nada. O envio entra direto na fila
// de e-mails (enqueue_email, fila auth_emails), o mesmo caminho do auth-email-hook
// e do enviar-convite: não depende de outra edge function estar publicada.

import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { template as acessoLiberado } from "./transactional-email-templates/acesso-liberado.tsx";

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

const SITE_NAME = "Mari's Health Companion";
const SENDER_DOMAIN = "notify.maridmg.com.br";

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

  const messageId = crypto.randomUUID();
  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: "acesso-liberado",
    recipient_email: dados.email,
    status: "pending",
  });

  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "auth_emails",
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
