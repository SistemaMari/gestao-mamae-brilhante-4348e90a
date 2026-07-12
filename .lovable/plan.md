## Objetivo
Trazer a mesma saudação usada no painel Admin ("Olá, {nome} ✨") para a tela principal do usuário institucional (lista de pacientes em `src/pages/DashboardPage.tsx`) e enriquecer o topo da página com blocos leves e amigáveis — sem dashboards, sem gráficos, sem métricas clínicas duras.

## Escopo
Somente `src/pages/DashboardPage.tsx` (frontend). Nenhuma mudança de dados, RLS, edge function ou lógica de negócio.

## O que entra

### 1. Cabeçalho de saudação (idêntico ao Admin)
Bloco novo, no topo da página, acima da barra de busca:

- `H1`: `Olá, {primeiroNome} ✨` — Sora, `text-4xl md:text-5xl`, `#1E293B`.
- Subtítulo dinâmico por horário: "Bom dia" / "Boa tarde" / "Boa noite, tenha um atendimento tranquilo." (curto, acolhedor).
- Linha divisória `border-b #E2E8F0`, `pb-6`, igual ao Admin.
- Nome vindo de `profissionalData.nome` (fallback: `profile?.email`).

### 2. Faixa de "boas-vindas" com 3 cartões leves (sem números clínicos)
Grid `md:grid-cols-3 gap-4`, cartões brancos, borda `#E2E8F0`, cantos `rounded-2xl`, ícone lilás `#9b87f5`. Conteúdo estático/institucional — nada de KPI:

1. **Sua unidade** — mostra `profissionalData.unidade?.nome` + cidade/UF (dados que já vêm do hook). Ícone `Building2`. Se for consultório, mostra "Consultório particular".
2. **Data de hoje** — data por extenso em pt-BR + IG-friendly frase curta ("Ótimo dia para cuidar das suas gestantes."). Ícone `CalendarDays`.
3. **Atalho — Nova paciente** — cartão clicável que chama a mesma ação do botão `+ Nova Paciente` já existente. Ícone `UserPlus`. Serve como CTA visual sem duplicar lógica.

### 3. Bloco "Dica do dia" (rotativo, client-side)
Card único, largura total, fundo lilás bem suave (`#F5F0FF`), borda `#E9E3FA`, ícone `Sparkles`. Texto curto rotativo por dia da semana (array fixo de 7 dicas clínicas/UX — ex.: "Lembre-se de registrar a IG correta antes de gerar o laudo."). Zero requisição, zero estado persistido.

### 4. Rodapé da saudação
Pequena linha de texto `#64748B` com link/atalho para "Ver tutoriais" (rota já existente `/tutoriais` se disponível — se não existir para institucional, remover o link e deixar só a frase).

## O que NÃO entra
- Nenhum gráfico, contador de pacientes, alerta clínico, agenda ou "próximos retornos" — o usuário pediu explicitamente "sem dashboards".
- Nenhuma mudança na tabela de pacientes abaixo (busca, toggle "Mostrar fichas encerradas", listagem seguem intactos).
- Sem novo endpoint, sem novo hook, sem migration.

## Detalhes técnicos
- Reaproveitar `useProfissionalData()` já importado.
- Saudação por horário: `new Date().getHours()` → `bomDia|boaTarde|boaNoite`.
- Data por extenso: `format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })` (ambos já usados em outros pontos do projeto).
- Dica do dia: `const dicas = [...]; dicas[new Date().getDay()]`.
- Tudo dentro de um novo bloco `<section>` renderizado antes do `UsageWarningBanner` / barra de busca atual.
- Design tokens: manter paleta lilás/verde-água já definida; nada de cores hardcoded fora do padrão do projeto (lilás `#9b87f5`, fundo `#F5F0FF`, texto `#1E293B` / `#64748B`, borda `#E2E8F0`).

## Critérios de aceite
- Ao entrar como institucional em `/dashboard`, aparece "Olá, {Nome} ✨" no topo, com a mesma tipografia/hierarquia do Admin.
- Abaixo da saudação: 3 cartões (Unidade, Data de hoje, Atalho Nova paciente) + faixa "Dica do dia".
- Tabela de pacientes continua funcionando exatamente como antes.
- Nenhum número/KPI clínico exposto no topo.
