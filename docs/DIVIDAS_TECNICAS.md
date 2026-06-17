# Dividas Tecnicas — Cachola OS

Fonte de verdade do backlog de dividas tecnicas e pendencias do Cachola OS. Mantido em conjunto pelo Claude (consultor, no chat) e pelo Claude Code (executor). Conforme cada item for resolvido, mova-o para a secao "Resolvidas" no final, com a data e a versao — nao apagar de vez, pra manter o historico. Nao depender da memoria do chat: este arquivo e o registro permanente.

Status possiveis: PENDENTE | BLOQUEADA | AGUARDANDO TERCEIRO | VERIFICAR

## Infraestrutura / DevOps

- [ ] Esteira de migracao com botao (workflow_dispatch no GitHub Actions): aplicar migracoes no banco de PRODUCAO com 1 clique, de forma auditavel e transacao-segura, reaproveitando a chave que o Actions ja tem, SEM quebrar o isolamento dev-prod (Claude Code nunca toca producao direto). Hoje e manual via PowerShell do PC do Bruno. STATUS: PENDENTE.
- [ ] Janela de manutencao da VPS de producao: upgrade de Docker/containerd/snapd; corrigir a causa-raiz do LimitNOFILE do dockerd (reseta para 65535 no reboot e quebra o supabase-pooler — fix via ulimits nofile no supavisor do docker-compose); autoremove dos kernels antigos (6.8.0-111 e 6.8.0-117) apos confirmar estabilidade do 6.8.0-124; versionar o docker-compose.yml do Supabase no git. STATUS: PENDENTE.
- [ ] Auditoria de vulnerabilidades npm (27 no ultimo build: 12 high, 14 moderate, 1 low): triar runtime-facing vs build/dev-only e aplicar so bumps seguros. NUNCA rodar npm audit fix --force (quebra Next 16 / Tailwind v4). STATUS: PENDENTE.
- [ ] Auditar paridade de migracoes local vs producao. STATUS: PENDENTE.
- [ ] Limpar o diretorio untracked scripts/ops/ que aparece na working tree da VPS de producao. STATUS: PENDENTE (baixa prioridade).

## RBAC / Permissoes

- [ ] Atas — converter as operacoes de ESCRITA de role-gating (ATAS_MANAGE_ROLES) para check_permission + aplicar backfill. Pre-requisito para que cargos operacionais possam algum dia ter escrita em Atas (as entradas atas.create/edit em role_permissions ficam "ocas" ate isso). STATUS: PENDENTE.
- [ ] Manutencao — alinhar o template do cargo DIRETOR para incluir create/edit/delete de manutencao (hoje Carol e Vinicius funcionam por grants individuais; um diretor novo nao herdaria automaticamente). STATUS: VERIFICAR (conferir se a reforma da v1.55.0 ja cobriu).

## BI / Dados

- [ ] BI — confirmar se get_bi_sales_metrics e get_bi_unit_comparison tem a mesma divergencia de unidade raw-vs-canonica corrigida pela mig 154 (a mig 151 pode ja cobrir). STATUS: VERIFICAR.
- [ ] BI backlog — Antecedencia media respeitando o filtro de periodo; badges de delta (periodo vs. anterior) nos 5 cards de KPI; drilldown alinhado ao periodo selecionado. STATUS: PENDENTE.
- [ ] Auditar ploomes_deals e events para a mesma falha de reconciliacao de Orders (registros orfaos). STATUS: PENDENTE.

## Produto / Features pendentes

- [ ] Atas — Minhas Tarefas Fase B (notificar o responsavel quando uma tarefa e atribuida) e Fase C (mostrar prazos das tarefas no calendario do dashboard). Fase A ja entregue (v1.54.0). STATUS: PENDENTE.
- [ ] Decoracao Fase B (3 layouts + 18 APIs, sem SQL). STATUS: BLOQUEADA ate o Bruno dizer "Fase 2 congelada".
- [ ] Submodulo de Baloes. STATUS: AGUARDANDO TERCEIRO (a Mari responder sobre unificar em Itens).
- [ ] Vendas Fase 3 / Orders Fase 2 — UI Vendedoras + melhorias de BI por Categoria + vendedoras ativas/inativas. STATUS: PENDENTE.
- [ ] Central de Servicos Fase 2 — anexos + confirmacao de leitura + dashboard. STATUS: PENDENTE.
- [ ] Front "Permissoes de Custo de Prestador" para o campo agreed_price em Prestadores. STATUS: PENDENTE.

## Pequenas / Housekeeping

- [ ] Recriar os 7 usuarios de teste de producao (teste-{role}@cachola.cloud) removidos em abril/2026 (~30 min). STATUS: PENDENTE.
- [ ] Alinhamento de sinal de gap: conflitos de evento usam <= 0 e conflitos de pre-reserva usam < 0 — alinhar num toque futuro. STATUS: PENDENTE.

## Resolvidas

(Mover itens concluidos para ca, com data e versao. Exemplo: "- [x] (17/06/2026, v1.x) descricao do item.")
