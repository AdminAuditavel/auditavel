# Checklist — Implementação de Votos (single/ranking/multiple) + Auditabilidade (voto único)

Data: 2025-12-18  
Repo: `AdminAuditavel/Auditavel`

## Objetivo
Implementar e refatorar `/app/api/vote/route.ts` para:
- Decidir tipo de voto por `polls.voting_type` (`single`, `ranking`, `multiple`)
- Usar `participant_id` como identidade canônica para regras (cooldown, limite, voto vigente)
- Usar `polls.max_votes_per_user` como regra principal:
  - `= 1`: voto único editável + auditável (before/after em `vote_events`)
  - `> 1`: Big Brother (cada voto é novo; sem `vote_events`)
- Aplicar cooldown também para mudanças no voto único (baseado em `votes.updated_at`)
- Manter “gancho” para biometria (sem definir schema agora): se exigir biometria no futuro, retornar 403 e não gravar nada

---

## T0 — Definir `effective_max_votes_per_user` (compatível com polls antigas)
- [ ] No fetch da poll, incluir `max_votes_per_user`
- [ ] Calcular `effective_max_votes_per_user`:
  - [ ] Se `max_votes_per_user != null`, usar ele
  - [ ] Se `max_votes_per_user == null`, fallback:
    - [ ] `allow_multiple=false` ⇒ `1`
    - [ ] `allow_multiple=true` ⇒ definir default temporário (ex.: `2`) **ou** bloquear/configurar no admin
- [ ] Logar quando entrar em fallback (para corrigir dados)

**Aceite:** endpoint funciona mesmo com `max_votes_per_user` nulo.

---

## T1 — Refatorar decisão do tipo de voto por `poll.voting_type` (Forma A)
- [ ] Remover heurística “se tem option_ids então é ranking”
- [ ] Implementar switch:
  - [ ] `single` exige `option_id`
  - [ ] `ranking` exige `option_ids[]`
  - [ ] `multiple` exige `option_ids[]`

**Aceite:** `option_ids` funciona para ranking e multiple sem conflito.

---

## T2 — Validações por tipo (inclui dedup, limite e pertencimento)
### Validações comuns
- [ ] Validar `poll_id`, `participant_id`, `user_hash` presentes
- [ ] Validar que todas as opções pertencem à poll (`poll_options.poll_id = poll_id`)
  - [ ] Se não, retornar 400 `invalid_option_for_poll`

### Single
- [ ] `option_id` obrigatório

### Ranking
- [ ] `option_ids` obrigatório e `length >= 1`
- [ ] Rejeitar duplicatas (400 `invalid_ranking_duplicate_option`)
- [ ] Qualquer ordem é aceita; gravar `ranking=idx+1`

### Multiple
- [ ] `option_ids` obrigatório e `length >= 1`
- [ ] Deduplicar `option_ids`
- [ ] Se `poll.max_options_per_vote != null`: validar `len(dedup) <= max_options_per_vote`
- [ ] Se `poll.max_options_per_vote == null`: **sem limite** (pode escolher até todas)

**Aceite:** não é possível votar em opção de outra poll; ranking não aceita duplicatas; multiple deduplica.

---

## T3 — Gancho de biometria (`assertParticipantEligible`)
- [ ] Criar função `assertParticipantEligible(poll, participant_id, user_hash, req)`
- [ ] Chamá-la antes de qualquer escrita
- [ ] Por enquanto sempre permite (return OK)
- [ ] Semântica futura: se poll exigir biometria e não tiver, retornar 403 e não gravar nada

**Aceite:** existe um único ponto para plugar biometria sem refatorar o resto.

---

## T4 — Mover sync do participant para depois do gate e validações
- [ ] Mover bloco de sync em `participants` para depois:
  - [ ] poll open check
  - [ ] `assertParticipantEligible`
  - [ ] validação do payload
  - [ ] cooldown (somente leitura)
- [ ] Manter “falha no sync não bloqueia voto”

**Aceite:** requests rejeitadas não criam participant “à toa”.

---

