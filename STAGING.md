# Ambiente de Staging — VoiceHealth

## Por que staging?

Hoje, qualquer push no `main` vai direto para produção via Lovable Publish.
Um ambiente de staging permite testar mudanças antes de afetar médicos em uso real.

## Como funciona

1. Branch `staging` no GitHub para mudanças em teste
2. Branch `main` continua sendo produção
3. Fluxo: `staging` → testar → merge para `main` → Publish no Lovable

## Setup (uma vez)

### 1. Criar branch staging

No terminal (Claude faz isso) ou no GitHub:
```
git checkout -b staging
git push -u origin staging
```

### 2. Configurar Sentry (opcional, recomendado)

1. Criar conta grátis em https://sentry.io
2. Criar projeto "voicehealth" (plataforma: React)
3. Copiar o DSN (ex: `https://abc123@o456.ingest.sentry.io/789`)
4. Adicionar no `.env`:
   ```
   VITE_SENTRY_DSN="https://SEU_DSN_AQUI@sentry.io/PROJETO"
   ```
5. No Lovable, adicionar a mesma variável de ambiente

Erros de produção aparecerão automaticamente no painel do Sentry.

## Fluxo de Trabalho Diário

```
Lovable (editar) → push automático para staging
Claude Code → push para staging
                    ↓
            Testar no preview
                    ↓
            Merge staging → main (via GitHub PR)
                    ↓
            Publish no Lovable (produção)
```

### Para mudar o Lovable para apontar para staging:

1. No Lovable, vá em **Settings** → **Git**
2. Mude o branch padrão de `main` para `staging`
3. Agora edições do Lovable vão para `staging`
4. Quando aprovar, crie PR de `staging` → `main` no GitHub
5. Merge e Publish

## Backup do Banco de Dados

### Verificar (no Lovable → Supabase Cloud):

1. Abra o projeto no Lovable → clique no botão **Cloud**
2. Vá em **Database** → **Backups**
3. Verifique se backups diários estão habilitados
4. O plano Pro inclui: backup diário + 7 dias de retenção + PITR (Point-in-Time Recovery)
5. O plano Free inclui: backup diário + 7 dias mas SEM PITR

### Recomendação:

Para um app de saúde com dados de pacientes, **PITR é essencial**.
Se o plano atual não tiver PITR, considerar upgrade para Supabase Pro ($25/mês).

### Backup manual (emergência):

No SQL editor do Supabase Cloud, rodar:
```sql
-- Exportar tabelas críticas como CSV (via interface web)
-- Tabelas prioritárias: patients, consultations, clinical_reports, profiles
```

## Notas

- O Supabase (banco, auth, storage) é o mesmo para staging e produção.
  Para isolamento total, seria necessário um segundo projeto Supabase.
- Edge functions são deployadas via Lovable Cloud — compartilhadas entre branches.
- Para testes locais: `npm run dev` roda em localhost com o mesmo banco.
