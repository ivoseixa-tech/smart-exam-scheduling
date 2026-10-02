# Plano — Correções de empresa, funcionário e agendamento

## Objetivo
Corrigir a consulta de CNPJ no cadastro de empresa e ajustar os campos solicitados sem interromper os fluxos existentes.

## Alterações
- Tornar a consulta de CNPJ confiável, com validação e mensagens claras quando o serviço público estiver indisponível.
- Preencher campos editáveis separados com os dados retornados: razão social, nome fantasia, situação, CNAE, contato e endereço completo; salvar exatamente os valores revisados no formulário.
- Separar Nome e CPF em colunas próprias na listagem de funcionários.
- Tornar RG e data de admissão opcionais no formulário e no banco de dados, mantendo os demais campos obrigatórios.
- Incluir Função como campo obrigatório no novo agendamento, preenchido inicialmente pela função do funcionário selecionado e salvo no agendamento.
- Atualizar os tipos da aplicação e as traduções PT/EN afetadas.

## Segurança e validação
- Validar CNPJ e todos os dados alterados tanto na tela quanto no servidor/banco.
- Preservar o isolamento dos dados por empresa e as permissões atuais.

## Verificação
- Testar consulta e preenchimento do CNPJ, cadastro com RG/admissão vazios, separação Nome/CPF e criação de agendamento com Função.
- Conferir compilação, erros do navegador e comportamento em desktop e celular.
