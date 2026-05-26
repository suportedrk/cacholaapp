#!/usr/bin/env bash
# Matriz de acesso por cargo às 5 tabelas do módulo checklist_comercial.
#
# 5 tabelas:
#   T = commercial_task_templates
#   I = commercial_template_items
#   K = commercial_tasks  (Kse = vê task de OUTRO assignee na mesma unidade)
#   C = commercial_task_completions  (sem UPDATE/DELETE — log imutável)
#   A = commercial_stage_automations
#
# Pontos críticos cobertos:
#   - Kse usa uma task seed assigned a outro usuário (super_admin) → revela
#     se o cargo vê tasks de outros na unidade. Vendedora hoje NÃO vê.
#   - Tse com unit_id IS NULL (template global) — cargos sem `view` granted
#     perdem isso na migração (redução b).
set -e

PSQL_CMD="docker exec -i cacholaos-db psql -U postgres -d postgres -tA -q"
RUNAS_PSQL="docker exec -i cacholaos-db psql -U postgres -d postgres -tA -X -q"

# ------------------------------------------------------------------
# Cleanup prévio
# ------------------------------------------------------------------
$PSQL_CMD <<'SQL' >/dev/null 2>&1
DELETE FROM public.commercial_task_completions WHERE notes LIKE '__rls_%';
DELETE FROM public.commercial_tasks WHERE title LIKE '__rls_%';
DELETE FROM public.commercial_template_items WHERE title LIKE '__rls_%';
DELETE FROM public.commercial_task_templates WHERE title LIKE '__rls_%';
DELETE FROM public.commercial_stage_automations WHERE stage_id = 999000000;
SQL

SETUP=$($PSQL_CMD <<'SQL' 2>&1
DO $$
DECLARE
  v_unit_pinheiros UUID;
  v_t_global       UUID := gen_random_uuid();
  v_t_unit         UUID := gen_random_uuid();
  v_item_global    UUID := gen_random_uuid();
  v_item_unit      UUID := gen_random_uuid();
  v_auto_global    UUID := gen_random_uuid();
  v_task_stranger  UUID := gen_random_uuid();
  v_super_id       UUID;
BEGIN
  SELECT id INTO v_unit_pinheiros FROM public.units ORDER BY name LIMIT 1;
  SELECT id INTO v_super_id FROM public.users WHERE role='super_admin' LIMIT 1;

  INSERT INTO public.commercial_task_templates (id, unit_id, title, default_priority, created_by)
  VALUES (v_t_global, NULL, '__rls_t_global', 'medium', v_super_id);

  INSERT INTO public.commercial_task_templates (id, unit_id, title, default_priority, created_by)
  VALUES (v_t_unit, v_unit_pinheiros, '__rls_t_unit', 'medium', v_super_id);

  INSERT INTO public.commercial_template_items (id, template_id, title, priority, sort_order)
  VALUES (v_item_global, v_t_global, '__rls_item_global', 'medium', 0);

  INSERT INTO public.commercial_template_items (id, template_id, title, priority, sort_order)
  VALUES (v_item_unit, v_t_unit, '__rls_item_unit', 'medium', 0);

  INSERT INTO public.commercial_stage_automations (id, unit_id, stage_id, template_id, active, created_by)
  VALUES (v_auto_global, NULL, 999000000, v_t_global, true, v_super_id);

  -- Task seed atribuída ao super_admin (stranger) em Pinheiros — para teste de "vê task de outro"
  INSERT INTO public.commercial_tasks (id, unit_id, assignee_id, title, source, status, created_by)
  VALUES (v_task_stranger, v_unit_pinheiros, v_super_id, '__rls_k_stranger', 'manual', 'pending', v_super_id);

  RAISE NOTICE 't_global=%', v_t_global;
  RAISE NOTICE 't_unit=%', v_t_unit;
  RAISE NOTICE 'item_global=%', v_item_global;
  RAISE NOTICE 'item_unit=%', v_item_unit;
  RAISE NOTICE 'auto_global=%', v_auto_global;
  RAISE NOTICE 'task_stranger=%', v_task_stranger;
  RAISE NOTICE 'unit_pinheiros=%', v_unit_pinheiros;
END $$;
SQL
)
echo "Setup:"
echo "$SETUP" | sed 's/^/  /'

