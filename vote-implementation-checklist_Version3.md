# Plano + Checklist completo (DB primeiro) — Votos `single/ranking/multiple` + auditabilidade (voto único)

Data: 2025-12-18  
Repo: `AdminAuditavel/Auditavel`  
Objetivo: checar **todas as tabelas existentes** e fechar um plano executável “do banco para a API”, já alinhado com o schema atual.

---

## 0) Schema atual (baseline) — tabelas existentes

Tabelas em `public` (confirmadas):
- `admin_audit_logs`
- `audit_logs`
- `face_hashes`
- `merkle_snapshots`
- `participant_attributes`
- `participant_profile`
- `participants`
- `poll_custom_options`
- `poll_options`
- `polls`
- `vote_options`
- `vote_rankings`
- `votes`

> Este checklist assume **Supabase/Postgres**, e que o endpoint principal é `/app/api/vote/route.ts`.

---

# Fase 1 — Verificação do banco (tabela por tabela) + ajustes necessários

A ideia aqui é: para cada tabela, **(a)** validar se ela suporta a regra nova, **(b)** registrar riscos/ajustes, **(c)** decidir se precisa migração.

## 1.1 `polls` (configuração da poll — peça central)
### O que já existe (confirmado)
Colunas relevantes:
- `id uuid pk`
- `status text default 'open'`
- `allow_multiple boolean default false` (legado/UI)
- `max_votes_per_user integer null`
- `voting_type text default 'single'`  (`single`/`ranking`/`multiple`)
- `vote_cooldown_seconds integer null`
- `max_options_per_vote integer null`
- `closes_at`, `start_date`, `end_date` (janelas)
- `allow_custom_option`, `show_partial_results`

### Checagens (fazer agora)
- [x] **Checar valores reais** de `voting_type` existentes (ex.: só `single` e `ranking`? já tem `multiple`?)
- [x] **Checar quantas polls** têm `max_votes_per_user IS NULL`
- [x] **Checar quantas polls multiple** têm `max_options_per_vote IS NULL` (no seu requisito isso é permitido e significa “sem limite”)
- [x] Checar consistência de janela:
  - [x] se vocês usam `closes_at` ou `end_date` de verdade (padronizar no código)

### Decisões já tomadas (registrar)
- `allow_multiple` pode continuar existindo, mas regra de negócio usa `max_votes_per_user`.
- Se `max_options_per_vote` for NULL e `voting_type='multiple'` ⇒ sem limite (1..todas opções).

### Ações recomendadas
- [x] **(Recomendado)** Backfill: setar `max_votes_per_user=1` quando `NULL` e `allow_multiple=false`
- [x] **(Recomendado)** Definir default `max_votes_per_user=1` para novas polls (evitar NULL ambíguo)

**Aceite:** a configuração da poll é suficiente para o endpoint decidir o fluxo sem heurística.

---

## 1.2 `poll_options` (opções válidas da poll)
### O que já existe
- `id uuid pk`
- `poll_id uuid fk polls(id)`
- `option_text text`
- `votes_count integer default 0` (contador)

### Checagens
- [x] Confirmar se `votes_count` é usado/atualizado (hoje parece não estar sob trigger)
- [x] Confirmar se existe constraint/índice em `poll_id`

### Regras do novo endpoint
- Toda `option_id` recebida deve existir em `poll_options` com `poll_id = body.poll_id`.

**Aceite:** não é possível votar em opção de outra poll.

---

## 1.3 `votes` (voto “pai”)
### O que já existe
Colunas relevantes:
- `id uuid pk`
- `poll_id uuid fk polls(id)`
- `participant_id uuid NOT NULL`
- `user_hash text NOT NULL`
- `option_id uuid fk poll_options(id) NULL` (serve para `single`)
- `created_at`, `updated_at` (timestamp sem tz)
- `votes_count integer default 1` (legado; hoje pouco usado)

### Checagens críticas
- [x] Confirmar se existe índice em `(poll_id, participant_id)` (vai ser a chave mais consultada)
- [x] Confirmar se `updated_at` é atualizado de fato em todos fluxos atuais (precisa ser para cooldown)
- [x] Checar se existe voto com `participant_id` inválido (sem participant) — deve ser impossível pelo FK? (não aparece FK no dump; hoje `votes.participant_id` não tem FK listado)

