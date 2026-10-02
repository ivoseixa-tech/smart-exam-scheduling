# Aprovação mestre para novos acessos

## Resultado
Novos cadastros ficam pendentes e não entram no sistema até o usuário mestre aprovar. O primeiro usuário mestre e os acessos já ativos permanecem liberados.

## Implementação
- Alterar a criação de perfil para marcar novos usuários comuns como inativos, mantendo o primeiro mestre ativo.
- Após o cadastro, encerrar a sessão e exibir uma mensagem PT/EN informando que a aprovação está pendente.
- No login, validar o estado do perfil e impedir a entrada enquanto estiver pendente.
- Bloquear também acessos por Google na chegada ao painel, mostrando uma tela de espera sem dados operacionais.
- Na área **Usuários**, mostrar o status e permitir ao mestre aprovar ou suspender contas.
- Manter a aprovação protegida no servidor, com validação da função mestre antes de qualquer alteração.

## Validação
- Confirmar que cadastro novo não acessa o painel.
- Confirmar que o mestre vê e aprova usuários pendentes.
- Confirmar que um usuário aprovado consegue entrar e um suspenso é bloqueado.
- Verificar PT/EN, compilação e ausência de erros no navegador.