T_GLOBAL=$(echo "$SETUP" | grep -oP 't_global=\K[0-9a-f-]+' | head -n1)
T_UNIT=$(echo "$SETUP" | grep -oP 't_unit=\K[0-9a-f-]+' | head -n1)
ITEM_GLOBAL=$(echo "$SETUP" | grep -oP 'item_global=\K[0-9a-f-]+' | head -n1)
ITEM_UNIT=$(echo "$SETUP" | grep -oP 'item_unit=\K[0-9a-f-]+' | head -n1)
AUTO_GLOBAL=$(echo "$SETUP" | grep -oP 'auto_global=\K[0-9a-f-]+' | head -n1)
TASK_STRANGER=$(echo "$SETUP" | grep -oP 'task_stranger=\K[0-9a-f-]+' | head -n1)
UNIT_PINH=$(echo "$SETUP" | grep -oP 'unit_pinheiros=\K[0-9a-f-]+' | head -n1)

cleanup() {
  docker exec -i cacholaos-db psql -U postgres -d postgres -q <<SQL >/dev/null 2>&1 || true
DELETE FROM public.commercial_task_completions WHERE notes LIKE '__rls_%';
DELETE FROM public.commercial_tasks WHERE title LIKE '__rls_%';
DELETE FROM public.commercial_template_items WHERE title LIKE '__rls_%';
DELETE FROM public.commercial_task_templates WHERE title LIKE '__rls_%';
DELETE FROM public.commercial_stage_automations WHERE stage_id = 999000000;
SQL
}
trap cleanup EXIT

echo
echo "Matriz por cargo — 5 tabelas:"
echo "T=templates  I=template_items  K=tasks (Kse=vê task de outro)  C=completions  A=automations"
printf "%-12s | %-3s %-3s %-3s %-3s | %-3s %-3s %-3s %-3s | %-3s %-3s %-3s %-3s | %-3s | %-3s %-3s %-3s %-3s\n" \
  cargo Tse Tin Tup Tde  Ise Iin Iup Ide  Kse Kin Kup Kde  Cin  Ase Ain Aup Ade
echo "$(printf '%.0s-' {1..106})"

run_as_user() {
  local USR="$1"; local SQL="$2"
  $RUNAS_PSQL 2>&1 <<EOF
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"$USR","role":"authenticated"}';
$SQL
ROLLBACK;
EOF
}

