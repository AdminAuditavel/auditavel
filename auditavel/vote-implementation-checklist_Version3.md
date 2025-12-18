# Plano + Checklist completo (DB primeiro) — Votos `single/ranking/multiple` + auditabilidade (voto único)

Data: 2025-12-18  
Repo: `AdminAuditavel/Auditavel`  
Local do arquivo: **raiz** do repositório

---

## 0) Status geral (com base nas verificações A–E)

### ✅ Confirmado OK
- `polls.max_votes_per_user` **não é NULL** em nenhuma poll (0 NULL) → regra de limite está definida
- `polls.vote_cooldown_seconds` **não é NULL** em nenhuma poll (0 NULL) → cooldown sempre configurado
- Não há duplicatas atuais em `vote_rankings` (D sem linhas) → seguro adicionar UNIQUE
- Índice `votes(poll_id, participant_id)` já existe → base ótima para regra por participante

### ⚠️ Lacunas/pendências identificadas agora
- `votes.participant_id` **não possui FK** para `participants.id` (query B mostrou só FKs de poll_id e option_id)
- `vote_options.id` **não tem default** (`column_default = NULL`) → inserts precisam fornecer UUID
- `vote_rankings` ainda **não tem índices/uniques** úteis além da PK → adicionar UNIQUEs
- `vote_events` ainda **não existe** → necessário para auditoria `max_votes_per_user=1`

### 📌 Decisões fechadas (confirmadas no thread)
- Cooldown em voto único (`max_votes_per_user=1`) será baseado em **`votes.updated_at`** (e `created_at` no primeiro voto) ✅
- `multiple` com `polls.max_options_per_vote = NULL` ⇒ **sem limite** (pode escolher 1..todas as opções) ✅
- `ranking`: qualquer ordem é válida, mas **não pode ter duplicatas** ✅
- `multiple`: duplicatas no payload serão **deduplicadas** ✅
- Big Brother (`max_votes_per_user > 1`): pode repetir voto “igual” quantas vezes permitir o limite ✅
- Biometria: no futuro “ou biometria ou nada”, sem gravar nada; hoje só gancho ✅

---

## 1) Schema atual (baseline) — tabelas existentes
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

---

# Fase 1 — Verificação do banco (tabela por tabela) + ajustes necessários

## 1.1 `polls` (configuração da poll — peça central)
### O que já existe (confirmado)
- `max_votes_per_user integer` (**todas preenchidas**) ✅
- `vote_cooldown_seconds integer` (**todas preenchidas**) ✅
- `voting_type text` (há `single` e `ranking`; **não há `multiple` ainda**) ✅
- `max_options_per_vote integer` (todas NULL hoje; ok para `single`/`ranking`) ✅

### Checagens (concluídas)
- [x] Checar NULLs de `max_votes_per_user` → **0** ✅
- [x] Checar NULLs de `vote_cooldown_seconds` → **0** ✅
- [x] Verificar presença de `multiple` → **0 polls multiple** (por enquanto) ✅

### Ações (recomendadas, não bloqueantes agora)
- [ ] (Opcional) Criar/editar uma poll de teste com `voting_type='multiple'` para validar o endpoint após implementação

---

## 1.2 `poll_options` (opções válidas da poll)
### Regra nova
- Validar que toda opção enviada pertence à poll (`poll_options.poll_id = poll_id`)

### Ações
- [ ] Garantir validação no endpoint (ver API-3)

---

## 1.3 `votes` (voto “pai”)
### O que está OK
- FKs existentes:
  - [x] `votes.poll_id -> polls.id` ✅
  - [x] `votes.option_id -> poll_options.id` ✅

### Pendência crítica
- [ ] **Adicionar FK** `votes.participant_id -> participants.id` ⚠️ (recomendado fortemente)

### Índices (verificado)
- [x] `idx_votes_poll_participant` em `(poll_id, participant_id)` ✅
- [x] índices por `created_at` e por `user_hash` existem ✅

### Ação opcional (nice-to-have)
- [ ] (Opcional) índice `votes(poll_id, participant_id, updated_at desc)` para cooldown/telemetria (não obrigatório se houver só 1 voto vigente no max=1)

---

## 1.4 `vote_rankings` (filhas do ranking)
### Situação atual
- [x] Não há duplicatas existentes hoje (D sem rows) ✅

