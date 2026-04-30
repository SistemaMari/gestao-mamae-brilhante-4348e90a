Identifiquei a causa atual: a conta `moadecarvalho@gmail.com` está registrada no banco apenas como `profissionais/consultorio` e não aparece na tabela de administradores. Por isso o app está obedecendo ao dado real do backend e direcionando para o perfil de médico.

Plano de correção:

1. Corrigir o vínculo da sua conta no banco
   - Inserir o usuário `eb7f5372-bb3c-4672-ae65-1c56574a6bec` na tabela `admins` com o nome existente.
   - Inserir/sincronizar o papel `admin` na tabela `user_roles`.
   - Remover o papel `consultorio` desse usuário em `user_roles`, para não manter papel conflitante.
   - Remover o registro residual em `profissionais` para esse mesmo usuário, já que a conta deve ser ADMIN e não médica.
   - Como essa conta não possui pacientes, consultas, laudos ou exames associados, a remoção do registro profissional não apagará produção clínica.

2. Reforçar a autenticação para priorizar papéis oficiais
   - Ajustar `AuthContext.tsx` para consultar primeiro `user_roles` e aplicar prioridade fixa:
     - `admin`
     - `gestor_geral`
     - `gestor`
     - `institucional`
     - `consultorio`
   - Manter as tabelas legadas (`admins`, `gestores_gerais`, `profissionais`) apenas como fallback, reduzindo a chance de novo redirecionamento errado quando houver dados antigos conflitantes.

3. Corrigir o bloqueio secundário do shell clínico para não interferir em admin
   - Ajustar `ProtectedRoute`/hook de dados profissionais para garantir que `useProfissionalData` não segure carregamento nem tente validar perfil médico quando o perfil resolvido for `admin`.

4. Validação esperada
   - Após aprovar e aplicar, ao fazer login com `moadecarvalho@gmail.com`, o perfil resolvido deve ser `admin` e o redirecionamento deve ir direto para `/admin`.
   - O acesso a `/paciente/nova` por essa conta deixará de ser permitido, porque ela não será mais tratada como médica.

Observação: esse plano corrige o problema atual no dado real da sua conta e também endurece o código para evitar reincidência por conflito entre papéis.