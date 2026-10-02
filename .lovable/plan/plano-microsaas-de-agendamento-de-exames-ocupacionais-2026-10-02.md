# Plano — MicroSaaS de agendamento de exames ocupacionais

## Objetivo
Criar um sistema web bilíngue (PT/EN) para o administrador mestre cadastrar e aprovar empresas, controlar usuários e funcionários, manter o catálogo de exames e realizar agendamentos com separação segura dos dados de cada empresa.

## Entregas

### 1. Acesso e segurança
- Ativar o Lovable Cloud para banco de dados, autenticação e funções protegidas.
- Criar login por e-mail e senha para o administrador mestre e usuários.
- Manter perfis completos em estrutura separada das credenciais, com empresa vinculada, nome, função, preferências e permissões.
- Implementar níveis de acesso seguros: mestre e usuário de empresa.
- Criar um código de acesso exclusivo por empresa para ingresso inicial, sem substituir a senha pessoal do usuário.
- Proteger todas as páginas e operações internas e garantir isolamento dos dados entre empresas.

### 2. Empresas e validação por CNPJ
- Cadastro por CNPJ com máscara e validação.
- Consultar uma fonte oficial/compatível da Receita Federal no servidor e preencher automaticamente razão social, nome fantasia, situação cadastral, endereço, CNAE e demais dados disponíveis no cartão CNPJ.
- Salvar o cadastro como pendente e disponibilizar ao administrador mestre uma fila de revisão.
- Permitir aprovação ou rejeição com motivo; somente empresas aprovadas poderão operar normalmente.
- Tratar indisponibilidade da consulta e permitir nova tentativa sem perder o preenchimento.

### 3. Funcionários
- Cadastro, consulta, edição e inativação de funcionários por empresa.
- Campos: nome completo, CPF, RG, naturalidade, nacionalidade, data de nascimento, sexo, função, data de admissão e posto de trabalho.
- Máscaras, limites e validações em português e inglês, incluindo CPF e datas.
- Pesquisa e filtros por nome, CPF, função, posto e situação.

### 4. Catálogo de exames
- Separar exames clínicos ocupacionais e exames complementares.
- Entregar um catálogo inicial amplo e editável, com nome, categoria, descrição, preparo, duração estimada, status e tradução PT/EN.
- Permitir ao mestre criar, editar, ativar e inativar exames.
- Incluir tipos de avaliação ocupacional como admissional, periódico, retorno ao trabalho, mudança de risco e demissional, sem confundi-los com os procedimentos complementares.

### 5. Agenda
- Criar agenda por dia, semana e lista, com filtros por empresa, funcionário, exame, posto e status.
- Fluxo de agendamento com empresa, funcionário, tipo ocupacional, exames clínicos/complementares, data, horário, local e observações.
- Validar conflitos de horário e campos obrigatórios.
- Permitir confirmar, reagendar, concluir e cancelar, mantendo histórico das alterações.
- Exibir painel inicial com próximos atendimentos, pendências e indicadores essenciais.

### 6. Idiomas e experiência
- Criar seletor PT/EN persistente no cabeçalho e traduzir navegação, formulários, validações, mensagens e estados.
- Interface administrativa profissional, clara e responsiva, com menu lateral, tabelas legíveis e formulários divididos em etapas quando necessário.
- Evitar tradução de dados oficiais retornados pelo CNPJ e de nomes próprios.

### 7. Estrutura de dados e auditoria
- Modelar empresas, perfis, permissões, códigos de acesso, funcionários, catálogo de exames, agendamentos, itens agendados e histórico.
- Aplicar regras de acesso por empresa em todas as tabelas; o mestre terá visão global validada no servidor.
- Registrar autor e data das ações importantes, especialmente aprovação de empresa e alterações de agendamento.
- Tratar CPF, RG, dados pessoais e observações de saúde como dados sensíveis, exibindo-os somente a usuários autorizados.

### 8. Verificação
- Testar login, ingresso por código, isolamento entre empresas, revisão de CNPJ, cadastros, catálogo e ciclo completo do agendamento.
- Conferir PT/EN, formulários, mensagens de erro e telas em desktop e celular.
- Validar que páginas privadas não abram sem sessão e que operações não possam ser chamadas sem autorização.

## Detalhes técnicos
- Aplicação em TanStack Start com Lovable Cloud, autenticação gerenciada e políticas de acesso no banco.
- Funções protegidas no servidor para consulta de CNPJ e operações sensíveis; entradas validadas no navegador e no servidor.
- Papéis armazenados separadamente dos perfis e verificados no servidor.
- O catálogo inicial será incluído como dados iniciais editáveis.
- A integração de CNPJ dependerá da disponibilidade e das condições de uso do provedor escolhido; nenhuma chave privada ficará exposta no navegador.

## Premissas adotadas
- Cada pessoa terá login individual; o código da empresa servirá para vincular o primeiro acesso à organização.
- A aprovação manual será feita exclusivamente pelo administrador mestre.
- O primeiro lançamento cobrirá cadastro e gestão de agendamentos, sem faturamento, pagamentos, laudos médicos ou notificações externas.
