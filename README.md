Sistema de Cobranças
Sistema web para automação de cobranças e gestão de recebíveis para pequenas e médias empresas. Desenvolvido com Node.js, Express, SQLite e React 18.

Visão Geral
O sistema cobre o ciclo completo de cobranças: cadastro de clientes, emissão de cobranças com links Pix, envio automático de lembretes por WhatsApp e email, análise de risco com inteligência artificial, relatórios exportáveis e controle de acesso por usuários.
Integrações externas são opcionais. Sem nenhuma chave configurada, o sistema funciona em modo mock — mensagens são exibidas no console e links Pix são simulados localmente. Cada integração pode ser ativada individualmente adicionando a chave correspondente no arquivo .env.

Stack
Backend

Node.js 20 com Express 4
SQLite via sqlite3 (sem compilação nativa)
Autenticação JWT com bcryptjs
Validação de input com Zod
Rate limiting com express-rate-limit
Agendamento com node-cron
Email com nodemailer (suporte Resend e SMTP)

Frontend

React 18 com React Router v6
CSS puro com variáveis (sem framework de UI)
Fonte Inter + JetBrains Mono

Integrações externas (todas opcionais)

Claude (Anthropic) — mensagens personalizadas e análise de risco
Z-API ou Twilio — envio real de WhatsApp
Resend ou Gmail SMTP — envio real de email
Asaas — cobranças Pix reais com confirmação automática via webhook


Instalação e Execução Local
Pré-requisitos: Node.js 18 ou superior.
bash# Backend
cd backend
npm install
cp .env.example .env   # editar com suas chaves
npm run seed           # inserir dados de exemplo (opcional)
npm run dev            # inicia em http://localhost:3001

# Frontend (outro terminal)
cd frontend
npm install
npm start              # abre em http://localhost:3000
Ao iniciar, o terminal exibe o status de cada integração:
Cobrancas API v4 em http://localhost:3001
IA:        Claude ativado       (ou: Configure ANTHROPIC_API_KEY)
WhatsApp:  mock                 (ou: zapi / twilio)
Email:     resend               (ou: mock / smtp)
Pix:       mock                 (ou: asaas)
Auth:      JWT ativo — login: admin@empresa.com / admin123

Variáveis de Ambiente
Copie backend/.env.example para backend/.env e preencha conforme necessário. Nenhuma variável é obrigatória para o sistema funcionar em modo de desenvolvimento.
VariávelDescriçãoObrigatóriaANTHROPIC_API_KEYChave da API Claude — ativa IA no sistemaNãoZAPI_INSTANCE_ID / ZAPI_TOKENCredenciais Z-API para WhatsApp realNãoTWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKENCredenciais Twilio para WhatsAppNãoRESEND_API_KEYChave Resend para email realNãoEMAIL_HOST / EMAIL_USER / EMAIL_PASSConfiguração SMTP alternativaNãoASAAS_API_KEYChave Asaas para cobranças Pix reaisNãoASAAS_SANDBOXtrue para ambiente de testes do AsaasNãoJWT_SECRETSegredo para assinar tokens JWTRecomendado em produçãoBASE_URLURL pública do servidor (usada nos links Pix)Recomendado em produçãoFRONTEND_URLOrigem permitida pelo CORSRecomendado em produçãoCOMPANY_NAMENome da empresa exibido nos emailsNãoPIX_KEYChave Pix exibida na página de pagamento mockNão