> **Atenção:** na lista de constraints você não trouxe FK `votes.participant_id -> participants.id`. Se realmente não existir, é uma lacuna.

### Regras do novo endpoint
- Todas as regras de cooldown/limite/voto vigente serão por `(poll_id, participant_id)`, não por `user_hash`.
- Para `max_votes_per_user=1`, deve existir **no máximo 1 “voto vigente” por participante** (pela lógica do endpoint; opcionalmente reforçado depois via RPC/locks).

### Ações recomendadas
- [x] Adicionar FK `votes.participant_id -> participants.id` (se realmente não existir)
- [x] Adicionar índice `(poll_id, participant_id, updated_at desc)` para cooldown e busca do vigente

**Aceite:** conseguimos localizar rapidamente o voto vigente e aplicar cooldown corretamente.

---

## 1.4 `vote_rankings` (filhas do ranking)
### O que já existe
- `id uuid pk`
- `vote_id uuid fk votes(id)`
- `option_id uuid fk poll_options(id)`
- `ranking integer`
- `created_at`, `updated_at`

### Checagens
- [x] Confirmar se existem duplicates por `(vote_id, option_id)` hoje (precisa bloquear)
- [x] Confirmar se existem dois itens com mesmo `(vote_id, ranking)` (precisa bloquear)

### Ações necessárias (migrations)
- [x] Adicionar UNIQUE `(vote_id, option_id)`
- [x] Adicionar UNIQUE `(vote_id, ranking)`

**Aceite:** ranking não fica inconsistente mesmo com bugs no client.

---

## 1.5 `vote_options` (filhas do multiple)
### O que já existe
- `id uuid pk` (observação: seu `id` não tem default; é NOT NULL — confirmar como vocês geram)
- `vote_id uuid fk votes(id)`
- `option_id uuid fk poll_options(id)`
- `created_at timestamptz default now()`
- UNIQUE `(vote_id, option_id)` (já existe)

### Checagens
- [x] Confirmar como `vote_options.id` é gerado (client gera UUID? trigger? código?)
- [x] Confirmar se há índice em `vote_id`

### Regras do novo endpoint
- Dentro de um `vote_id`, não pode repetir option (BD já impede).
- Payload multiple pode vir repetido ⇒ endpoint deduplica antes de inserir.

**Aceite:** multiple funciona com dedup e sem erro de unique violation.

---

## 1.6 `participants` (identidade canônica)
### O que já existe
- `id uuid pk` (sem default, então o client/backend fornece)
- `created_at`, `first_seen_at`, `last_seen_at`

### Checagens
- [x] Confirmar se `participants.id` sempre vem do client e se isso é aceitável por enquanto
- [x] Confirmar se existem participants “órfãos” (ok) e se existe limpeza (provável não)

### Regra para biometria (futuro)
- Hoje não vamos decidir schema.
- Vamos criar **um gate no código** `assertParticipantEligible` para, no futuro, exigir biometria em polls específicas e não gravar nada.

**Aceite:** o voto usa `participant_id` e o sistema está pronto para migrar para “pessoa canônica biométrica”.

---

## 1.7 `participant_profile` e `participant_attributes`
### O que já existe
- `participant_profile`: pk `participant_id`, campos demográficos, `updated_at`
- `participant_attributes`: parece ser por poll + participant (tem `poll_id`), mas a constraint UNIQUE ficou estranha no dump (mostra repetido)

### Checagens
- [x] Confirmar intenção de uso:
  - `participant_profile`: perfil global do participante
  - `participant_attributes`: atributos por poll (ex.: capturados no momento do voto)
- [x] Revisar UNIQUE de `participant_attributes` (deveria ser UNIQUE(participant_id, poll_id))

**Aceite:** não bloqueia votação; apenas registrar que existe.

---

## 1.8 `face_hashes` (biometria — já existe)
### O que já existe
- `user_hash` UNIQUE
- `created_at`

### Checagens
- [x] Confirmar se isso é protótipo ou já será usado
- [x] Confirmar se no futuro a biometria vai mapear para `participant_id` (A: participant_id é a pessoa)

**Aceite:** não vamos acoplar agora; apenas manter caminho.

---

## 1.9 `audit_logs`, `admin_audit_logs`, `merkle_snapshots`
### Situação
- Já existem e podem coexistir com `vote_events`.

