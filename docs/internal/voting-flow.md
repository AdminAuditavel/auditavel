# Auditável — Documentação Interna: Fluxo de Votação (V1)

> **Escopo**: documentação interna (engenharia). Descreve o comportamento esperado do fluxo de voto, regras de negócio, identidade do participante, cooldown, persistência no Supabase e auditoria via `vote_events`.  
> **Versão**: alinhada ao estado atual do código e testes relatados em **27/12/2025**.

---

## 1. Visão geral

O fluxo de votação do Auditável foi desenhado para atender dois modos principais:

1. **Voto único editável (default)**  
   - `allow_multiple = false`  ⇒ `max_votes_per_user` efetivo = **1**  
   - O usuário pode **alterar o voto**; **o último voto vale** (estado atual em `votes`).
   - A auditoria registra as mudanças em `vote_events` com `before_state` e `after_state`.

2. **Múltiplas participações (big brother)**  
   - `allow_multiple = true` e `max_votes_per_user > 1`  
   - O usuário pode **votar mais de uma vez** até atingir `max_votes_per_user`.
   - Cada participação cria um novo registro em `votes` (não é “editável”; é “acumulativo”).

Além disso, o sistema suporta três tipos de votação em `polls.voting_type`:

- `single`  — 1 opção por participação
- `multiple` — N opções por participação (limitado por `max_options_per_vote`)
- `ranking` — ordenação completa das opções (uma lista, sem duplicatas)

---

## 2. Identidade do participante

### 2.1 `participant_id`
- Persistido no navegador via `localStorage` sob chave `auditavel_participant_id`.
- **Um navegador** (mesmo perfil) deve gerar **um único `participant_id`** estável.
- Fonte: `lib/participant.ts` via `getOrCreateParticipantId()`.

**Observação operacional**: caso haja múltiplos participantes no banco, as causas típicas são:
- limpeza de storage/localStorage;
- uso de navegadores/perfis diferentes;
- deploy com mudança de domínio/ambiente (chaves diferentes);
- execução em SSR chamando função que retornava string vazia (corrigido).

### 2.2 `user_hash`
- Persistido em `localStorage` sob chave `auditavel_uid` (UUID).
- Hoje é usado como:
  - suporte a métricas (participantes únicos por `distinct user_hash`), e
  - exibição de participantes em resultados (telas consultam `votes.user_hash`).
- **Regra**: regras de cooldown/limite/voto vigente devem ser por `(poll_id, participant_id)`.

### 2.3 Garantias no ponto de uso (frontend)
Na página de votação (`app/poll/[id]/page.tsx`), antes de enviar voto:
- resolve `participant_id` e `user_hash`;
- **não envia** se qualquer um estiver ausente;
- mantém state consistente caso ainda não tenha sido setado.

---

## 3. Momento em que `participants` é gravado no BD

O participante é gravado **no primeiro POST de voto**.

Fluxo no backend (`app/api/vote/route.ts`):
1. valida payload mínimo: `poll_id`, `participant_id`, `user_hash`;
2. aplica regras de cooldown/limite;
3. chama `syncParticipant(participant_id)`:
   - se não existe: **INSERT** em `participants` com `id = participant_id`;
   - se existe: **UPDATE** em `participants.last_seen_at`.

Portanto:
- o ato de “abrir a página” **não** cria participante;
- a primeira tentativa efetiva de voto (passando validações) cria/atualiza participante.

---

## 4. Endpoint de voto

### 4.1 Rota
- `POST /api/vote` (Next.js route handler)

### 4.2 Payload esperado
Campos comuns:
- `poll_id` (uuid)
- `participant_id` (uuid)
- `user_hash` (text/uuid string)

Por tipo:
- `single`: `option_id` (uuid)
- `multiple`: `option_ids` (uuid[])
- `ranking`: `option_ids` (uuid[]) — lista completa/ordem desejada, sem duplicatas

