-- Row level security for batch management

alter table batches enable row level security;
alter table batch_members enable row level security;

create policy batches_select on batches for select using (
  is_staff(academy_id)
);

create policy batches_insert on batches for insert with check (
  is_staff(academy_id)
);

create policy batches_update on batches for update using (
  is_staff(academy_id)
) with check (
  is_staff(academy_id)
);

create policy batches_delete on batches for delete using (
  is_staff(academy_id)
);

create policy batch_members_select on batch_members for select using (
  exists (
    select 1
    from batches b
    where b.id = batch_members.batch_id
      and is_staff(b.academy_id)
  )
);

create policy batch_members_insert on batch_members for insert with check (
  exists (
    select 1
    from batches b
    where b.id = batch_members.batch_id
      and is_staff(b.academy_id)
  )
);

create policy batch_members_update on batch_members for update using (
  exists (
    select 1
    from batches b
    where b.id = batch_members.batch_id
      and is_staff(b.academy_id)
  )
) with check (
  exists (
    select 1
    from batches b
    where b.id = batch_members.batch_id
      and is_staff(b.academy_id)
  )
);

create policy batch_members_delete on batch_members for delete using (
  exists (
    select 1
    from batches b
    where b.id = batch_members.batch_id
      and is_staff(b.academy_id)
  )
);
