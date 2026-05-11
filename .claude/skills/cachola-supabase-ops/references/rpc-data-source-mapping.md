# RPC Data Source Mapping — Cachola OS

## Princípio

Ao modificar qualquer função RPC do Cachola, verificar este mapa primeiro. Módulos do Cachola tipicamente possuem múltiplas RPCs servindo a mesma UI: uma para lista detalhada (alimenta cards/tabelas), outra para contagens agregadas (alimenta badges em tabs), eventualmente uma terceira para drilldowns ou estatísticas. Quando uma regra de negócio muda em uma das funções, ela quase sempre precisa ser replicada nas demais que servem o mesmo módulo. Ignorar isso resulta em inconsistência visual (ex: badge mostrando número diferente da lista, como ocorreu na entrega 081 e foi corrigido na 082).

## Checklist obrigatório antes de modificar uma RPC

1. Localizar consumidores no front via `grep -rn "<nome_da_rpc>" src/`
2. Para cada consumidor, identificar **todas** as outras RPCs que ele consome (ou que componentes irmãos consomem na mesma página/módulo)
3. Avaliar, para cada gêmea identificada, se a alteração precisa ser replicada (caso comum: filtros de regra de negócio aplicados em CTEs ou WHERE)
4. Adicionar ao mapa abaixo qualquer nova relação descoberta

## Mapa de funções gêmeas conhecidas

### Módulo Recompra > Aba Aniversário

- **Função de lista:** `get_recompra_aniversario_proximo`
- **Função de contagem (badge):** `get_recompra_count_for_user` (parte `aniversario_opps`)
- **Regra compartilhada:** filtro `p_exclude_recent_months DEFAULT 6` aplicado na CTE `best_deals` da subquery `aniversario_opps`
- **Histórico:** adicionado pelas migrations 081 (lista) e 082 (contagem). A omissão da segunda na entrega 081 causou inconsistência em produção (badge 143 vs lista 62), corrigida na 082.

### Módulo Recompra > Aba Festa Passada

- **Função de lista:** `get_recompra_festa_passada`
- **Função de contagem (badge):** `get_recompra_count_for_user` (parte `festa_passada_opps` — mesma função da aba Aniversário)
- **Regra compartilhada:** critério "sem atividade nos últimos 10 meses" aplicado na CTE `festa_passada_opps`
- **Atenção especial:** a função `get_recompra_count_for_user` serve as duas abas (Aniversário e Festa Passada). Qualquer alteração nela exige avaliação dupla — impacta ambos os badges.

### Módulo BI > Painel Visão Geral — Antecedência Média de Reserva (Frente 2.1, 08/mai/2026)

- **Função série mensal:** `get_bi_sales_metrics` — retorna `avg_booking_advance_days` por mês (coluna da tabela mensal e fonte do KPI card)
- **Função comparativo unidades:** `get_bi_unit_comparison` — retorna `avg_booking_advance` (nome ligeiramente diferente, mesma métrica) agregado por unidade
- **Regra compartilhada:** média ponderada por `won_deals` de `(event_date - ploomes_create_date::date)` para deals ganhos com `event_date IS NOT NULL AND event_date > ploomes_create_date::date`
- **Consumer frontend:** `src/app/(auth)/bi/page.tsx` — `periodAdvance` (IIFE média ponderada sobre `salesRows`, espelho de `periodClosing`)

**Aprendizado central — Frente 2.1 v1.8.1:**

> **Nunca usar o mês corrente isolado (`currentMonth`) para representar o período selecionado pelo usuário.**
>
> Causa-raiz do bug: o card de Antecedência Média consultava `salesMetrics.data?.currentMonth?.avg_booking_advance_days` — sempre o mês mais recente da série, independente do filtro 3M/6M/12M/Tudo selecionado. Isso fazia o card mostrar sempre ~154 dias (valor do mês corrente) mesmo quando o usuário selecionava "12M" ou "Tudo".
>
> **Padrão correto para KPI cards que dependem de filtro de período:** calcular via média ponderada sobre `salesRows` (a fatia já filtrada pelo período selecionado), não extrair um único campo de `currentMonth`/`previousMonth`. Ver `periodClosing` (linhas 144–152 de `page.tsx`) como referência canônica — `periodAdvance` (Frente 2.1) replica esse padrão exato para `avg_booking_advance_days`.
>
> Antes de adicionar qualquer novo KPI card em `/bi/page.tsx` que exiba uma média agregada do período, verificar se o valor vem de `salesRows` (correto) ou de `currentMonth` (errado).

## Convite à expansão

Sempre que descobrir uma nova relação de funções gêmeas em qualquer módulo do sistema (BI, Eventos, Manutenção, Atas, Pré-venda Diretoria, etc.), adicionar uma sub-seção a este mapa. O custo de manter a documentação atualizada é próximo de zero comparado ao custo de corrigir bug visível em produção.
