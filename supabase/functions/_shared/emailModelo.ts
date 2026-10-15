// Monta um modelo de e-mail do app (transactional-email-templates) e põe na
// fila. Mesmo caminho do e-mail de acesso (ver emailAcesso.ts): não depende do
// send-transactional-email estar publicado.

import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import type { TemplateEntry } from "./transactional-email-templates/registry.ts";
import { enfileirarEmailTransacional } from "./emailTransacional.ts";

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

/** Retorna null se enfileirou; senão, a mensagem de erro. */
export async function enviarEmailDeModelo(
  supabase: SupabaseAdmin,
  dados: {
    modelo: TemplateEntry;
    nomeModelo: string;
    para: string;
    // deno-lint-ignore no-explicit-any
    props: Record<string, any>;
    idempotencyKey: string;
  },
): Promise<string | null> {
  let html: string;
  let text: string;
  try {
    const el = React.createElement(dados.modelo.component, dados.props);
    html = await renderAsync(el);
    text = await renderAsync(el, { plainText: true });
  } catch (e) {
    return `Falha ao montar o e-mail ${dados.nomeModelo}: ${(e as Error).message}`;
  }
  const subject = typeof dados.modelo.subject === "function"
    ? dados.modelo.subject(dados.props)
    : dados.modelo.subject;
  return await enfileirarEmailTransacional(supabase, {
    to: dados.para,
    subject,
    html,
    text,
    templateName: dados.nomeModelo,
    label: dados.nomeModelo,
    idempotencyKey: dados.idempotencyKey,
  });
}