API — Endpoints Principais
Todos os endpoints exceto /auth/login, /health e /pix/:token exigem o header:
Authorization: Bearer <token>
Autenticação
MétodoRotaDescriçãoPOST/auth/loginLogin — retorna token JWTGET/auth/meDados do usuário autenticadoGET/auth/usersLista usuários (admin)POST/auth/usersCriar usuário (admin)PATCH/auth/passwordAlterar própria senha
Clientes
MétodoRotaDescriçãoGET/customersLista com totais financeiros (suporta ?search=)POST/customersCriar cliente (com cobrança inicial opcional)GET/customers/:idDetalhe com todas as cobrançasPATCH/customers/:idEditar dados do clienteDELETE/customers/:idRemover cliente e cobranças (cascade)POST/customers/importImportar array de clientes em bulk
Cobranças
MétodoRotaDescriçãoGET/paymentsLista (filtros: ?status= ?from= ?to= ?search=)POST/paymentsCriar cobrança + link Pix automáticoPATCH/payments/:id/statusAtualizar statusDELETE/payments/:idRemover cobrança
Recorrências
MétodoRotaDescriçãoGET/recurrencesLista de cobranças recorrentesPOST/recurrencesCriar recorrência (gera primeira cobrança)PATCH/recurrences/:id/togglePausar / ativarDELETE/recurrences/:idRemover
Dashboard e Relatórios
MétodoRotaDescriçãoGET/dashboardResumo financeiro + próximos vencimentos + gráfico mensalGET/dashboard/messagesHistórico de mensagens (últimas 100)GET/reports/summaryResumo por período (?from= ?to=)GET/reports/export/csvDownload CSV (?from= ?to= ?status= &token=)GET/reports/export/pdfDownload PDF para impressão (&token=)
Inteligência Artificial
MétodoRotaDescriçãoGET/ai/statusStatus de todas as integraçõesGET/ai/riskAnálise de risco da carteira (requer Claude)POST/ai/chatChat em linguagem natural sobre os dadosPOST/ai/message/:idGerar mensagem personalizada para uma cobrança
Outros
MétodoRotaDescriçãoGET/healthHealth check com status do banco e IAGET/pix/:tokenPágina pública de pagamento PixPOST/webhooks/asaasWebhook de confirmação de pagamento (Asaas)GET/settingsConfigurações da empresaPATCH/settingsSalvar configurações

Banco de Dados
SQLite com WAL mode e foreign keys habilitados. Schema criado automaticamente na primeira execução. Migrations seguras (ALTER TABLE com try/catch) permitem atualizar o banco sem perda de dados.
Tabelas

users — usuários com perfis admin e operator
customers — clientes com nome, telefone, email, CPF/CNPJ e notas
payments — cobranças com status, vencimento e referência a recorrência
recurrences — configuração de cobranças mensais automáticas
pix_links — links de pagamento com token único e expiração
message_logs — histórico de todas as mensagens enviadas
settings — configurações da empresa em chave/valor


Scheduler
Executa a cada hora via node-cron. A cada execução:

Atualiza cobranças com due_date < hoje de pending para overdue
Envia lembrete 2 dias antes do vencimento (WhatsApp + email)
Envia aviso no dia do vencimento
Envia cobrança de atraso para todas as cobranças overdue
Deduplica envios — uma mensagem por tipo por cobrança por dia

Adicionalmente, executa diariamente às 6h para gerar cobranças do mês corrente a partir das recorrências ativas.
Se ANTHROPIC_API_KEY estiver configurada, cada mensagem é gerada pela IA com tom ajustado ao histórico de atraso do cliente. Caso contrário, usa templates estáticos.

Perfis de Acesso
PerfilPermissõesadminAcesso total — inclui usuários, configurações e relatóriosoperatorClientes, cobranças, recorrências, dashboard e mensagens

Docker
bashdocker-compose up --build
Frontend disponível em http://localhost:3000, backend em http://localhost:3001. O banco de dados é persistido em volume nomeado (db_data).
Para produção, ajustar no docker-compose.yml:

BASE_URL para a URL pública do servidor
FRONTEND_URL para a URL do frontend
JWT_SECRET para um segredo forte
ASAAS_SANDBOX=false se usando Pix em produção


Compartilhar com Outros Usuários na Rede
Para acesso na mesma rede local, descubra o IP da máquina com ipconfig (Windows) e acesse http://SEU_IP:3000.
Para acesso remoto sem servidor, o Tailscale cria uma rede privada gratuita entre dispositivos. Instale em ambas as máquinas, faça login na mesma conta e acesse pelo IP Tailscale.

