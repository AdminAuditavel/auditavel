# Documentação Interna — Identidade, Participantes e Unicidade

## Objetivo
Este documento descreve como a plataforma **Auditável** lida com identidade de usuários,
garantindo **unicidade de participação**, **resistência a fraude básica** e **auditabilidade**,
sem coletar dados pessoais.

---

## Princípios Fundamentais

1. **Nenhuma identificação pessoal**
2. **Identidade local ao navegador**
3. **Regras sempre baseadas em `participant_id`**
4. **`user_hash` é auxiliar, nunca decisório**

---

## Conceitos

### participant_id
- UUID persistido em `localStorage`
- Representa **um navegador/dispositivo**
- Gerado uma única vez
- Enviado em toda requisição de voto

```ts
localStorage.setItem("auditavel_participant_id", uuid);
```

#### Uso
- Controle de voto único
- Cooldown
- Limite de participações
- Auditoria

---

### user_hash
- UUID auxiliar
- Persistido em `localStorage`
- Pode ser regenerado em casos extremos
- **Nunca usado para regras de votação**

#### Uso permitido
- Métricas agregadas
- Contagem de participantes
- Destaques e rankings públicos

---

## Por que separar participant_id e user_hash?

| Aspecto | participant_id | user_hash |
|------|---------------|----------|
| Regra de voto | ✅ | ❌ |
| Cooldown | ✅ | ❌ |
| Limite | ✅ | ❌ |
| Contagem pública | ❌ | ✅ |
| Reset possível | ❌ | ⚠️ |
| Risco de fraude | baixo | médio |

---

## Fluxo de Identidade

1. Usuário acessa o site
2. Frontend gera `participant_id` (se inexistente)
3. Frontend gera `user_hash` (se inexistente)
4. Ambos são enviados ao backend
5. Backend **nunca gera identidade**
6. Backend apenas valida presença

---

## Garantias de Unicidade

- Um navegador → um `participant_id`
- Um participante → uma participação vigente por enquete
- Alterações reutilizam o mesmo `vote_id`
- Não existe dupla contagem

---

## Cenários Esperados

### Atualização de código / deploy
- `participant_id` permanece
- `user_hash` permanece
- Nenhuma duplicação ocorre

### Limpeza de localStorage
- Novo `participant_id`
- Novo participante legítimo
- Sistema continua íntegro

---

## Limitações Conhecidas (aceitas)

- Não impede múltiplos navegadores
- Não impede modo anônimo
- Não substitui autenticação forte

Estas limitações são **explícitas e documentadas**.

---

## Segurança e Privacidade

- Nenhum IP armazenado
- Nenhum dado pessoal coletado
- Nenhum fingerprint invasivo
- Compatível com LGPD/GDPR

---

## Conclusão

O modelo de identidade do Auditável:
- É simples
- É auditável
- É transparente
- É adequado ao propósito

Este documento fundamenta decisões técnicas e institucionais.
