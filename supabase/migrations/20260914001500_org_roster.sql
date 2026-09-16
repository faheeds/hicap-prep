-- Org bulk-roster import table (Epic 7, E7-3).
--
-- org_roster_entries holds the per-student entries an org admin pre-loads
-- before seat provisioning. Each row is a single child's first name and
-- grade; when a family claims a seat they can optionally link to one of
-- these rows (claimed_by_family_id).
--
-- Privacy contract:
--   - student_first_name: first name only (never surname). Orgs fill this from
--     their own records; names are displayed only to the org owner and to the
--     family that claims the seat.
--   - No birth date, email, or any other PII is stored here.
--
-- RLS contract:
--   - INSERT  : org owner only (via organizations.owner_user_id check).
--   - SELECT  : org owner + families linked to that org (members).
--   - No authenticated UPDATE or DELETE. Claiming a seat writes
--     claimed_by_family_id via the service-role provisioning webhook (E7-4).

create table if not exists public.org_roster_entries (
  id                   uuid        primary key default gen_random_uuid(),
  organization_id      uuid        not null references public.organizations(id) on delete cascade,
  student_first_name   text        not null,
  student_grade        integer     not null check (student_grade between 1 and 12),
  claimed_by_family_id uuid        references public.families(id) on delete set null,
  created_at           timestamptz not null default now()
);

comment on table  public.org_roster_entries                         is 'Pre-loaded student roster for an org seat license.';
comment on column public.org_roster_entries.student_first_name      is 'Child first name only — no surname.';
comment on column public.org_roster_entries.claimed_by_family_id    is 'Set by service role when a family claims this seat; null = unclaimed.';

create index if not exists org_roster_entries_org_idx
  on public.org_roster_entries (organization_id);

alter table public.org_roster_entries enable row level security;

-- Org owner can insert roster entries for their own org.
create policy "org_owner_insert_roster"
  on public.org_roster_entries for insert
  to authenticated
  with check (
    exists (
      select 1 from public.organizations
       where id = org_roster_entries.organization_id
         and owner_user_id = auth.uid()
    )
  );

-- Org owner can read all entries for their org.
create policy "org_owner_read_roster"
  on public.org_roster_entries for select
  to authenticated
  using (
    exists (
      select 1 from public.organizations
       where id = org_roster_entries.organization_id
         and owner_user_id = auth.uid()
    )
  );

-- Families that are members of the org can read the roster
-- (so the family can find and claim their child's entry).
create policy "org_member_read_roster"
  on public.org_roster_entries for select
  to authenticated
  using (
    exists (
      select 1 from public.families
       where families.organization_id = org_roster_entries.organization_id
         and families.owner_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated other than org_owner_insert_roster above.
-- claimed_by_family_id is written only by the service-role provisioning path.
