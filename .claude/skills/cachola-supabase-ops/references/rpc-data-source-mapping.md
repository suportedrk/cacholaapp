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

## Convite à expansão

Sempre que descobrir uma nova relação de funções gêmeas em qualquer módulo do sistema (BI, Eventos, Manutenção, Atas, Pré-venda Diretoria, etc.), adicionar uma sub-seção a este mapa. O custo de manter a documentação atualizada é próximo de zero comparado ao custo de corrigir bug visível em produção.