### 4.3 Respostas comuns
- `200` com `{ success: true, updated: boolean }`
- `400` para payload inválido
- `403` quando:
  - poll não está aberta (`poll_not_open`)
  - limite de participações atingido (`vote_limit_reached`)
- `404` `poll_not_found`
- `429` `cooldown_active` com `remaining_seconds`

---

## 5. Regras de negócio

### 5.1 Abertura da poll
`poll.status` deve ser `open`. Caso contrário:
- retorna `403 poll_not_open`.

### 5.2 Canonização `allow_multiple` vs `max_votes_per_user`
No backend:
- se `allow_multiple = false` ⇒ `effectiveMaxVotes = 1` (voto único editável)
- se `allow_multiple = true` ⇒ `effectiveMaxVotes = max(1, max_votes_per_user)`

### 5.3 Cooldown (criar e alterar)
- Controla o intervalo mínimo entre “atividades de voto” do mesmo participante na mesma poll.
- Chave lógica: `(poll_id, participant_id)`.
- Implementação:
  - busca `last_epoch` calculado no DB como `extract(epoch from greatest(created_at, coalesce(updated_at, created_at)))`
  - se `now < last_activity + cooldownSeconds` ⇒ `429 cooldown_active`

Observações:
- protege contra clock skew (timestamp futuro) clampando no `now`.
- cooldown vale tanto para “criação” quanto para “alteração”.

### 5.4 Validação de opções
- Sempre valida se as opções pertencem à poll via consulta em `poll_options`:
  - `assertOptionsBelongToPoll(poll_id, ids[])`
- Se houver opção inválida ⇒ `400 invalid_option_for_poll`.

### 5.5 `multiple`: limite de opções por participação
- `poll.max_options_per_vote` define o limite máximo de opções selecionadas.
- Se `dedup.length > max_options_per_vote` ⇒ `400 max_options_exceeded`.

No frontend:
- ao atingir o limite, opções não selecionadas são bloqueadas até desmarcar alguma.

### 5.6 `ranking`: sem duplicatas
- se `option_ids` contém duplicata ⇒ `400 invalid_ranking_duplicate_option`.

---

## 6. Persistência no banco

### 6.1 Tabelas envolvidas (resumo)
- `polls` — metadados da enquete
- `poll_options` — opções da enquete
- `participants` — identidade persistida (1 por navegador, idealmente)
- `votes` — registro principal por participação
- `vote_options` — marcações para `multiple`
- `vote_rankings` — posições para `ranking`
- `vote_events` — trilha auditável (created/updated)

### 6.2 FKs relevantes (confirmadas)
- `votes.participant_id` → `participants.id`
- `votes.option_id` → `poll_options.id` (quando `single`)
- `votes.poll_id` → `polls.id`

### 6.3 Comportamento por modo

#### A) Voto único editável (`effectiveMaxVotes = 1`)
- **Existe voto?** (por `(poll_id, participant_id)`):
  - **não** ⇒ cria um `votes` novo
  - **sim** ⇒ atualiza o mesmo `votes.id` (alterando estado atual)
- `single`:
  - atualiza `votes.option_id` e `votes.updated_at`
- `multiple`:
  - mantém um `votes` e regrava `vote_options` (delete + insert)
  - atualiza `votes.updated_at`
- `ranking`:
  - mantém um `votes` e regrava `vote_rankings` (delete + insert)
  - atualiza `votes.updated_at`

#### B) Múltiplas participações (`effectiveMaxVotes > 1`)
- Cada participação cria um novo `votes.id`.
- `single`: grava `votes.option_id`
- `multiple`: grava `votes` + `vote_options`
- `ranking`: grava `votes` + `vote_rankings`
- Quando `count(votes) >= effectiveMaxVotes` ⇒ `403 vote_limit_reached`

---

## 7. Auditoria (`vote_events`)

### 7.1 O que é registrado
No final do processamento (modo editável), o backend insere um evento em `vote_events` com:
- `event_type`: `created` ou `updated`
- `before_state`: snapshot do voto anterior (ou `null`)
- `after_state`: snapshot do voto vigente

