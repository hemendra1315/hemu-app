-- RLS policies for drills and drill assignments

alter table drills enable row level security;
alter table drill_assignments enable row level security;

create policy drills_select on drills for select using (
  is_staff(academy_id)
);

create policy drills_write on drills for all
  using (is_staff(academy_id))
  with check (is_staff(academy_id));

create policy drill_assignments_select on drill_assignments for select using (
  is_staff(academy_id)
  or exists (
    select 1
    from academy_members pm
    where pm.id = drill_assignments.player_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
  )
  or exists (
    select 1
    from batch_members bm
    join academy_members pm on pm.id = bm.academy_member_id
    where bm.batch_id = drill_assignments.batch_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
  )
);

create policy drill_assignments_insert on drill_assignments for insert with check (
  is_staff(academy_id)
);

create policy drill_assignments_update on drill_assignments for update using (
  is_staff(academy_id)
) with check (
  is_staff(academy_id)
);

create policy drill_assignments_delete on drill_assignments for delete using (
  is_staff(academy_id)
);
