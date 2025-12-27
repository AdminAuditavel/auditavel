# Modelo de Identidade do Auditável
Objetivo deste documento

Definir, de forma inequívoca, como a identidade do participante é modelada, quais identificadores existem, para que cada um serve, e onde podem ou não ser usados.
Este documento é canônico para decisões futuras de arquitetura.

## 1. Visão geral

O Auditável não utiliza autenticação pessoal (login, e-mail, CPF, etc.).
Ainda assim, a plataforma precisa garantir:

Limite de votos

Possibilidade de alterar voto

Cooldown

Contagem correta de participantes

Auditabilidade sem identificação pessoal

Para isso, o sistema utiliza dois identificadores distintos, com papéis bem definidos.
---
# 2. Identificadores existentes
## 2.1 participant_id (IDENTIDADE CANÔNICA)

Tipo: UUID

Gerado no browser

Persistido em localStorage

Um por navegador/dispositivo

Não contém informação pessoal

Nunca muda durante a vida útil do navegador

#### Função

Representa um participante lógico da plataforma.

Onde é usado

Chave principal para regras de voto

Cooldown

Limite de participações

“Último voto vale”

Contagem de participantes

Onde é armazenado

participants.id

votes.participant_id

vote_events.participant_id

Regra fundamental

Todas as regras de negócio usam (poll_id, participant_id)
Nunca usam user_hash.

2.2 user_hash (IDENTIFICADOR AUXILIAR)

Tipo: UUID

Gerado no browser

Persistido em localStorage

Pode ser resetado em cenários extremos (ex: limpeza parcial)

Não é usado como identidade lógica

Função

Apoio estatístico e agregações auxiliares.

Exemplos:

Contagem de usuários únicos em janelas de tempo

Destaque de pesquisas

Métricas globais

Agrupamentos sem custo de join com participants

Onde é usado

Campos auxiliares em votes.user_hash

Scripts de estatística

Métricas de popularidade

Onde NÃO pode ser usado

🚫 Limite de voto
🚫 Cooldown
🚫 Identidade de participante
🚫 Regras de “último voto vale”

3. Geração dos identificadores
3.1 Frontend (browser)

Arquivo canônico:

lib/participant.ts


Responsabilidades:

Garantir que sempre exista um participant_id

Garantir que sempre exista um user_hash

Nunca retornar valores vazios

Essas funções só rodam no client.

3.2 Garantia no ponto de uso

Antes de qualquer voto ser enviado:

if (!participant_id || !user_hash) {
  abortar envio
}


Isso garante que:

Nenhum voto órfão é criado

Nenhuma linha inválida entra no banco

A integridade do modelo é preservada

4. Relação entre identidade e votos
4.1 Voto único (max_votes_per_user = 1)

Pode existir apenas um voto vigente por (poll_id, participant_id)

Atualizações substituem o voto anterior

Histórico é preservado em vote_events

4.2 Voto múltiplo (max_votes_per_user > 1)

Cada voto gera uma nova linha em votes

O limite é aplicado por (poll_id, participant_id)

user_hash não interfere no limite

4.3 Ranking

Sempre existe apenas um ranking vigente

Atualizações substituem o ranking anterior

Score é recalculado a partir do estado atual

Histórico completo preservado

5. Auditorabilidade e privacidade

Este modelo garante simultaneamente:

✅ Um participante = um conjunto consistente de ações
✅ Possibilidade de auditoria completa
✅ Nenhuma identificação pessoal
✅ Nenhum login
✅ Nenhum dado sensível

O sistema sabe o que foi feito, mas não sabe quem é a pessoa.

6. Decisões explícitas de design

Não usar IP

Não usar fingerprinting

Não usar cookies de terceiros

Não exigir cadastro

Não usar user_hash como identidade

Essas decisões são intencionais e alinhadas ao propósito público do Auditável.

7. Consequências arquiteturais

Deploys não quebram identidade

Refresh de página é seguro

Navegador fechado não invalida participação

Um navegador = um participante

Votos são reproduzíveis e auditáveis

8. Regra de ouro

Se uma regra envolve “quem pode votar”, “quantas vezes”, ou “quando” → use participant_id.

Se envolve estatística agregada → user_hash é aceitável
