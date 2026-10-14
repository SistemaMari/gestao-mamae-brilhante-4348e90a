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
import { enfileirarEmailTransacional } from "./emailTransacional.ts";

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

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

  const erro = await enfileirarEmailTransacional(supabase, {
    to: dados.email,
    subject: acessoLiberado.subject,
    html,
    text,
    templateName: "acesso-liberado",
    label: "acesso-liberado",
    idempotencyKey: dados.idempotencyKey,
  });
  return erro ? `Falha ao enfileirar o e-mail de acesso: ${erro}` : null;
}

