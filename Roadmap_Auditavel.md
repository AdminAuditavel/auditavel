
# Roadmap do Projeto Auditável

## Fase 0 - Preparação e Setup
**Objetivo**: Preparar ambientes e fundação técnica.
- Criar repositório no GitHub
- Criar projeto na Vercel
- Criar projeto na AWS
- Criar projeto na Supabase
- Criar carteira e ambiente da Polygon
- Configurar variáveis de ambiente
- Criar branch principal (main) e ambiente staging (dev)

## Fase 1 - Núcleo do Produto
**Objetivo**: Ter o MVP funcional sem biometria ainda.
- Criar interface inicial
- Criar página da pesquisa
- Criar página de confirmação de voto
- Criar página pública de resultados parciais
- Criar fluxo PWA (opcional para v1)

## Fase 2 - Biometria Facial
**Objetivo**: Garantir voto único confiável pelo rosto.
- Criar endpoint /verify-face
- Implementar captura da selfie no frontend
- Conectar com AWS S3 (armazenamento temporário)
- Analisar rosto → gerar FaceID
- Criar tabela de FaceIDs já votantes
- Rejeitar múltiplos votos (resolução: hashing do FaceID → irreversível)
- Remover selfies após análise (privacidade)
- Testar diferentes devices (iOS/Android)

## Fase 3 - Verificação de Idade
**Objetivo**: Permitir pesquisas eleitorais (16+).
- Criar verificador de idade via Rekognition DetectFace (estimativa natural)
- Se idade estimada <16 → solicitar documento
- Capturar foto do documento
- Extrair data de nascimento via OCR AWS Textract

## Fase 4 - Auditoria Imutável (Polygon)
**Objetivo**: Tornar o sistema “auditável de verdade”.
- Criar função Lambda que agrupa 1000 votos → gera Merkle Root
- Criar Smart Contract simples na Polygon: `submitMerkleRoot(batchRoot, batchId)`
- Publicar contrato na testnet → depois mainnet
- Criar página pública “Auditoria”: exibir batches, links para etherscan, merkle tree explorer

## Fase 5 - Beta Fechado
**Objetivo**: Validar com 100–500 usuários reais.
- Testes de carga (10.000 votos)
- Testes em rede celular (3G/4G/5G)
- Ajustes de biometria
- Ajustes de UX (velocidade, clareza, simplicidade)
- Corrigir erros de performance na Lambda
- Log de auditoria completo

## Fase 6 - Lançamento Público
**Objetivo**: Ir a público com primeiras grandes pesquisas.
- Criar landing page oficial (auditavel.com)
- Criar marca, visual e identidade
- Teste final da biometria em produção
- Otimizar custo AWS (cache + compressão)
- Otimizar Supabase (índices, colunas)
- Criar primeiras pesquisas virais (ex: “Intenção de voto…”)
- Anunciar nas redes
- Criar relatório público e transparente

## Fase 7 - Escalonamento
**Objetivo**: Transformar o sistema em plataforma nacional.
- Criar app mobile (opcional, só se for muito pedido)
- Criar ranking de pesquisas
- Criar API pública para imprensa
- Parcerias com universidades
- Parcerias com institutos de pesquisa
- Modelo de negócio baseado em relatórios premium e APIs
