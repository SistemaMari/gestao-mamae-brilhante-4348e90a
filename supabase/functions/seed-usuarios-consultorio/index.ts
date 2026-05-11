// Edge function admin-only, one-off: cria contas de usuário com perfil
// "consultorio" definindo uma SENHA TEMPORÁRIA forte gerada automaticamente.
// E-mails ficam email_confirm=true (sem verificação). Retorna a lista de
// credenciais para o admin repassar aos usuários.
//
// IMPORTANTE: este endpoint deve ser removido após o uso.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ItemEntrada {
  nome: string;
  email: string;
}

interface Resultado {
  email: string;
  ok: boolean;
  motivo?: string;
  user_id?: string;
  senha_temporaria?: string;
}

function gerarSenhaForte(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const buf = new Uint32Array(16);
  crypto.getRandomValues(buf);
  const pick = (alfa: string, idx: number) => alfa[buf[idx] % alfa.length];
  // garante 1 de cada classe nas 4 primeiras posições, completa o resto
  const chars: string[] = [
    pick(upper, 0),
    pick(lower, 1),
    pick(digits, 2),
    pick(symbols, 3),
  ];
  for (let i = 4; i < 16; i++) chars.push(pick(all, i));
  // shuffle Fisher-Yates com getRandomValues
  const shuf = new Uint32Array(16);
  crypto.getRandomValues(shuf);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuf[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) auth: precisa ser admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ status: "erro", mensagem: "Não autenticado." }, 401);
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const tokenJWT = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await supabaseUser.auth.getClaims(tokenJWT);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ status: "erro", mensagem: "Não autenticado." }, 401);
    }
    const callerUserId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: adminRow } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (!adminRow) {
      return json({ status: "erro", mensagem: "Apenas admins podem executar." }, 403);
    }

    // 2) parse body
    const body = await req.json().catch(() => ({}));
    const itens: ItemEntrada[] = Array.isArray(body?.itens) ? body.itens : [];
    if (itens.length === 0) {
      return json({ status: "erro", mensagem: "Nenhum item." }, 400);
    }
    if (itens.length > 50) {
      return json({ status: "erro", mensagem: "Máximo 50 por lote." }, 400);
    }

    // 3) carrega usuários existentes
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailToUserId = new Map<string, string>();
    for (const u of authList?.users ?? []) {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
    }

    // 4) plano "inicial"
    const { data: planos } = await supabaseAdmin
      .from("planos")
      .select("id, slug")
      .eq("slug", "inicial")
      .maybeSingle();
    const planoInicialId = planos?.id ?? null;

    const resultados: Resultado[] = [];

    for (const itemRaw of itens) {
      const nome = (itemRaw.nome ?? "").trim();
      const email = (itemRaw.email ?? "").trim().toLowerCase();
      if (!nome || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        resultados.push({ email, ok: false, motivo: "nome ou e-mail inválido" });
        continue;
      }

      try {
        if (emailToUserId.has(email)) {
          resultados.push({ email, ok: false, motivo: "já existe" });
          continue;
        }

        const senha = gerarSenhaForte();

        const { data: created, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
            user_metadata: { nome },
          });
        if (createErr || !created?.user) {
          resultados.push({
            email,
            ok: false,
            motivo: createErr?.message ?? "falha ao criar usuário",
          });
          continue;
        }
        const userId = created.user.id;

        // cria profissional consultório (perfil_institucional = null)
        const { error: profErr } = await supabaseAdmin.from("profissionais").insert({
          user_id: userId,
          nome,
          perfil_institucional: null,
          unidade_id: null,
          plano: "inicial",
          plano_id: planoInicialId,
        });
        if (profErr) {
          resultados.push({
            email,
            ok: false,
            user_id: userId,
            motivo: `conta criada, mas falha ao criar profissional: ${profErr.message}`,
            senha_temporaria: senha,
          });
          continue;
        }

        resultados.push({
          email,
          ok: true,
          user_id: userId,
          senha_temporaria: senha,
        });
      } catch (err) {
        resultados.push({
          email,
          ok: false,
          motivo: err instanceof Error ? err.message : "erro desconhecido",
        });
      }
    }

    return json({ status: "ok", resultados });
  } catch (err) {
    console.error("[seed-usuarios-consultorio] erro:", err);
    return json({ status: "erro", mensagem: "Erro interno." }, 500);
  }
});
