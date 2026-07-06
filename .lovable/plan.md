## Diagnóstico

**1) Badges "Dano" e "MENSAGEM DIRETA ABERTA"** — não é bug nosso. Nenhuma dessas strings existe em `src/`, `supabase/` ou nos JSONs de i18n. O Chrome está traduzindo automaticamente a página (você mesma confirmou: sumiu na versão inglês). O tradutor reescreve rótulos curtos ("DMG afastado" → "Dano") e chuta frases inteiras para siglas que não conhece ("OVERT DM" → "MENSAGEM DIRETA ABERTA"). Tooltip vem certo porque o tradutor às vezes pula tooltips.

**2) Tela branca ao clicar qualquer UF** — não consegui reproduzir (rota exige login e não tenho sessão no sandbox). Sem stack trace ou log do erro real, qualquer palpite de causa é chute. O caminho responsável seguro é instrumentar o bloco de Localização pra o próximo clique da usuária cuspir o erro pra mim automaticamente (via console) no turno seguinte.

## O que vou fazer

### Fix 1 — Bloquear Google Translate na app inteira
Em `index.html`:
- Trocar `<html lang="en">` (ou o que estiver hoje) por `<html lang="pt-BR" translate="no">`.
- Adicionar `<meta name="google" content="notranslate">` no `<head>`.

Efeito: Chrome para de oferecer tradução e para de reescrever rótulos. Zero mudança visual para quem já usa em PT. Se um dia quisermos i18n de verdade, é o `LanguageSwitcher` que assume — não o tradutor do navegador.

### Fix 2 — Instrumentar Consulta1Form pra capturar o erro do Estado
Em `src/components/Consulta1Form.tsx`, sem mudar comportamento:
- Envelopar o bloco Localização (país/estado/cidade) num `ErrorBoundary` local que, se cair, renderiza uma caixinha vermelha "Localização caiu — erro: …" **em vez de** deixar a página inteira branca. Já assim você consegue seguir preenchendo o resto da ficha.
- Logar no `console.error` o objeto de erro completo (mensagem + stack) quando o boundary disparar. No próximo turno, o console log entra automaticamente no meu contexto e eu vejo o erro real.
- Logar `console.debug` no `onValueChange` do Estado com `{ pais, uf, cityListLen }` pra confirmar em qual ponto da cadeia (setar estado, regenerar cityList, re-renderizar Combobox) a coisa quebra.

### Fluxo pra você
1. Eu aplico as duas mudanças.
2. Você abre `/paciente/nova`, seleciona um estado (qualquer um), vê a caixinha vermelha aparecer no lugar do bloco Localização.
3. Manda "deu ruim de novo" no chat — o console log já vem pra mim.
4. Eu leio o erro real, faço o fix definitivo (provavelmente uma linha) e removo a instrumentação.

## Fora do escopo agora
- Não vou tentar "adivinhar" o fix da tela branca antes de ver o erro. Já tentei ler o código (`Consulta1Form.tsx`, `CidadeCombobox.tsx`, `useCidadesIBGE.ts`, `locationData.ts`, `cidadesIBGE.ts`) e não achei nada obviamente quebrado — sem o stack real, mexer às cegas piora.
- Não vou mexer em `STATUS_CONFIG` nem nos badges: o texto no código está correto; o problema é externo (tradutor).

## Arquivos tocados
- `index.html` — lang + meta notranslate
- `src/components/Consulta1Form.tsx` — ErrorBoundary local + logs no bloco Localização (reversível em 1 commit)
