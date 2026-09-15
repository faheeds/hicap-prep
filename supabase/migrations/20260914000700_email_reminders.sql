-- Email reminders opt-in (Epic 4, E4-4).
--
-- Adds two columns to families:
--   email_reminders_opted_in  — parent has opted in to weekly digests.
--   retention_email_sent_at   — timestamp when the retention-warning email was
--                               last sent for this family. The send-digest edge
--                               function writes this after sending; the check
--                               `retention_email_sent_at IS NULL` prevents a
--                               second warning going out on the next cron run.
--
-- Scheduling the weekly send-digest edge function cannot be done portably in a
-- migration (pg_net.http_post requires hardcoding the project URL + key). Set
-- it up in the Supabase dashboard → Cron → New job:
--   Name:     hicap-weekly-digest
--   Schedule: 0 9 * * 1   (Mondays at 09:00 UTC)
--   Command:  select net.http_post(
--               url := '<SUPABASE_URL>/functions/v1/send-digest',
--               headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
--               body := '{}'::jsonb
--             );
--
-- Also, once RESEND_API_KEY + FROM_EMAIL are set as Supabase secrets and send-digest
-- is deployed, flip the retention automation flag so families actually get warned:
--   update public.app_settings set retention_automation_enabled = true where id = true;

alter table public.families
  add column if not exists email_reminders_opted_in   boolean not null default false,
  add column if not exists retention_email_sent_at    timestamptz;

comment on column public.families.email_reminders_opted_in is
  'Parent opted in to weekly practice digest emails. Default off.';
comment on column public.families.retention_email_sent_at is
  'Set when the retention-warning email is sent. NULL = warning not yet emailed.';
