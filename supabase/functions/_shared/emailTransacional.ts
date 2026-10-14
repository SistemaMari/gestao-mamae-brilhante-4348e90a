// Envio de e-mail do APP (não do login): mesmo caminho do send-transactional-email
// — lista de bloqueio, token de descadastro e fila `transactional_emails` — sem
// depender de outra edge function publicada. O process-email-queue entrega.
//
// ⚠️ A fila `auth_emails` é só das mensagens do próprio login (vêm com run_id do
// gancho de auth); e-mail do app colocado lá nunca é entregue (bug do e-mail de
// acesso, #151, e do convite de unidade).

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

export const SITE_NAME = "Mari's Health Companion";
// Precisa ser o subdomínio verificado no Lovable (igual ao send-transactional-email).
export const SENDER_DOMAIN = "notify.maridmg.com.br";

function gerarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Token de descadastro do e-mail (exigido na fila transacional). null = bloqueado. */
export async function tokenDescadastro(
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

export interface EmailTransacional {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Nome do modelo no email_send_log (ex.: 'convite_unidade'). */
  templateName: string;
  /** Rótulo na fila (ex.: 'convite_unidade'). */
  label: string;
  /** Evita envio duplicado do mesmo e-mail. */
  idempotencyKey: string;
}

/** Enfileira o e-mail. Retorna null se deu certo; senão, a mensagem de erro. */
export async function enfileirarEmailTransacional(
  supabase: SupabaseAdmin,
  email: EmailTransacional,
): Promise<string | null> {
  const destino = email.to.toLowerCase();
  const { token: unsubscribeToken, erro: erroToken } = await tokenDescadastro(supabase, destino);
  if (!unsubscribeToken) return erroToken ?? "Falha ao preparar o e-mail";

  const messageId = crypto.randomUUID();
  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: email.templateName,
    recipient_email: email.to,
    status: "pending",
  });

  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: email.to,
      from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: email.subject,
      html: email.html,
      text: email.text,
      purpose: "transactional",
      label: email.label,
      idempotency_key: email.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
  if (error) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: email.templateName,
      recipient_email: email.to,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    return `Falha ao enfileirar o e-mail: ${error.message}`;
  }
  return null;
}
