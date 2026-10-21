RosaIA APP 🌸🤖

Assistente Inteligente Especializada em Saúde da Mulher e Apoio Clínico com IA, RAG (Retrieval-Augmented Generation) e Conformidade LGPD

📋 Sumário

Sobre o Projeto

Arquitetura do Sistema

Tecnologias Utilizadas

Estrutura de Pastas e Componentes

Funcionalidades Principais

Guia de Configuração e Instalação

Variáveis de Ambiente

Executando com Docker e Produção

Testes e Qualidade de Código

Segurança, LGPD e Privacidade

Como Contribuir

Licença

💡 Sobre o Projeto

O RosaIA_APP é uma aplicação corporativa e de saúde desenvolvida no ecossistema de inovação do Uniceplac Startup. Trata-se de uma plataforma inteligente voltada para a área de saúde da mulher, integrando processamento de linguagem natural avançado (LLMs/Gemini), motores de Recuperação Aumentada por Conhecimento (RAG), triagem automatizada, interpretadores de exames médicos e gestão de lembretes integrados.

O sistema foi rigorosamente desenhado para seguir diretrizes clínicas de referência (como protocolos do INCA e SBM) e padrões estritos de segurança de dados e privacidade em conformidade com a LGPD (Lei Geral de Proteção de Dados).

🏛️ Arquitetura do Sistema

O projeto segue uma arquitetura moderna desacoplada (Client-Server):

Backend: Desenvolvido em Python (FastAPI), estruturado em camadas (api, core, db, services, ai), com suporte a migrações via Alembic, ORM SQLAlchemy e integração assíncrona com modelos de IA.

Frontend: Desenvolvido em React + TypeScript + Vite, estilizado com Tailwind CSS, organizando a interface através de uma arquitetura modular baseada em contextos (AuthContext, ChatContext, ReminderContext, UiContext).

Base de Conhecimento RAG: Contém chunks de diretrizes médicas indexadas (INCA, SBM, exames radiológicos e diretrizes acadêmicas do Uniceplac) para garantir respostas baseadas em evidências.

🛠️ Tecnologias Utilizadas

Backend (/backend)

Framework: FastAPI / Uvicorn

Banco de Dados: PostgreSQL com SQLAlchemy & Alembic (Migrações)

Inteligência Artificial & RAG: Google GenAI / Gemini API, motores RAG customizados, analisador de emoções e filtros de segurança (safety.py, emotion_analyzer.py)

Validação e Tipagem: Pydantic

Testes: Pytest

Frontend (/frontend)

Linguagem: TypeScript

Build Tool: Vite

Estilização: Tailwind CSS & PostCSS

Gerenciamento de Estado: React Context API

Deploy/Hospedagem: Configurado para Vercel e Render

📂 Estrutura de Pastas e Componentes

RosaIA_APP/
├── backend/
│   ├── alembic/                  # Migrações de banco de dados
│   ├── app/
│   │   ├── ai/                   # Motor de IA, RAG, segurança e prompts
│   │   ├── api/v1/endpoints/     # Rotas de Auth, Chat, Perfil, Lembretes, Triagem, Upload
│   │   ├── core/                 # Configurações, segurança, exceções e logs
│   │   ├── db/                   # Modelos ORM do SQLAlchemy e sessões
│   │   ├── knowledge_base/       # Chunks de diretrizes médicas e ingestão
│   │   ├── schemas/              # Modelos Pydantic de entrada/saída
│   │   └── services/             # Regras de negócio, LGPD e validação de arquivos
│   ├── tests/                    # Testes automatizados (resiliência, segurança, IA)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── render.yaml
├── database/
│   └── schema.sql                # Schema relacional de banco de dados
└── frontend/
    ├── public/                   # Assets públicos e favicons
    ├── src/
    │   ├── assets/               # Imagens, logos e esquemas SQL auxiliares
    │   ├── components/           # Componentes modulares (Auth, Chat, Layout, Modals, Profile, Reminders, Triage)
    │   ├── context/              # Contextos globais (Auth, Chat, Reminder, Toast, UI)
    │   ├── data/                 # Dados estáticos e seeds de exemplo
    │   ├── hooks/                # Custom hooks (arquivos, formulários)
    │   ├── services/             # Integrações com API e serviço do Gemini/RAG
    │   ├── types/                # Definições de tipos TypeScript
    │   └── utils/                # Validadores (CPF, senhas, LGPD, criptografia)
    ├── tailwind.config.js
    ├── tsconfig.json
    └── vercel.json


