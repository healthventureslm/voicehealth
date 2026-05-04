# VoiceHealth — Rebuild V2

Schema novo: 24 tabelas, ward-scoped, multi-tenant correto, com lock de consulta + addenda.

## Ordem de execução

Cole cada arquivo no **SQL Editor** do Supabase (`paqwiibclhahzhbvbdlz`), na ordem:

| # | Arquivo | O que faz | Reversível? |
|---|---|---|---|
| 1 | `01_inspect.sql` | Lista tudo que existe hoje. **Não muda nada.** | sim (não muda nada) |
| 2 | `02_wipe.sql` | Apaga tudo no schema `public`. Preserva `auth.*` e `storage.*`. | só com backup do painel |
| 3 | `03_create.sql` | Cria 24 tabelas + RLS + funções + seed (Clínica São Vicente). | só com backup |
| 4 | `04_verify.sql` | Sanity check pós-create. | sim |

## Antes de rodar

1. **Backup**: Painel Supabase → Database → Backups → "Create manual backup"
2. **Pause edge functions** (opcional): se rodarem cron, podem dar erro durante o wipe
3. **Confirmar lista de auth.users** rodando o `01_inspect.sql` antes

## Pós-execução

Após o `03_create.sql`:

- Você (`healthventureslm@gmail.com`) vira **super_admin**
- `lfcfrontinw@outlook.com` vira **hospital_admin** da Clínica São Vicente
- Os outros 4 auth.users existentes ganham **profile vazio** mas **sem role** — vão precisar receber convite para entrar como doctor/nurse/auditor
- Hospital "Clínica São Vicente" tem 5 wards (UTI, Enfermaria, PS, CC, Ambulatório)
- 3 templates globais de relatório criados
- 6 IPSG goals (catálogo JCI) populados
- 12 especialidades médicas catalogadas

## Frontend depois disso

O frontend atual **VAI QUEBRAR** porque referencia tabelas antigas (`departments`, `ipsg_audit_checklists`, etc.). Plano:

1. Regenerar `src/integrations/supabase/types.ts` via `supabase gen types`
2. Renomear `departments` → `hospitals` em todas as referências
3. Adicionar lógica de `ward_assignments` no fluxo de cadastro/admin
4. Substituir `SelectDepartment` por tela "Aguardando convite"
5. Criar tela `/superadmin/*` mínima
6. Remover telas/rotas das tabelas que sumiram (FHIR, knowledge, etc.)

Lista detalhada de edits do frontend será o próximo passo.

## Como reverter (caso de emergência)

Painel Supabase → Database → Backups → restore do backup que você criou.
Tudo volta exatamente como estava antes do wipe.
