# Acesso sem confirmação e gestão de senhas

## Objetivo
Permitir que novos usuários entrem imediatamente com e-mail e senha, sem depender da chegada de uma mensagem de confirmação, e permitir que somente o usuário mestre redefina senhas.

## Alterações
- Desativar a confirmação obrigatória por e-mail, mantendo cadastro e login por e-mail/senha ativos.
- Ajustar a tela de cadastro para entrar no sistema imediatamente após criar a conta, sem mensagem de “verifique seu e-mail”.
- Adicionar uma área de usuários visível apenas ao mestre, com identificação do usuário, empresa e status.
- Adicionar uma ação protegida para o mestre definir uma nova senha temporária para um usuário.
- Validar a permissão de mestre no servidor antes de listar usuários ou alterar senhas; nenhuma credencial administrativa será exposta no navegador.
- Manter Google como alternativa de acesso e preservar PT/EN.

## Segurança
- A nova senha será digitada pelo mestre e nunca armazenada na base de dados da aplicação.
- A operação usará o serviço administrativo apenas depois de confirmar, no servidor, que a pessoa autenticada possui o papel de mestre.
- Usuários comuns não verão nem poderão chamar as ações administrativas.

## Validação
- Confirmar cadastro com sessão imediata e redirecionamento para o painel.
- Confirmar que mestre consegue listar usuários e trocar uma senha.
- Confirmar que usuário comum recebe bloqueio.
- Verificar compilação e os fluxos de acesso no navegador.
