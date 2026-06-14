Plano de diagnóstico, sem alterar banco:

1. Ajustar temporariamente o log em `CarimboAtendimento.tsx` para disparar mesmo quando a query do React Query estiver usando cache.
   - Incluir `user.id`, `profile`, `ehInstitucional`, `pacienteId` e o resultado real de `supabase.auth.getUser()`.
   - Manter a query e a renderização exatamente iguais.

2. Forçar o log a aparecer no caminho de renderização do `ListaHistorico`, além do `queryFn`, para confirmar se:
   - `ListaHistorico` está montando;
   - `enabled` está true ou false;
   - o histórico mostrado é dado em cache ou fetch novo.

3. Reabrir a tela com a Dra. Institucional Dois e ler os logs do preview/console.

4. Depois de capturar o resultado, remover todos os logs temporários e devolver apenas o diagnóstico: auth.uid real, erro da query se houver, quantidade de linhas, e qual condição está bloqueando o histórico.