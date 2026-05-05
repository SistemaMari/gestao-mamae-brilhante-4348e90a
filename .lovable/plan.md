
# Prompt 27.1 — Carimbo do Profissional Atendente (CFM)

Adicionar carimbo imutável de autoria em cada operação clínica feita por profissional institucional. Profissional consultório (`unidade_id IS NULL`) não é afetado.

## 1. Migration de banco

Criar uma migration única com:

**1.1 Tabela `registros_atendimento`** — exatamente como na Seção 1.1 do prompt:
- `id`, `paciente_id` (FK pacientes ON DELETE CASCADE), `profissional_id` (FK profissionais), `unidade_id` (FK unidades, nullable)
- `tipo_operacao` TEXT NOT NULL com CHECK nos 11 valores listados
- `recurso_id` UUID, `recurso_tipo` TEXT (opcionais)
- Snapshots denormalizados: `profissional_nome` NOT NULL, `profissional_crm`, `profissional_especialidade`
- `created_at` TIMESTAMPTZ DEFAULT NOW()

**Observação de schema**: a coluna na tabela `profissionais` chama-se `crm` (não `crm_coren`). A function helper usará `crm`.

**1.2 Índices** — 4 índices conforme Seção 1.2.

**1.3 RLS** — habilitar RLS e criar 5 policies:
- `prof_ve_seus_registros` — SELECT onde `profissional_id` corresponde ao profissional logado (via `id IN (SELECT id FROM profissionais WHERE user_id = auth.uid())`)
- `gestor_ve_registros_unidade` — SELECT pela unidade
- `gestor_geral_ve_registros` — SELECT via `gestores_gerais_unidades`
- `admin_ve_tudo_registros` — SELECT via tabela `admins`
- `profissional_pode_inserir` — INSERT com check de profissional_id pertencer ao usuário logado

Sem policies de UPDATE/DELETE → carimbo imutável.

**1.4 Function `carimbar_atendimento`** (SECURITY DEFINER, plpgsql):
- Lê do `profissionais` os dados do `auth.uid()`
- Se `unidade_id IS NULL` → `RETURN NULL` (consultório não carimba)
- Insere em `registros_atendimento` com snapshot e retorna o UUID

## 2. Integração no backend

Padrão: depois da operação principal ter sucesso, chamar `supabase.rpc('carimbar_atendimento', { ... })`. **Nunca bloquear** a operação principal — apenas `console.error` em caso de falha.

Pontos de integração nesta entrega:

| Arquivo | Operação | tipo_operacao | recurso_tipo |
|---|---|---|---|
| `supabase/functions/gerar-laudo/index.ts` (ou `salvar-relatorio`) | Após INSERT em `laudos` | `gerar_laudo` | `laudo` |
| `src/components/Consulta1Form.tsx` | Após INSERT em `consultas` | `consulta_inicial` | `consulta` |
| `src/components/Retorno1Form.tsx` | Após INSERT em `consultas` (retorno) | `retorno` | `retorno` |
| `src/components/FichaACForm.tsx` | Após UPDATE da ficha AC | `preencher_ficha_ac` | `ficha` |
| `src/components/FichaBDForm.tsx` | Após UPDATE da ficha BD | `preencher_ficha_bd` | `ficha` |
| `src/components/GttForm.tsx` | Após INSERT em `exames_glicemia` (GTT) | `preencher_gtt` | `gtt` |
| `src/components/RegistroPartoForm.tsx` | Após INSERT em `partos` | `registrar_parto` | `parto` |
| `src/pages/FichaPacientePage.tsx` | Cadastro novo / edição de paciente | `abrir_ficha` / `editar_dados_paciente` | `paciente` |
| Encerramento (em `FichaPacientePage` ou `EncerramentoPartoCard`) | Após UPDATE para encerrado | `encerramento` | `paciente` |
| Perfil glicêmico (registro de glicemia) | Após INSERT | `perfil_glicemico` | `glicemia` |

Helper compartilhado em `src/lib/carimbar.ts`:
```ts
export async function carimbar(args: { pacienteId: string; tipoOperacao: TipoOperacao; recursoId?: string; recursoTipo?: string }) {
  const { error } = await supabase.rpc('carimbar_atendimento', { ... });
  if (error) console.error('Falha ao carimbar:', error);
}
```

## 3. Frontend (UI)

**3.1 Componente** `src/components/clinico/CarimboAtendimento.tsx` com 3 variantes (`inline`, `banner`, `lista`) — só renderiza se o usuário logado for institucional (verificar `profissional.unidade_id`).

**3.2 Mapa de tradução** `src/lib/tiposOperacao.ts` com `TIPOS_OPERACAO_LABELS`.

**3.3 Banner "Atendendo como"** no topo das ações clínicas (formulários de consulta/ficha/laudo) — usa `variant="banner"`.

**3.4 Histórico de atendimentos** na `FichaPacientePage` — nova seção que lista `registros_atendimento` da paciente em ordem cronológica DESC, usando `variant="lista"`. Apenas visível para usuários institucionais (gestor/profissional institucional/admin).

## 4. Testes manuais (Seção 4 do prompt)

Após implantação, validar manualmente:
1. Profissional consultório → tabela permanece vazia para sua paciente.
2. Profissional institucional → carimbo aparece para cada operação.
3. Snapshot preservado mesmo ao editar nome/CRM do profissional depois.
4. RLS por perfil (profissional, gestor unidade, gestor geral, admin).
5. Falha no carimbo não bloqueia operação clínica.
6. Linha do tempo na ficha lista todos os atendimentos.

## Fora de escopo (Seção 5)

Relatórios de produtividade, filtros, exportação CSV, backfill retroativo, notificações, mudanças no fluxo do consultório.

## Detalhes técnicos

- A migration será aplicada via tool de migração do Lovable Cloud (requer aprovação do usuário antes da execução).
- A function `carimbar_atendimento` usa `SECURITY DEFINER` com `SET search_path = public`.
- Não modificar `src/integrations/supabase/types.ts` — será regenerada automaticamente após a migration.
- O componente CarimboAtendimento usa cores da identidade (verde-água `#99F6E4` para banner, lilás `#9b87f5` para destaque) e tipografia Sora/Plus Jakarta.