### Pendências (obrigatórias para robustez)
- [ ] Adicionar UNIQUE `(vote_id, option_id)` ⚠️
- [ ] Adicionar UNIQUE `(vote_id, ranking)` ⚠️

---

## 1.5 `vote_options` (filhas do multiple)
### Situação atual
- [x] UNIQUE `(vote_id, option_id)` existe ✅
- [x] Índices em `vote_id` e `option_id` existem ✅

### Pendência prática (obrigatória para inserts)
- [ ] `vote_options.id` não tem default (`NULL`) ⚠️
  - Estratégia **agora**: gerar UUID no app a cada insert em `vote_options` (ou alterar default via migração)

---

## 1.6 `participants` (identidade canônica)
### Regra nova
- `participant_id` é a identidade canônica no voto (limite/cooldown/voto vigente)

### Ação
- [ ] Manter sync (create/update last_seen_at) no endpoint **após** validações e gate (ver API-4)

---

## 1.7 `participant_profile` e `participant_attributes`
### Observação
- Não bloqueiam votação, mas:
  - [ ] (Opcional) revisar UNIQUE esperado de `participant_attributes` (ideal: UNIQUE(participant_id, poll_id))

---

## 1.8 `face_hashes` (biometria — caminho aberto)
### Estado
- Existe `user_hash` UNIQUE ✅
### Ação
- [ ] Não acoplar agora; somente manter gate `assertParticipantEligible`

---

## 1.9 `audit_logs`, `admin_audit_logs`, `merkle_snapshots`
### Estado
- Podem coexistir com `vote_events` ✅
### Ação
- [ ] Nada obrigatório agora

---

# Fase 2 — Mudanças mínimas no banco (necessárias para o requisito)

## DB-A — Criar `vote_events` (obrigatório para auditoria do voto único)
- [ ] Criar tabela `vote_events` com:
  - [ ] `id uuid pk`
  - [ ] `poll_id uuid fk polls(id)`
  - [ ] `vote_id uuid fk votes(id)`
  - [ ] `participant_id uuid fk participants(id)`
  - [ ] `event_type text` (`created` | `updated`)
  - [ ] `before_state jsonb null`
  - [ ] `after_state jsonb not null`
  - [ ] `created_at timestamptz default now()`
- [ ] Índices recomendados:
  - [ ] `(poll_id, participant_id, created_at desc)`
  - [ ] `(vote_id, created_at desc)`

**Aceite:** toda mudança em voto único fica auditável com before/after.

---

## DB-B — Constraints para ranking (obrigatório)
- [ ] UNIQUE `(vote_id, option_id)` em `vote_rankings`
- [ ] UNIQUE `(vote_id, ranking)` em `vote_rankings`

**Aceite:** ranking consistente mesmo com bugs no client.

---

## DB-C — Integridade do participant no voto (recomendado fortemente)
- [ ] Adicionar FK `votes.participant_id -> participants.id`

**Aceite:** nenhum voto fica com participant inexistente.

---

# Fase 3 — API `/api/vote` (refatoração com regras completas)

## API-1 — Ordem correta do fluxo (sem efeitos colaterais)
- [ ] Parse body
- [ ] Buscar poll (status, voting_type, max_votes_per_user, vote_cooldown_seconds, max_options_per_vote, janelas)
- [ ] Validar poll aberta/janela
- [ ] `assertParticipantEligible(...)` (gancho biometria) **ANTES** de escrever qualquer coisa
- [ ] Validar payload por tipo (single/ranking/multiple)
- [ ] Validar pertencimento das opções à poll
- [ ] Aplicar cooldown (somente leitura)
- [ ] Sync participant (criar/atualizar last_seen_at)
- [ ] Executar cast vote (max=1 ou max>1)
- [ ] Retornar resposta

**Aceite:** se não puder votar, não grava nem participant nem voto.

---

## API-2 — Decisão do tipo por `poll.voting_type` (Forma A)
- [ ] `single`: usa `option_id`
- [ ] `ranking`: usa `option_ids` ordenado
- [ ] `multiple`: usa `option_ids` como conjunto

**Aceite:** sem heurística por payload.

---

## API-3 — Validações por tipo (conforme decisões)
### Single
- [ ] `option_id` obrigatório

### Ranking
- [ ] `option_ids.length >= 1`
- [ ] qualquer ordem aceita
- [ ] duplicatas: rejeitar (400 `invalid_ranking_duplicate_option`)
- [ ] gravar ranking `idx+1`

