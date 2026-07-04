# Boreal Quote Pro

Plataforma web profissional para parceiros autorizados Boreal criarem cotações de painéis de LED com cálculo automático de área, pixels, processadoras NovaStar, estrutura, instalação, margem embutida e PDF comercial.

## Stack

- React + Vite + TypeScript
- TailwindCSS
- Supabase Auth, Database e Storage preparado por SQL
- TanStack Query
- Zustand
- Zod
- jsPDF
- Recharts
- Lucide React

## Rodando localmente

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env` e configure as chaves do Supabase quando for conectar autenticação e banco reais.

Este projeto usa Vite. As variáveis públicas precisam estar como:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Supabase

O arquivo `supabase/schema.sql` contém:

- Tabelas de parceiros, perfis, clientes, produtos, formatos, processadoras, serviços, cotações e eventos.
- Seeds de processadoras NovaStar e serviços padrão.
- RLS por perfil e `partner_id`.
- Função `check_client_conflict` que retorna apenas alertas seguros, sem revelar parceiro, vendedor, valores ou dados comerciais de terceiros.

Para gravar dados reais, crie um usuário no Supabase Auth e cadastre o mesmo `id` na tabela `profiles`, ligado a um `partner_id` existente. Sem esse vínculo, o login é bloqueado e as políticas RLS impedem salvar clientes e cotações no banco.

### Correção de acesso e persistência

Se o app mostrar `Supabase nao esta configurado neste ambiente`, crie um arquivo `.env` a partir de `.env.example` e preencha as variáveis reais do projeto:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

Depois de criar as tabelas, execute `supabase/fix_auth_quote_access.sql` no SQL Editor do Supabase. Esse script:

- bloqueia acesso anônimo às tabelas do app;
- exige login autenticado e linha correspondente em `profiles`;
- adiciona `GRANT` explícito para o Data API;
- recria as policies de clientes, cotações e eventos por `partner_id`;
- remove a autorização baseada em `user_metadata`.

Para liberar um login, o usuário precisa existir no Supabase Auth e ter o mesmo `id` em `public.profiles`. Usuários sem perfil autorizado não entram na plataforma.

## PDF

O PDF gerado mostra apenas valores finais ao cliente. Margem, custo base, lucro e regras internas não aparecem na proposta comercial.
