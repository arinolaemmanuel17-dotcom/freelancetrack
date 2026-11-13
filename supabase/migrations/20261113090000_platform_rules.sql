-- Per-platform fee and hold rules, so the app can work out when money reaches you.
-- Shape: { "Fiverr": { "fee": 20, "hold": 14 }, ... }  fee = percent, hold = days.
-- A platform that isn't listed means no fee and no wait.
alter table public.user_settings
  add column if not exists platform_rules jsonb not null default
    '{"Fiverr":{"fee":20,"hold":14},"Upwork":{"fee":10,"hold":5},"Freelancer":{"fee":10,"hold":15},"PeoplePerHour":{"fee":20,"hold":14}}'::jsonb;

alter table public.user_settings drop constraint if exists user_settings_platform_rules_object;
alter table public.user_settings
  add constraint user_settings_platform_rules_object check (jsonb_typeof(platform_rules) = 'object');