### Multiple
- [ ] `option_ids.length >= 1`
- [ ] deduplicar
- [ ] se `max_options_per_vote != NULL` limitar
- [ ] se `max_options_per_vote == NULL` sem limite (até todas)

### Pertencimento à poll
- [ ] Validar todas as `option_id(s)` em `poll_options` com `poll_id = poll_id`

**Aceite:** dados coerentes e opções válidas.

---

## API-4 — Cooldown baseado em `votes.updated_at` (confirmado)
- [ ] Se `vote_cooldown_seconds`:
  - [ ] `max_votes_per_user=1`: cooldown usa `max(votes.created_at, votes.updated_at)` do voto vigente
  - [ ] `max_votes_per_user>1`: cooldown usa `created_at` do último voto (ORDER BY created_at desc LIMIT 1)
- [ ] Retornar 429 `cooldown_active` + `remaining_seconds`

**Aceite:** mudar voto consome cooldown.

---

## API-5 — Identidade canônica: tudo por `participant_id`
- [ ] Busca do voto vigente por `(poll_id, participant_id)`
- [ ] Contagem/limite por `(poll_id, participant_id)`
- [ ] Cooldown por `(poll_id, participant_id)`
- [ ] `user_hash` permanece no `votes`

**Aceite:** pronto para biometria.

---

## API-6 — Implementar `max_votes_per_user = 1` (voto único editável + auditável)
- [ ] Buscar voto vigente por `(poll_id, participant_id)`
  - [ ] se não existe: criar `votes` + filhas
  - [ ] se existe: atualizar o mesmo `vote_id` (nunca deletar `votes`)
- [ ] Atualizar sempre `votes.updated_at = now()`
- [ ] Single: `UPDATE votes.option_id`
- [ ] Ranking: substituir `vote_rankings` (delete+insert) + atualizar vote.updated_at
- [ ] Multiple: substituir `vote_options` (delete+insert) + atualizar vote.updated_at
  - [ ] Gerar UUID para cada linha de `vote_options` (porque `id` não tem default)

**Aceite:** estado atual sempre existe e é o que vale.

---

## API-7 — Registrar `vote_events` (somente `max_votes_per_user=1`)
- [ ] Em criação: `created` (before null, after snapshot)
- [ ] Em update: `updated` (before snapshot, after snapshot)

Snapshots:
- [ ] single: `{ voting_type:'single', option_id }`
- [ ] ranking: `{ voting_type:'ranking', option_ids:[...] }`
- [ ] multiple: `{ voting_type:'multiple', option_ids:[...] }`

**Aceite:** trilha auditável completa do voto único.

---

## API-8 — Implementar `max_votes_per_user > 1` (Big Brother)
- [ ] Contar votos existentes por `(poll_id, participant_id)`
- [ ] Se `count >= max_votes_per_user`: retornar 403 `vote_limit_reached`
- [ ] Inserir novo `votes` e filhas conforme tipo
- [ ] Permitir votos iguais repetidos entre votos diferentes
- [ ] Não registrar `vote_events`

**Aceite:** limite e repetição funcionam.

---

# Fase 4 — Testes/checks manuais (mínimo)

## Single
- [ ] Criar voto (max=1) → `vote_events.created`
- [ ] Mudar voto (max=1) → `vote_events.updated`
- [ ] Mudar antes do cooldown → 429
- [ ] Big Brother (max>1): votar várias vezes igual → múltiplas linhas em `votes`

## Ranking
- [ ] Criar ranking com 3 opções → `vote_events.created`
- [ ] Mudar ordem → `vote_events.updated`
- [ ] Enviar duplicatas → 400
- [ ] Cooldown bloqueia mudança rápida → 429

## Multiple (quando existir poll multiple)
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

## Apêndice — Resultados das verificações (A–E) colados no thread
- A (polls por voting_type): `max_votes_per_user_null=0`, `cooldown_null=0`, sem `multiple`
- B (FK em votes): existem FKs `poll_id` e `option_id`, **falta participant_id**
- C (vote_options.id default): `NULL` (app precisa gerar UUID ou migrar default)
- D (duplicatas vote_rankings): sem linhas
- E (índices): `votes(poll_id, participant_id)` existe; `vote_options(vote_id)` existe