mapfile -t USERS_LINES < <(docker exec -i cacholaos-db psql -U postgres -d postgres -tA -F'|' -c \
  "SELECT u.role, u.id::text FROM public.users u
   WHERE u.email LIKE 'teste.%@cachola.local' OR u.email = 'admin@cachola.local'
   ORDER BY u.role;")

for LINE in "${USERS_LINES[@]}"; do
  ROLE=$(echo "$LINE" | cut -d'|' -f1)
  USR=$(echo "$LINE" | cut -d'|' -f2)

  # T — templates
  OUT=$(run_as_user "$USR" "SELECT 'OK' FROM public.commercial_task_templates WHERE id IN ('$T_GLOBAL','$T_UNIT');" || true)
  if echo "$OUT" | grep -q OK; then TSE=OK; else TSE=BLK; fi

  OUT=$(run_as_user "$USR" "INSERT INTO public.commercial_task_templates (unit_id, title, default_priority) VALUES (NULL, '__rls_ins_$ROLE', 'medium') RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then TIN=OK; else TIN=BLK; fi

  OUT=$(run_as_user "$USR" "UPDATE public.commercial_task_templates SET title=title WHERE id='$T_GLOBAL' RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then TUP=OK; else TUP=BLK; fi

  OUT=$(run_as_user "$USR" "DELETE FROM public.commercial_task_templates WHERE id='$T_UNIT' RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then TDE=OK; else TDE=BLK; fi

  # I — items
  OUT=$(run_as_user "$USR" "SELECT 'OK' FROM public.commercial_template_items WHERE id IN ('$ITEM_GLOBAL','$ITEM_UNIT');" || true)
  if echo "$OUT" | grep -q OK; then ISE=OK; else ISE=BLK; fi

  OUT=$(run_as_user "$USR" "INSERT INTO public.commercial_template_items (template_id, title, priority, sort_order) VALUES ('$T_GLOBAL', '__rls_iitem_$ROLE', 'medium', 99) RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then IIN=OK; else IIN=BLK; fi

  OUT=$(run_as_user "$USR" "UPDATE public.commercial_template_items SET title=title WHERE id='$ITEM_GLOBAL' RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then IUP=OK; else IUP=BLK; fi

  OUT=$(run_as_user "$USR" "DELETE FROM public.commercial_template_items WHERE id='$ITEM_GLOBAL' RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then IDE=OK; else IDE=BLK; fi

  # K — tasks
  # Kse: tenta ver task ATRIBUÍDA AO SUPER_ADMIN (outro assignee). Revela propriedade vs unit_view.
  OUT=$(run_as_user "$USR" "SELECT 'OK' FROM public.commercial_tasks WHERE id='$TASK_STRANGER';" || true)
  if echo "$OUT" | grep -q OK; then KSE=OK; else KSE=BLK; fi

  # Kin: tenta criar task assignada a si mesmo, source='manual'
  OUT=$(run_as_user "$USR" "INSERT INTO public.commercial_tasks (unit_id, assignee_id, title, source, status) VALUES ('$UNIT_PINH', '$USR', '__rls_kins_$ROLE', 'manual', 'pending') RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then KIN=OK; else KIN=BLK; fi

  # Kup: cria + atualiza própria task
  OUT=$(run_as_user "$USR" "
    INSERT INTO public.commercial_tasks (unit_id, assignee_id, title, source, status)
      VALUES ('$UNIT_PINH', '$USR', '__rls_kupd_$ROLE', 'manual', 'pending');
    UPDATE public.commercial_tasks SET title=title WHERE title='__rls_kupd_$ROLE' RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then KUP=OK; else KUP=BLK; fi

  # Kde: cria + tenta deletar própria task (esperado BLK exceto is_global_viewer com delete)
  OUT=$(run_as_user "$USR" "
    INSERT INTO public.commercial_tasks (unit_id, assignee_id, title, source, status)
      VALUES ('$UNIT_PINH', '$USR', '__rls_kdel_$ROLE', 'manual', 'pending');
    DELETE FROM public.commercial_tasks WHERE title='__rls_kdel_$ROLE' RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then KDE=OK; else KDE=BLK; fi

  # C — completions INSERT (na própria task)
  OUT=$(run_as_user "$USR" "
    INSERT INTO public.commercial_tasks (id, unit_id, assignee_id, title, source, status)
      VALUES (gen_random_uuid(), '$UNIT_PINH', '$USR', '__rls_kci_$ROLE', 'manual', 'pending');
    INSERT INTO public.commercial_task_completions (task_id, completed_by, notes)
      SELECT id, '$USR', '__rls_$ROLE' FROM public.commercial_tasks WHERE title='__rls_kci_$ROLE'
      RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then CIN=OK; else CIN=BLK; fi

  # A — automations
  OUT=$(run_as_user "$USR" "SELECT 'OK' FROM public.commercial_stage_automations WHERE id='$AUTO_GLOBAL';" || true)
  if echo "$OUT" | grep -q OK; then ASE=OK; else ASE=BLK; fi

  OUT=$(run_as_user "$USR" "INSERT INTO public.commercial_stage_automations (unit_id, stage_id, template_id, active) VALUES ('$UNIT_PINH', 999000001, '$T_GLOBAL', true) RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then AIN=OK; else AIN=BLK; fi

  OUT=$(run_as_user "$USR" "UPDATE public.commercial_stage_automations SET active=active WHERE id='$AUTO_GLOBAL' RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then AUP=OK; else AUP=BLK; fi

  OUT=$(run_as_user "$USR" "DELETE FROM public.commercial_stage_automations WHERE id='$AUTO_GLOBAL' RETURNING 'OK';" || true)
  if echo "$OUT" | grep -q OK; then ADE=OK; else ADE=BLK; fi

  printf "%-12s | %-3s %-3s %-3s %-3s | %-3s %-3s %-3s %-3s | %-3s %-3s %-3s %-3s | %-3s | %-3s %-3s %-3s %-3s\n" \
    "$ROLE" "$TSE" "$TIN" "$TUP" "$TDE"  "$ISE" "$IIN" "$IUP" "$IDE"  "$KSE" "$KIN" "$KUP" "$KDE"  "$CIN"  "$ASE" "$AIN" "$AUP" "$ADE"
done
