# Documentação Interna — Auditabilidade e Rastreabilidade de Votos

## Objetivo
Este documento descreve como a plataforma **Auditável** garante rastreabilidade, integridade e transparência
do processo de votação, permitindo auditoria completa sem comprometer a privacidade dos participantes.

---

## Princípios de Auditabilidade

1. **Imutabilidade lógica**
   - Nenhum voto é sobrescrito sem registro.
   - Toda alteração gera um evento auditável.

2. **Rastreabilidade completa**
   - Cada voto possui histórico completo de criação e atualização.
   - Estados anterior e posterior são preservados.

3. **Separação de identidade**
   - `participant_id` identifica o navegador/dispositivo.
   - `user_hash` é usado apenas para métricas agregadas.
   - Regras de voto nunca dependem de `user_hash`.

---

## Tabelas Envolvidas

### votes
Tabela que representa o voto vigente.

Campos relevantes:
- `id`
- `poll_id`
- `participant_id`
- `user_hash`
- `option_id` (single)
- `created_at`
- `updated_at`

Observações:
- Para `max_votes_per_user = 1`, existe **no máximo um voto vigente** por `(poll_id, participant_id)`.
- Em alterações, o mesmo `vote_id` é reutilizado.

---

### vote_options
Usada apenas para `voting_type = multiple`.

Campos:
- `vote_id`
- `option_id`

Regras:
- Sempre deletada e recriada em atualizações.
- Nunca existem registros órfãos.

---

### vote_rankings
Usada apenas para `voting_type = ranking`.

Campos:
- `id`
- `vote_id`
- `option_id`
- `ranking`

Regras:
- `ranking` inicia em 1.
- Não permite opções duplicadas por voto.
- Atualizações removem e recriam os rankings.

---

### vote_events
Coração da auditabilidade.

Campos:
- `id`
- `poll_id`
- `vote_id`
- `participant_id`
- `event_type` (`created` | `updated`)
- `before_state` (JSONB)
- `after_state` (JSONB)
- `created_at`

---

## Estados Auditáveis (Snapshots)

### Single
```json
{
  "voting_type": "single",
  "option_id": "uuid"
}
```

### Multiple
```json
{
  "voting_type": "multiple",
  "option_ids": ["uuid1", "uuid2"]
}
```

### Ranking
```json
{
  "voting_type": "ranking",
  "option_ids": ["uuid1", "uuid2", "uuid3"]
}
```

---

## Fluxo de Registro de Eventos

### Criação de voto
1. Voto é persistido em `votes`
2. Snapshot `after_state` é criado
3. Evento `created` é inserido em `vote_events`

### Atualização de voto
1. Snapshot do estado atual (`before_state`)
2. Alteração no voto
3. Snapshot do novo estado (`after_state`)
4. Evento `updated` é inserido

Nenhuma alteração ocorre sem evento correspondente.

---

## Cooldown e Auditabilidade

- Cooldown é calculado com base em:
  ```sql
  GREATEST(created_at, COALESCE(updated_at, created_at))
  ```
- Garante que:
  - Alterações reiniciam o cooldown
  - Não há inconsistência entre criação e edição

---

## Garantias Fortes

- Não existem votos sem participante.
- Não existem eventos sem voto.
- Não existem resultados calculados sem base auditável.
- Todo resultado pode ser reconstruído apenas a partir do banco.

---

## Consultas de Auditoria (Exemplos)

### Histórico completo de um voto
```sql
SELECT *
FROM vote_events
WHERE vote_id = :vote_id
ORDER BY created_at;
```

### Reconstrução do estado final
```sql
SELECT after_state
FROM vote_events
WHERE vote_id = :vote_id
ORDER BY created_at DESC
LIMIT 1;
```

---

## Conclusão

O modelo adotado permite:
- Auditoria independente
- Verificação forense de votos
- Transparência total do processo
- Evolução futura (blockchain, assinaturas, etc.)

Este documento é base para auditorias técnicas e institucionais.
