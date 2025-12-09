# Documento de Visão — AUDITÁVEL (Versão 2)

## 1. Propósito do Produto
O **Auditável** é uma plataforma nacional de **pesquisas públicas auditáveis**, permitindo que cidadãos participem de votações com **unicidade, transparência e rastreabilidade**, sem exposição de dados pessoais.

O objetivo é se tornar a **referência pública de opinião e expectativa social do Brasil**, permitindo que qualquer pessoa veja, audite e acompanhe o sentimento coletivo em tempo real.

## 2. Problema
Hoje, pesquisas de opinião:
- Não são auditáveis pelo público
- Têm metodologia pouco acessível
- Dependem de coleta manual e amostragem
- Não permitem verificar votos individualmente
- São vistas com desconfiança social

Há espaço para uma solução **aberta, transparente e confiável**.

## 3. Solução
Uma plataforma digital onde:
- Pesquisas são abertas ao público
- Cada pessoa pode votar **com unicidade garantida**
- Resultados são **visíveis e auditáveis**
- Dados podem ser validados criptograficamente
- Não exige confiança em uma entidade — o sistema prova

No futuro com:
- **biometria facial + hash anonímico (AWS Rekognition)**
- **registro on-chain via Merkle batch**
- **gráficos e relatórios em tempo real**

## 4. Tipos de Pesquisa
### Modo A — Voto Único Validado
- 1 voto por pessoa
- Pode alterar até o fechamento
- Último voto prevalece

### Modo B — Voto Múltiplo Controlado
Configurações por enquete:
- allow_multiple
- max_votes_per_user
- reset_period

## 5. Diferencial Estratégico
| Pesquisa tradicional | Auditável |
|---|---|
| Amostragem pequena | População inteira pode votar |
| Não auditável | Resultados auditáveis |
| Processo opaco | Público e verificável |
| Opinião única | **Opinião + intensidade + tendência temporal** |

## 6. Público-Alvo
- Cidadãos
- Jornalistas
- Institutos e universidades
- Órgãos públicos e privados

## 7. MVP Inicial
- Home com lista de pesquisas
- `/poll/[id]` exibe pergunta e opções
- `/vote/[id]` registra voto
- `/results/[id]` mostra resultados
- Integração com Supabase

## 8. Roadmap Resumido
| Versão | Recurso |
|---|---|
| V1 | Votos + resultados |
| V2 | Autenticação simples |
| V3 | Biometria AWS |
| V4 | Blockchain Auditing |
| V5 | Dashboard e API pública |

## 9. Marca
> **Nada escondido. Tudo auditável.**
> **O Brasil vota. Você confere.**