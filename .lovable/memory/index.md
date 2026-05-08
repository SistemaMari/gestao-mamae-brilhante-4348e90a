# Project Memory

## Core
MARI — sistema de apoio diagnóstico para DMG. Nome oficial é apenas "MARI" (sem "DMG Diagnóstica" ou "Dra. Mari").
Paleta: lilás #9b87f5, verde-água #99F6E4, roxo #7E69AB, fundo #F8FAFC. Nunca azul/coral/laranja de marca.
Fontes: Sora (títulos), Plus Jakarta Sans (corpo), DM Serif Display (destaques editoriais).
5 perfis: consultório, institucional, gestor, gestor geral, admin. Redirect por perfil.
Sem autocadastro. Contas criadas por admin/convite.
Tooltips ⓘ obrigatórios em formulários. Glicemias: 1-400, 0=vazio.
"Diabete" masculino singular. Tom afirmativo: "TEM"/"NÃO TEM" DMG.
Rosa é OPCIONAL e sutil. Branco domina a interface.

## Memories
- [Identity visual spec](mem://design/identity) — Full color codes, gradients, semantic colors, typography rules
- [Clinical scenarios](mem://features/scenarios) — 9 scenarios with module routing for Block 3
- [User profiles](mem://features/profiles) — 5 user profiles with routes and permissions
- [System architecture](mem://features/architecture) — 4 clinical forms (A/B/C/D), report blocks, rules
- [Profissionais institucionais](mem://features/profissionais-institucionais) — 3ª aba em /admin/institucionais, gate acesso_revogado em 8 tabelas RLS, perfil_clinico
- [Laudo Completo](mem://features/laudo-completo) — Design system do laudo (Prompt 15): wrapper LaudoCompleto, 8 elementos, contrato, estados IA, print
- [Contratante 28.3 progresso](mem://features/contratante-28-3-progresso) — Schema aplicado + edge function revertida pré-28.3 (default MARI Sandbox). Aguardando 28.3a/b/c.
