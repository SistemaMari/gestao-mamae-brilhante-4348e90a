---
name: Planos e bloqueio de uso
description: 3 planos pagos (Inicial/Intermediária/Profissional) com cursos Eduzz como bônus, dashboard analítico exclusivo do Profissional, reset de laudos por aniversário da assinatura
type: feature
---
## Planos (3 planos pagos — sem Free, sem Teste)
- Inicial: R$79/mês, 10 laudos/mês, pacientes ilimitados, suporte e-mail, curso bônus: hiperglicemia
- Intermediária: R$139/mês, 35 laudos/mês, pacientes ilimitados, suporte e-mail, cursos: hiperglicemia + insulinoterapia
- Profissional: R$299/mês, 100 laudos/mês, pacientes ilimitados, suporte prioritário, cursos: hiperglicemia + insulinoterapia + novos-paradigmas-dmg + Dashboard analítico exclusivo

## Slugs no banco (planos.slug)
'inicial', 'intermediaria', 'profissional'

## Reset de laudos
Por aniversário da assinatura (data_inicio_assinatura), NÃO pelo mês civil.

## Colunas em profissionais
plano, plano_status, laudos_limite, laudos_usados, periodo_renovacao, stripe_customer_id, stripe_subscription_id

## DB Functions (RPC)
- pode_criar_ficha(uuid) → boolean (sem limite de pacientes nos planos atuais)
- pode_gerar_laudo(uuid) → jsonb {allowed, laudos_limite} (incremento atômico)

## Pagamento
Integração adiada (provável Asaas com PIX, cartão, boleto). Botões exibem toast informativo por enquanto.

## Dashboard analítico
Exclusivo do plano Profissional. PlanoGuard com planosPermitidos={['profissional']} em /dashboard/metricas. Demais planos veem cadeado no menu.

## Cursos Eduzz
Bônus de cada plano. Links Eduzz pendentes (provável segunda-feira).

## Perfil incompleto
Se crm ou especialidade NULL → redireciona para /completar-perfil (placeholder).