Próximos Passos
Os itens abaixo estão priorizados por impacto no produto e complexidade de implementação.
Prioridade alta

Layout responsivo completo — o sistema foi desenvolvido para desktop. Adicionar breakpoints para tablets e mobile, com sidebar colapsável em telas menores.
Portal do cliente — página pública acessada por link único onde o cliente visualiza todas as suas cobranças, status e botão de pagamento, sem precisar de conta no sistema.
Opt-out de mensagens — campo opted_out na tabela de clientes e lógica no scheduler para não enviar mensagens a clientes que solicitaram saída. Exigido pela política do WhatsApp Business.
Normalização de telefone para E.164 — ao salvar um cliente, converter o número para o formato +5511999999999 automaticamente. Necessário para que o Z-API e Twilio funcionem corretamente sem ajuste manual.

Prioridade média

Régua de cobrança configurável — substituir o scheduler fixo (D-2, D0, D+overdue) por uma sequência configurável pelo usuário: quantos dias antes avisar, com qual frequência repetir o aviso de atraso e em qual canal (WhatsApp, email ou ambos).
Importação de planilha com cobranças — atualmente a importação CSV cria apenas clientes. Expandir para aceitar colunas de cobrança (valor, vencimento, descrição) e criar cliente + cobrança em uma operação.
Paginação nos endpoints — GET /customers e GET /payments retornam todos os registros. Adicionar ?page=&limit= para suportar carteiras grandes sem impacto de performance.
Busca global expandida — a busca atual filtra apenas clientes. Incluir cobranças e mensagens nos resultados.
Notificações em tempo real — substituir o polling de 60 segundos no dashboard por WebSocket (Socket.io). Quando um pagamento for confirmado via webhook do Asaas, o dashboard atualiza instantaneamente.

Prioridade baixa

Consulta de CPF/CNPJ e negativação — integração com Serasa ou SPC para consultar inadimplência antes de fechar negócio, e negativação automática após X dias em atraso configurável.
Boleto bancário — o Asaas já suporta boleto. Adicionar billingType: 'BOLETO' como opção de cobrança para clientes que preferem boleto a Pix.
Relatórios avançados — previsão de caixa para os próximos 30/60/90 dias baseada em cobranças pendentes e histórico de pagamento de cada cliente, gerada pela IA.
Multi-empresa (SaaS) — adicionar coluna company_id em todas as tabelas e isolamento por tenant. Permite hospedar uma instância do sistema para múltiplos clientes pagantes.
Aplicativo mobile — React Native reutiliza a maior parte da lógica de negócio e da API. Prioridade baixa porque o sistema já funciona bem no browser mobile.


Credenciais Padrão
CampoValorEmailadmin@empresa.comSenhaadmin123

⚠️ Altere a senha imediatamente após o primeiro acesso em Configurações > Alterar senha.

## Screenshots

![Dashboard](docs-screenshots/dashboard.png)

![Login](docs-screenshots/login.png)

![Clientes](docs-screenshots/clientes.png)

![Novo Cliente](docs-screenshots/clientes-novo%20cliente.png)

![Importar CSV](docs-screenshots/clientes-importar%20csv.png)

![Cobranças](docs-screenshots/cobrancas.png)

![Nova Cobrança](docs-screenshots/cobrancas-nova%20cobranca.png)

![Recorrências](docs-screenshots/recorrencia.png)

![Nova Recorrência](docs-screenshots/recorrencia-nova%20recorrencia.png)

![Relatórios](docs-screenshots/relatorios.png)

![Export PDF](docs-screenshots/pdfexport.png)

![Mensagens](docs-screenshots/mensagens.png)

![Usuários](docs-screenshots/usuarios.png)

![Novo Usuário](docs-screenshots/novousuario.png)

![Configurações](docs-screenshots/configs.png)
