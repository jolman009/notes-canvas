-- Phase 4: Monitoring queries for invite and collaboration health
-- Run in Supabase SQL Editor (read-only checks).

-- 1) Invite volume and acceptance trend (last 24h by hour)
with invite_creates as (
  select date_trunc('hour', created_at) as hour_bucket, count(*) as created_count
  from public.board_invites
  where created_at >= now() - interval '24 hours'
  group by 1
),
invite_accepts as (
  select date_trunc('hour', last_accepted_at) as hour_bucket, count(*) as accepted_count
  from public.board_invites
  where last_accepted_at is not null
    and last_accepted_at >= now() - interval '24 hours'
  group by 1
)
select
  coalesce(c.hour_bucket, a.hour_bucket) as hour_bucket,
  coalesce(c.created_count, 0) as invites_created,
  coalesce(a.accepted_count, 0) as invites_accepted
from invite_creates c
full join invite_accepts a on a.hour_bucket = c.hour_bucket
order by hour_bucket desc;

-- 2) Revoked/expired invites still present (cleanup backlog)
select
  count(*) filter (where revoked_at is not null) as revoked_rows,
  count(*) filter (where expires_at <= now()) as expired_rows
from public.board_invites;

-- 3) High churn boards (proxy signal for edit/conflict pressure)
select
  b.id as board_id,
  b.title,
  s.revision,
  s.updated_at
from public.boards b
join public.board_state s on s.board_id = b.id
where s.updated_at >= now() - interval '24 hours'
order by s.revision desc
limit 20;

-- 4) Membership and ownership consistency check
select
  b.id as board_id,
  b.owner_user_id,
  exists (
    select 1
    from public.board_members m
    where m.board_id = b.id
      and m.user_id = b.owner_user_id
      and m.role = 'owner'
  ) as owner_membership_exists
from public.boards b
order by b.created_at desc;
