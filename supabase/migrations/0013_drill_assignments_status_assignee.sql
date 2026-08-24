-- Add explicit drill assignment metadata and update RLS for player assignment updates

alter table drill_assignments
  add column assigned_by uuid references profiles(id),
  add column assigned_date timestamptz not null default now();

create index drill_assignments_assigned_by_idx on drill_assignments (assigned_by);
create index drill_assignments_assigned_date_idx on drill_assignments (assigned_date);

alter policy drill_assignments_update on drill_assignments using (
  is_staff(academy_id)
  or exists (
    select 1
    from academy_members pm
    where pm.id = drill_assignments.player_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
  )
) with check (
  is_staff(academy_id)
  or (
    exists (
      select 1
      from academy_members pm
      where pm.id = drill_assignments.player_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
    and player_id = drill_assignments.player_id
  )
);
