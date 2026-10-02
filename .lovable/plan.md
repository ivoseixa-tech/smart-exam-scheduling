# Plano — Agenda controlada, exames por função e guia em PDF

## Objetivo
Ampliar o sistema para que empresas aprovadas cadastrem funcionários e façam agendamentos apenas nos locais e horários liberados pelo mestre, com múltiplos exames e emissão de guia em PDF.

## Alterações

### 1. Exames do funcionário e da função
- Criar cadastro de funções ocupacionais por empresa, com uma lista padrão de exames para cada função.
- No cadastro do funcionário, permitir escolher a função cadastrada e pré-selecionar os exames da função.
- Permitir incluir ou retirar exames especificamente para cada funcionário, sem alterar o padrão da função.
- No novo agendamento, carregar automaticamente os exames do funcionário e permitir múltipla escolha; o mestre poderá ajustar a seleção e o usuário da empresa apenas escolher entre os exames permitidos.
- Mostrar os exames selecionados na agenda e na guia.

### 2. Locais e horários de atendimento
- Criar uma aba **Locais e horários**, administrada exclusivamente pelo mestre.
- Cadastrar locais com nome, endereço completo, contato, orientações e situação ativo/inativo.
- Permitir ao mestre abrir vagas individuais, cada uma com local, data, hora inicial e hora final.
- Impedir no banco dois agendamentos para a mesma vaga e impedir marcação em vaga inativa, passada ou já ocupada.
- Usuários de empresa verão apenas vagas disponíveis e não poderão alterar local, data ou horário.
- O mestre poderá criar, editar e desativar locais e vagas, além de agendar diretamente.

### 3. Acesso seguro das empresas
- Manter contas individuais: cada usuário cria sua própria senha, informa o código da empresa e aguarda aprovação do mestre.
- Permitir ao mestre gerar ou substituir o código de acesso de cada empresa e exibi-lo somente no momento da geração.
- Manter a redefinição manual da senha pessoal pelo mestre na aba Usuários.
- Não criar senha compartilhada da empresa, preservando autoria e segurança dos cadastros.

### 4. Avisos de novos agendamentos
- Registrar automaticamente um aviso para o mestre quando um usuário de empresa criar um agendamento.
- Exibir na Visão geral a quantidade de novos agendamentos e uma lista com empresa, funcionário, data, horário e local.
- Permitir marcar os avisos como lidos; agendamentos feitos pelo próprio mestre não gerarão aviso para ele.

### 5. Guia de agendamento em PDF
- Gerar a guia imediatamente após salvar o agendamento e manter um botão para emitir novamente na lista.
- Criar um PDF moderno e bilíngue com identificação e endereço da empresa, dados do funcionário, função, tipo ocupacional, exames, data, horário, local completo, contato, orientações e observações.
- Proteger a emissão: mestre acessa todas as guias e empresa acessa somente as próprias.
- Gerar o arquivo no navegador a partir de dados autorizados, sem armazenar dados sensíveis em links públicos.

## Segurança e dados
- Criar estruturas separadas para funções, exames padrão da função, exames específicos do funcionário, locais, vagas e avisos.
- Aplicar isolamento por empresa e permissões de mestre em todas as novas estruturas.
- Fazer a reserva da vaga de forma atômica para evitar dupla marcação, inclusive em acessos simultâneos.
- Registrar a função e os exames usados no momento do agendamento para preservar o histórico mesmo após alterações cadastrais.

## Experiência e idiomas
- Traduzir integralmente os novos campos, mensagens, estados, PDF e validações para PT/EN.
- Manter formulários claros em computador e celular, com exames organizados por categoria e seleção por caixas de marcação.

## Verificação
- Testar padrão de exames da função, ajustes por funcionário e múltipla escolha no agendamento.
- Testar criação, edição e bloqueio de vagas pelo mestre; testar que empresa apenas reserva vagas disponíveis.
- Simular duas reservas simultâneas e confirmar que apenas uma é aceita.
- Testar geração automática e reemissão da guia em PT/EN, conferindo visualmente todas as páginas do PDF.
- Testar aviso de novo agendamento, leitura pelo mestre, isolamento entre empresas e redefinição manual de senha.
- Validar compilação, erros do navegador e telas em desktop e celular.

## Detalhes técnicos
- Reaproveitar a relação já existente entre agendamentos e exames para suportar múltiplos itens.
- Adicionar migrações incrementais com políticas de acesso e permissões explícitas para todas as novas tabelas.
- Centralizar a criação do agendamento em uma função autenticada no servidor, derivando usuário e empresa da sessão e validando a vaga no banco.
- Usar uma biblioteca compatível com navegador para montar e baixar o PDF; nenhum arquivo ficará publicamente acessível.
