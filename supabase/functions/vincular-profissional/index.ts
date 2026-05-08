// FLUXO DESCONTINUADO.
//
// A vinculação consultório → institucional foi removida do produto.
// Regra atual: cada e-mail pertence a um único modelo no MARI
// (consultório com assinatura individual OU profissional institucional
// vinculado a uma unidade), nunca aos dois.
//
// Esta função é mantida apenas para responder com 410 Gone e mensagem
// clara a qualquer cliente legado que ainda a invoque.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  return new Response(
    JSON.stringify({
      status: "fluxo_descontinuado",
      mensagem:
        "A vinculação consultório → institucional foi desativada. Cada e-mail só pode pertencer a um modelo no MARI (consultório OU institucional). Use um e-mail diferente para acessar a unidade.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