### Checagens
- [x] Confirmar se `audit_logs` é usado para voto hoje (parece ser genérico)
- [x] Confirmar se `admin_audit_logs` já registra mudanças de configuração
- [x] Confirmar como `merkle_snapshots` é gerado (manual/job)

**Aceite:** continuar funcionando sem conflito.

---

# Fase 2 — Novas tabelas/ajustes mínimos (para suportar o requisito)

## DB-A — Criar `vote_events` (novo, obrigatório para voto único auditável)
- [x] Criar tabela `vote_events` com:
  - [x] `poll_id`, `vote_id`, `participant_id`
  - [x] `event_type`: `created` / `updated`
  - [x] `before_state jsonb`, `after_state jsonb`
  - [x] `created_at timestamptz default now()`
- [x] Criar índices conforme necessidade de auditoria

**Aceite:** conseguimos reconstruir toda a evolução do voto único.

---

## DB-B — Adicionar constraints em `vote_rankings` (obrigatório)
- [x] UNIQUE `(vote_id, option_id)`
- [x] UNIQUE `(vote_id, ranking)`

**Aceite:** ranking consistente.

---

## DB-C — (Recomendado) FK e índices de performance
- [x] Garantir FK `votes.participant_id -> participants.id` (se ainda não existir)
- [x] Índices:
  - [x] `votes(poll_id, participant_id)`
  - [x] `votes(poll_id, participant_id, updated_at desc)`
  - [x] `vote_rankings(vote_id, ranking)`
  - [x] `vote_options(vote_id)`

**Aceite:** endpoint não degrada em polls com muitas respostas.

---

# Fase 3 — API `/api/vote` (refatoração com regras completas)

## API-1 — Ordem correta do fluxo (sem efeitos colaterais)
- [x] Parse body
- [x] Buscar poll (status, voting_type, max_votes_per_user, vote_cooldown_seconds, max_options_per_vote, janelas)
- [x] Validar poll aberta/janela
- [x] `assertParticipantEligible(...)` (gancho biometria) **ANTES** de escrever qualquer coisa
- [x] Validar payload por tipo (single/ranking/multiple)
- [x] Validar pertencimento das opções à poll
- [x] Aplicar cooldown (somente leitura)
- [x] Sync participant (criar/atualizar last_seen_at)
- [x] Executar cast vote (max=1 ou max>1)
- [x] Retornar resposta

**Aceite:** se a poll não permitir votar, nada é gravado (nem participant).

---

## API-2 — Decisão do tipo por `poll.voting_type` (Forma A)
- [x] `single`: usa `option_id`
- [x] `ranking`: usa `option_ids` ordenado
- [x] `multiple`: usa `option_ids` como conjunto

**Aceite:** o mesmo payload `option_ids` funciona para ranking e multiple sem conflito.

---

## API-3 — Validações por tipo (conforme decisões)
### Single
- [x] `option_id` obrigatório

### Ranking
- [x] `option_ids.length >= 1`
- [x] qualquer ordem aceita
- [x] duplicatas: rejeitar (400)

### Multiple
- [x] `option_ids.length >= 1`
- [x] deduplicar
- [x] se `max_options_per_vote != NULL` limitar
- [x] se `max_options_per_vote == NULL` sem limite (até todas)

**Aceite:** validações impedem inconsistências antes de escrever.

---

## API-4 — Cooldown baseado em `votes.updated_at` (confirmado “A”)
- [x] Se `vote_cooldown_seconds`:
  - [x] `max_votes_per_user=1`: cooldown usa `max(votes.created_at, votes.updated_at)` do voto vigente
  - [x] `max_votes_per_user>1`: cooldown usa `created_at` do último voto
- [x] Retornar 429 com `remaining_seconds`

**Aceite:** mudar voto consome cooldown.

---

## API-5 — Identidade canônica: tudo por `participant_id`
- [x] Busca do voto vigente por `(poll_id, participant_id)`
- [x] Contagem/limite por `(poll_id, participant_id)`
- [x] Cooldown por `(poll_id, participant_id)`
- [x] `user_hash` fica como campo auxiliar

**Aceite:** pronto para biometria (participant = pessoa).

---

