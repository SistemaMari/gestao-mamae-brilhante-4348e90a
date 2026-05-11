
# Redesign da página de login `/login`

Objetivo: transformar a tela atual (cinza, genérica, com placeholder "DM") numa porta de entrada à altura do produto — usando a logo MARI, o degradê roxo→verde-água e a paleta dual aprovada.

## 1. Ativos

- Copiar `user-uploads://MARI_DMG_3.png` → `src/assets/mari-logo.png` e importar como módulo ES6.
- Manter Sora (títulos) + Plus Jakarta Sans (corpo). Sem novas fontes.

## 2. Layout — split screen em desktop, empilhado em mobile

```text
Desktop (≥ md)                          Mobile (< md)
┌──────────────┬──────────────┐         ┌──────────────┐
│              │              │         │   gradiente   │ ← faixa superior
│  GRADIENTE   │   formulário │         │  + logo MARI  │   (h ~ 200px)
│  + logo MARI │   (card      │         ├──────────────┤
│  + tagline   │    branco)   │         │              │
│              │              │         │  formulário   │
└──────────────┴──────────────┘         └──────────────┘
```

- Coluna esquerda (50%): `background: linear-gradient(135deg, #7C4DBA 0%, #0D9488 100%)` (degradê marketing principal — bate com a imagem 2 e com a logo enviada).
  - Logo MARI centralizada (max-width ~ 320px).
  - Abaixo, em branco/Sora: tagline curta — sugestão **"Inteligência clínica para o manejo do Diabete Mellitus Gestacional."** (mantém terminologia oficial — "Diabete" masculino singular).
  - Footer discreto da coluna: "© 2026 MARI · Maternal ARtificial Intelligence".
- Coluna direita: fundo branco, card de login centralizado, max-width 400px.

## 3. Card de formulário

- Título `Entrar` em Sora 600, foreground.
- Campos `E-mail` e `Senha` mantidos (mesmos componentes shadcn `Input`/`Label`), com focus ring em `--primary` (lilás #9b87f5).
- Botão "Entrar":
  - Estado normal: `bg-primary` (lilás #9b87f5), texto branco.
  - Hover: degradê app `linear-gradient(135deg,#9b87f5,#7E69AB)`.
  - Disabled: mantém opacity atual.
- Link "Esqueci minha senha" em `text-primary`, alinhado ao centro.
- **Remover** o bloco final "Quer só visualizar o que já foi criado? Abrir vitrine sem login" (`auth.previewCta` + `auth.previewLink`).
- `LanguageSwitcher` permanece no canto superior direito, mas com estilo neutro sobre o fundo branco da coluna direita (em mobile, vai sobre a faixa do degradê — usar variante com fundo translúcido).

## 4. Tokens & CSS

- Sem mexer em `tailwind.config.ts`. As cores marketing (#7C4DBA, #0D9488) entram **apenas via classes utilitárias inline `bg-[linear-gradient(...)]`** restritas à tela de login — não viram tokens globais, para não contaminar o app clínico (que segue branco-dominante).
- Para o gradiente, criar uma classe local em `LoginPage` usando `style={{ background: 'linear-gradient(135deg, #7C4DBA 0%, #0D9488 100%)' }}` (a paleta marketing é exceção pontual; o resto do app continua usando os semantic tokens).

## 5. i18n

- Remover chaves não utilizadas (`auth.previewCta`, `auth.previewLink`) dos 3 arquivos `pt-BR.json`, `en-US.json`, `es.json` — ou apenas deixar de referenciá-las (mais seguro: deixar as chaves, remover só do JSX, para não quebrar outras telas que eventualmente reusem). **Decisão:** manter as chaves no JSON, remover só o uso em `LoginPage.tsx`.
- Trocar `auth.appName` para exibir somente "MARI" (já está nesse formato segundo memória).
- Atualizar `auth.appTagline` em pt-BR para "Inteligência clínica para o manejo do Diabete Mellitus Gestacional." (e equivalentes em EN/ES). A tagline aparece **na coluna do degradê em desktop** e logo abaixo da logo em mobile — o card de login NÃO repete a tagline.

## 6. Acessibilidade

- Contraste do texto branco sobre o degradê: garantido (lilás médio + verde-água escuro).
- `alt="MARI — Maternal ARtificial Intelligence"` na logo.
- Coluna do degradê é decorativa em mobile (acima do form), mas o `<h1>` semântico fica no card de login para SEO/screen readers.

## 7. Arquivos tocados

1. `src/assets/mari-logo.png` (novo, via copy).
2. `src/pages/LoginPage.tsx` (reescrito — split layout, remoção do bloco vitrine, nova logo).
3. `src/i18n/locales/pt-BR.json`, `en-US.json`, `es.json` — atualizar `auth.appTagline`.
4. (Opcional) `index.html` — atualizar `<title>` e `og:title` para "MARI — Apoio à decisão clínica em DMG".

## 8. Fora de escopo

- Páginas `/recuperar-senha`, `/nova-senha`, `/cadastro-convite`: não tocadas nesta rodada (podem receber o mesmo layout num follow-up se você gostar do resultado).
- Vitrine pública (`/vitrine`): continua existindo, só perde o atalho a partir do login.

Aprova que eu já implemento?
