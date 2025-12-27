# 📊 Regras de Contagem — Auditável

## Objetivo

Este documento descreve **como os resultados são calculados** no Auditável, garantindo coerência entre frontend, backend e banco de dados.

Documento **interno** e **técnico**.

---

## Conceitos fundamentais

- **Participante**: identidade lógica (`participant_id`)
- **Participação**: submissão de voto (`votes.id`)
- **Opção marcada**: vínculo em `vote_options` ou `vote_rankings`
- **Resultado**: agregação determinística sobre o banco

---

## Regras globais

1. O banco é a fonte da verdade.
2. Nenhum cálculo depende do frontend.
3. Resultados são sempre **reprodutíveis** a partir das tabelas.

---

## SINGLE (voto único)

### Fonte de dados
- `votes (poll_id, option_id, participant_id)`

### Contagem
- Cada linha = 1 voto
- Apenas **um voto vigente** por `(poll_id, participant_id)`

### Participantes
```text
COUNT(DISTINCT user_hash)
```

### Percentual
```text
votos_da_opção / total_de_votos
```

---

## MULTIPLE (múltipla escolha)

### Fonte de dados
- `votes`
- `vote_options (vote_id, option_id)`

### Contagem
- Cada marcação conta 1
- Um participante pode marcar várias opções

### Participações
```text
COUNT(votes.id)
```

### Participantes
```text
COUNT(DISTINCT user_hash)
```

### Percentual
```text
marcas_da_opção / total_de_participações
```

---

## RANKING

### Fonte de dados
- `votes`
- `vote_rankings (vote_id, option_id, ranking)`

### Pontuação
Modelo Borda-like:

```text
score = Σ (N - ranking + 1)
```

Onde:
- N = número total de opções

### Participações
- Cada `vote_id` = 1 ranking

### Participantes
```text
COUNT(DISTINCT user_hash)
```

---

## Resultados parciais vs finais

| Status | show_partial_results | Visibilidade |
|------|---------------------|-------------|
| open | false | ❌ oculto |
| open | true | ✅ parcial |
| paused | true | ✅ parcial |
| closed | qualquer | ✅ final |

---

## Garantias

- Nenhuma dupla contagem
- Nenhuma inferência heurística
- Nenhum cálculo ambíguo

---

Documento interno — Auditável