🚀 Funcionalidades Principais

Chat Inteligente com RAG: Assistente conversacional integrado com diretrizes médicas oficiais (INCA, SBM, Radiologia) para consultas seguras e embasadas.

Triagem Automatizada: Módulo de classificação clínica preliminar para direcionamento do usuário.

Análise e Interpretação de Exames: Upload seguro de documentos com validação rigorosa de formato e extração de insights por IA.

Gestão de Lembretes: Sistema completo de agendamentos e notificações para acompanhamento de saúde.

Anonimização e LGPD: Camada de serviço voltada para mascaramento e proteção de dados sensíveis (como criptografia de CPF e termos de consentimento).

⚙️ Guia de Configuração e Instalação

Pré-requisitos

Git instalado.

Python 3.10+ para o backend.

Node.js 18+ e npm/yarn para o frontend.

PostgreSQL configurado localmente ou via container.

1. Clonando o Repositório

git clone https://github.com/UniceplacStartup/RosaIA_APP.git
cd RosaIA_APP


2. Configurando o Backend

cd backend

# Crie e ative um ambiente virtual
python -m venv venv
# No Windows:
venv\Scripts\activate
# No Linux/Mac:
source venv/bin/activate

# Instale as dependências
pip install -r requirements.txt

# Configure o arquivo de ambiente
cp .env.example .env
# Edite o arquivo .env preenchendo as chaves de banco de dados e da API do Gemini


Executando as migrações e iniciando o servidor backend:

alembic upgrade head
python main.py
# O servidor rodará em http://localhost:8000


3. Configurando o Frontend

cd ../frontend

# Instale as dependências
npm install

# Configure o arquivo de ambiente
cp .env.example .env

# Inicie o servidor de desenvolvimento
npm run dev
# A aplicação web estará acessível em http://localhost:5173


🔐 Variáveis de Ambiente

Backend (backend/.env)

DATABASE_URL=postgresql://usuario:senha@localhost:5432/rosaia_db
SECRET_KEY=sua_chave_secreta_super_segura
GEMINI_API_KEY=sua_chave_de_api_do_google_gemini
ACCESS_TOKEN_EXPIRE_MINUTES=30


Frontend (frontend/.env)

VITE_API_BASE_URL=http://localhost:8000/api/v1


🐳 Executando com Docker

O projeto possui suporte a containerização no backend através do arquivo Dockerfile. Para construir e executar a imagem do backend:

cd backend
docker build -t rosaia-backend .
docker run -p 8000:8000 --env-file .env rosaia-backend


🧪 Testes e Qualidade de Código

Para garantir a resiliência das integrações de IA, segurança e validade dos módulos, execute os testes unitários no backend utilizando o pytest:

cd backend
pytest


🛡️ Segurança, LGPD e Privacidade

O RosaIA_APP prioriza a privacidade do usuário final através de:

Criptografia e Validação de CPF: Utilitários dedicados no frontend e backend para validação e proteção de dados cadastrais.

Termos de Consentimento (Consent Management): Mapeamento de aceite ativo de termos de privacidade e LGPD (consent.py, lgpd_service.py).

Filtros de Segurança de IA: Camada de inspeção em safety.py e emotion_analyzer.py para mitigar alucinações e modular respostas sensíveis com responsabilidade clínica.

🤝 Como Contribuir

Contribuições são altamente encorajadas! Siga os passos abaixo:

Faça um Fork do projeto.

Crie uma branch para sua feature (git checkout -b feature/MinhaFeature).

Faça o Commit das alterações (git commit -m 'feat: Adiciona nova funcionalidade').

Faça o Push para a branch (git push origin feature/MinhaFeature).

Abra um Pull Request.

📄 Licença

Este projeto está sob a licença MIT. Sinta-se livre para usá-lo, modificá-lo e estudá-lo.

Feito com 💜 pelo time Uniceplac Startup.