Snapshots:
- `single`: `{ "voting_type":"single", "option_id":"..." }`
- `multiple`: `{ "voting_type":"multiple", "option_ids":[...] }` (ordenado)
- `ranking`: `{ "voting_type":"ranking", "option_ids":[...] }` (na ordem do ranking)

### 7.2 Expectativa de consistência
- O estado atual do voto deve ser obtido de `votes` + tabelas auxiliares (`vote_options` / `vote_rankings`).
- `vote_events` deve permitir reconstituição histórica (diferenças antes/depois).

---

## 8. Resultados (`app/results/[id]/page.tsx`)

### 8.1 Regra de exibição
Resultados são exibidos se:
- `status = closed` **ou**
- (`status` em `open|paused`) **e** `show_partial_results = true`

### 8.2 Contagem de participantes vs participações
- **Participações** = número de registros em `votes` (uma por participação).
- **Participantes** = `distinct user_hash` (na implementação atual da tela).

Regra do footer:
- se `effectiveMaxVotes > 1` ⇒ mostra **Participantes** e **Participações**
- senão ⇒ mostra apenas **Participantes**

**Nota técnica**: se o objetivo for medir “participantes únicos” com mais rigor, o ideal é considerar `(poll_id, participant_id)` (ou ainda um sistema de identidade autenticado). Como hoje o `user_hash` é localStorage, limpar storage cria uma nova identidade.

---

## 9. Padrões de erro e diagnóstico

### 9.1 `vote_rejected` + HTTP 500
Causas comuns:
- payload faltando `participant_id` ou `user_hash`
- regressão onde `getOrCreateParticipantId()` retornava `""` em SSR e o código enviava vazio
- erro de integridade (FK) se `participants` não existe e `syncParticipant` falhou
- exceção no handler (log em Vercel / server logs)

Mitigação aplicada:
- garantia no frontend: **não envia** sem `pid` e `uh`
- `syncParticipant` tenta inserir/atualizar e loga erros

---

## 10. Checklists rápidos (regressão)

### 10.1 Identidade
- [ ] `auditavel_participant_id` existe no localStorage e não muda entre recarregamentos
- [ ] `auditavel_uid` existe no localStorage e não muda entre recarregamentos
- [ ] abrir/fechar navegador mantém identidade no mesmo perfil

### 10.2 Voto único editável
- [ ] primeira participação cria `votes` com `created_at`
- [ ] alteração atualiza `votes.updated_at` e modifica `option_id`/opções auxiliares
- [ ] `vote_events` registra `created` e `updated` corretamente

### 10.3 Cooldown
- [ ] após votar, UI bloqueia e countdown aparece
- [ ] backend retorna `429 cooldown_active` se tentar antes do tempo
- [ ] após expirar, voto é aceito

### 10.4 Multiple com limite
- [ ] UI bloqueia após atingir `max_options_per_vote`
- [ ] backend retorna `max_options_exceeded` se tentar exceder

---

## 11. Próximos ajustes recomendados (não bloqueantes)

1. **Padronizar métrica de “participantes”**  
   - considerar migrar contagem para `(poll_id, participant_id)` em resultados.
2. **Centralizar identidade no `lib/participant.ts`**  
   - remover duplicações residuais (ex.: `VoteButton.tsx` ainda garantindo `auditavel_uid` inline).
3. **Adicionar logs estruturados** no `/api/vote` (correlation id) para facilitar debug de 500.

---

## Apêndice A — Funções utilitárias (frontend)

- `getOrCreateParticipantId()`  
  - nunca deve retornar string vazia no browser
- `getOrCreateUserHash()`  
  - encapsula a criação/recuperação de `auditavel_uid`

---

## Apêndice B — Glossário

- **Participação**: submissão de voto (um registro em `votes`).
- **Participante**: identidade local (um `participant_id` por navegador/perfil).
- **Voto vigente**: estado atual do voto quando `max_votes_per_user=1`.
- **Trilha auditável**: sequência de `vote_events` com before/after.