## API-6 — Implementar `max_votes_per_user = 1` (voto único editável + auditável)
- [x] Buscar voto vigente:
  - [x] se não existir: criar `votes` e filhas
  - [x] se existir: atualizar o mesmo `vote_id`
- [x] Atualizar sempre `votes.updated_at = now()`
- [x] Nunca permitir “limpar” (sempre termina com voto válido)

**Aceite:** não existe mais delete de votes para “atualizar” voto.

---

## API-7 — `vote_events` (somente `max_votes_per_user=1`)
- [x] Em criação: `event_type='created'`, before null, after snapshot
- [x] Em update: `event_type='updated'`, before snapshot, after snapshot

Snapshots:
- [x] single: `{ voting_type:'single', option_id }`
- [x] ranking: `{ voting_type:'ranking', option_ids:[...] }`
- [x] multiple: `{ voting_type:'multiple', option_ids:[...] }`

**Aceite:** trilha auditável completa do voto único.

---

## API-8 — Implementar `max_votes_per_user > 1` (Big Brother)
- [x] Contar votos existentes; bloquear se `>= max_votes_per_user`
- [x] Inserir novo `votes` e filhas
- [x] Permitir votar “igual” várias vezes (repetição entre votos)

**Aceite:** limite é respeitado; repetição de votos iguais é permitida.

---

# Fase 4 — Verificação final (testes manuais/checks)

## Casos para testar (mínimo)
### Poll single
- [ ] Criar voto (max=1)
- [ ] Mudar voto (max=1) → cria `vote_events.updated`
- [ ] Tentar mudar antes do cooldown → 429
- [ ] Big Brother (max>1): votar várias vezes igual → múltiplas linhas em `votes`

### Poll ranking
- [ ] Criar ranking com 3 opções
- [ ] Mudar ordem → `vote_events.updated`
- [ ] Enviar duplicatas em `option_ids` → 400
- [ ] Cooldown bloqueia mudança rápida

### Poll multiple
- [ ] Selecionar 1 opção
- [ ] Selecionar várias opções
- [ ] Enviar duplicadas (ex.: [A,A,B]) → dedup, grava [A,B]
- [ ] Se `max_options_per_vote` definido: bloquear excedente
- [ ] Se `max_options_per_vote` NULL: permitir até todas
- [ ] Big Brother: repetir mesmo conjunto várias vezes permitido

---

# Fase 5 — Backlog recomendado (endurecimento transacional)
## RPC `cast_vote(...)` (Supabase)
- [ ] Implementar RPC para atomicidade e concorrência (evitar estado parcial em delete+insert)
- [ ] Endpoint vira controller chamando `.rpc()`

---

## Apêndice — SQLs de verificação (rodar agora e colar resultados)

> Rode no Supabase SQL Editor e cole os outputs para checarmos “desde a primeira tabela”.

### A) Verificar valores e NULLs em `polls`
```sql
select
  voting_type,
  count(*) as polls,
  sum(case when max_votes_per_user is null then 1 else 0 end) as max_votes_per_user_null,
  sum(case when max_options_per_vote is null then 1 else 0 end) as max_options_per_vote_null,
  sum(case when vote_cooldown_seconds is null then 1 else 0 end) as cooldown_null
from polls
group by voting_type
order by voting_type;
```

### B) Checar se existe FK de `votes.participant_id` (importante!)
```sql
select
  tc.constraint_name,
  tc.constraint_type,
  kcu.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
  and kcu.table_name = 'votes'
order by tc.constraint_name;
```

### C) Checar se `vote_options.id` tem default (como vocês geram o UUID?)
```sql
select
  column_default
from information_schema.columns
where table_schema='public'
  and table_name='vote_options'
  and column_name='id';
```

### D) Duplicatas atuais em `vote_rankings` (para validar necessidade de limpeza antes do UNIQUE)
```sql
-- duplicata de option_id no mesmo vote_id
select vote_id, option_id, count(*) as cnt
from vote_rankings
group by vote_id, option_id
having count(*) > 1
order by cnt desc;

-- duplicata de ranking no mesmo vote_id
select vote_id, ranking, count(*) as cnt
from vote_rankings
group by vote_id, ranking
having count(*) > 1
order by cnt desc;
```

### E) Índices atuais em `votes` (performance)
```sql
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('votes','vote_rankings','vote_options')
order by tablename, indexname;
```

---
