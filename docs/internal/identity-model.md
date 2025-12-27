# 📘 Modelo de Identidade do Auditável

## Objetivo deste documento
Definir, de forma inequívoca, **como a identidade do participante é modelada**, quais identificadores existem, **para que cada um serve**, e **onde podem ou não ser usados**.  
Este documento é **canônico** para decisões futuras de arquitetura.

---

## 1. Visão geral

O Auditável **não utiliza autenticação pessoal** (login, e-mail, CPF, etc.).  
Ainda assim, a plataforma precisa garantir:

- Limite de votos
- Possibilidade de alterar voto
- Cooldown
- Contagem correta de participantes
- Auditabilidade sem identificação pessoal

Para isso, o sistema utiliza **dois identificadores distintos**, com papéis bem definidos.

---

## 2. Identificadores existentes

### 2.1 `participant_id` (IDENTIDADE CANÔNICA)

- Tipo: `UUID`
- Gerado no **browser**
- Persistido em `localStorage`
- Um por navegador/dispositivo
- Não contém informação pessoal
- **Nunca muda** durante a vida útil do navegador

#### Função
Representa **um participante lógico** da plataforma.

#### Onde é usado
- Chave principal para regras de voto
- Cooldown
- Limite de participações
- “Último voto vale”
- Contagem de participantes

#### Onde é armazenado
- `participants.id`
- `votes.participant_id`
- `vote_events.participant_id`

#### Regra fundamental
> Todas as regras de negócio usam `(poll_id, participant_id)`  
> **Nunca** usam `user_hash`.

---

### 2.2 `user_hash` (IDENTIFICADOR AUXILIAR)

- Tipo: `UUID`
- Gerado no **browser**
- Persistido em `localStorage`
- Pode ser resetado em cenários extremos (ex: limpeza parcial)
- **Não é usado como identidade lógica**

#### Função
Apoio estatístico e agregações auxiliares.

Exemplos:
- Contagem de usuários únicos em janelas de tempo
- Destaque de pesquisas
- Métricas globais
- Agrupamentos sem custo de join com `participants`

#### Onde é usado
- Campo auxiliar em `votes.user_hash`
- Scripts de estatística
- Métricas de popularidade

#### Onde NÃO pode ser usado
- Limite de voto
- Cooldown
- Identidade de participante
- Regras de “último voto vale”

---

## 3. Geração dos identificadores

### 3.1 Frontend (browser)

Arquivo canônico:

```ts
lib/participant.ts