## T5 — Migrar regras para `participant_id` (não `user_hash`)
- [ ] Cooldown por `(poll_id, participant_id)`
- [ ] Busca de voto vigente (max=1) por `(poll_id, participant_id)`
- [ ] Contagem/limite (max>1) por `(poll_id, participant_id)`
- [ ] `user_hash` permanece gravado em `votes`

**Aceite:** mudar `user_hash` não muda a identidade do votante; `participant_id` manda.

---

## T6 — Cooldown também para mudanças (base `votes.updated_at`)
- [ ] Se `vote_cooldown_seconds > 0`, calcular:
  - [ ] `max_votes_per_user=1`: `last_action_at = max(votes.created_at, votes.updated_at)` do voto vigente
  - [ ] `max_votes_per_user>1`: `last_action_at = last votes.created_at`
- [ ] Retornar 429 `cooldown_active` com `remaining_seconds`
- [ ] Garantir `votes.updated_at = now()` em toda mudança (inclusive ranking/multiple)

**Aceite:** após mudar voto, não dá para mudar de novo até passar o cooldown.

---

## T7 — Fluxo `max_votes_per_user = 1` (voto único editável) sem deletar `votes`
- [ ] Buscar voto vigente por `(poll_id, participant_id)`
  - [ ] Se não existe: criar `votes` + filhas
  - [ ] Se existe: atualizar o mesmo `vote_id`
- [ ] Single: atualizar `votes.option_id`
- [ ] Ranking: atualizar `votes.updated_at`; substituir `vote_rankings` (delete+insert)
- [ ] Multiple: atualizar `votes.updated_at`; substituir `vote_options` (delete+insert)
- [ ] Nunca permitir “limpar”: ranking/multiple sempre com ≥1 opção

**Aceite:** não há `DELETE FROM votes` para atualizar voto no modo max=1.

---

## T8 — Auditoria `vote_events` (somente max=1)
- [ ] Criar tabela `vote_events` (append-only) com:
  - [ ] `poll_id`, `vote_id`, `participant_id`
  - [ ] `event_type` = `created`/`updated`
  - [ ] `before_state`/`after_state` (JSON)
  - [ ] `created_at`
- [ ] No modo max=1:
  - [ ] No primeiro voto: registrar `created` (before null)
  - [ ] Em mudanças: registrar `updated` (before/after)
- [ ] Snapshot por tipo:
  - [ ] single: `{ voting_type:'single', option_id }`
  - [ ] ranking: `{ voting_type:'ranking', option_ids:[...] }`
  - [ ] multiple: `{ voting_type:'multiple', option_ids:[...] }`

**Aceite:** cada alteração gera exatamente 1 evento com before/after coerentes.

---

## T9 — Fluxo `max_votes_per_user > 1` (Big Brother)
- [ ] Contar votos existentes por `(poll_id, participant_id)`
- [ ] Se `count >= max_votes_per_user`: retornar erro (sugestão: 403 `vote_limit_reached`)
- [ ] Inserir novo `votes` e filhas conforme tipo
- [ ] Não registrar `vote_events`

**Aceite:** não ultrapassa limite; votos repetidos são permitidos (entre votos diferentes).

---

## T10 — Constraints de integridade em `vote_rankings`
- [ ] UNIQUE `(vote_id, option_id)`
- [ ] UNIQUE `(vote_id, ranking)`

**Aceite:** ranking não permite duplicatas nem posições repetidas.

---

## T11 (Backlog recomendado) — RPC `cast_vote` para atomicidade
- [ ] Criar RPC transacional no Supabase para:
  - [ ] validações
  - [ ] cooldown/limite
  - [ ] update/insert + delete+insert de filhas em transação
  - [ ] `vote_events` quando `max_votes_per_user=1`
- [ ] Reduzir `/api/vote` para controller que chama `.rpc()`

**Aceite:** sem risco de estado parcial (vote criado sem filhas, etc.).

---

## Notas importantes
- Para `multiple`, se `max_options_per_vote` for NULL ⇒ sem limite (até todas as opções).
- Para `ranking`, qualquer ordem é aceita, mas não pode ter duplicatas.
- Cooldown aplica para criação e alteração (modo voto único usa updated_at).