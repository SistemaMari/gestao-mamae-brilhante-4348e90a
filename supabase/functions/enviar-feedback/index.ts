import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Recebe { tipo, mensagem, anexo_url? } do frontend autenticado.
// 1) grava em feedbacks_usuario com o user_id do JWT
// 2) dispara e-mail para EMAIL_SUPORTE via send-transactional-email

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const EMAIL_SUPORTE = Deno.env.get('EMAIL_SUPORTE') || 'suporte@maridmg.com.br'

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Cliente autenticado (para validar o user)
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userErr } = await authClient.auth.getUser()
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const userId = userData.user.id
  const userEmail = userData.user.email

  let body: { tipo?: string; mensagem?: string; anexo_url?: string | null } = {}
  try { body = await req.json() } catch { /* noop */ }

  const tipo = (body.tipo || '').trim()
  const mensagem = (body.mensagem || '').trim()
  const anexo_url = body.anexo_url || null

  const TIPOS = ['sugestao', 'elogio', 'erro', 'duvida']
  if (!TIPOS.includes(tipo)) {
    return new Response(JSON.stringify({ error: 'Tipo inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!mensagem || mensagem.length > 1000) {
    return new Response(JSON.stringify({ error: 'Mensagem obrigatória (até 1000 caracteres)' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // Insere feedback
  const { data: inserted, error: insErr } = await admin
    .from('feedbacks_usuario')
    .insert({ user_id: userId, tipo, mensagem, anexo_url })
    .select('id')
    .single()
  if (insErr || !inserted) {
    return new Response(JSON.stringify({ error: 'Falha ao registrar feedback' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Nome do autor
  let autorNome = 'Usuário'
  const { data: prof } = await admin
    .from('profissionais')
    .select('nome')
    .eq('user_id', userId)
    .maybeSingle()
  if (prof?.nome) autorNome = prof.nome as string

  // Dispara e-mail (best-effort; não falha o insert se der erro)
  try {
    await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'feedback-recebido',
        recipientEmail: EMAIL_SUPORTE,
        idempotencyKey: `feedback-${inserted.id}`,
        templateData: {
          tipo, autorNome, autorEmail: userEmail, mensagem, anexoUrl: anexo_url,
        },
      },
    })
  } catch (e) {
    console.error('Falha ao enviar e-mail de feedback:', e)
  }

  return new Response(JSON.stringify({ ok: true, id: inserted.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
