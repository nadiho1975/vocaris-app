-- VOCARIS Supabase schema
-- Run this in Supabase SQL Editor before importing vocab CSV.

create table if not exists public.vocab (
  id bigint primary key,
  word text not null,
  meaning_ko text,
  example_en text,
  example_ko text,
  synonym text,
  entry_type text,
  is_phrase boolean default false,
  day int,
  related_forms text,
  source_list text,
  source_count int,
  priority_group text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists vocab_word_idx on public.vocab (lower(word));
create index if not exists vocab_priority_idx on public.vocab (priority_group);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal int not null default 20 check (daily_goal between 5 and 100),
  updated_at timestamptz default now()
);

create table if not exists public.user_words (
  user_id uuid references auth.users(id) on delete cascade,
  vocab_id bigint references public.vocab(id) on delete cascade,
  is_important boolean not null default false,
  seen_count int not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, vocab_id)
);

create index if not exists user_words_important_idx on public.user_words (user_id, is_important);

create table if not exists public.daily_assignments (
  user_id uuid references auth.users(id) on delete cascade,
  study_date date not null,
  vocab_id bigint references public.vocab(id) on delete cascade,
  assigned_order int not null,
  created_at timestamptz default now(),
  primary key (user_id, study_date, vocab_id)
);

create index if not exists daily_assignments_user_date_idx on public.daily_assignments (user_id, study_date, assigned_order);

create table if not exists public.study_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  vocab_id bigint references public.vocab(id) on delete cascade,
  studied_at timestamptz not null default now()
);

create index if not exists study_logs_user_date_idx on public.study_logs (user_id, studied_at desc);
create index if not exists study_logs_vocab_idx on public.study_logs (vocab_id);

alter table public.vocab enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_words enable row level security;
alter table public.daily_assignments enable row level security;
alter table public.study_logs enable row level security;

-- vocab is readable by authenticated users. Import/update is done by service role.
drop policy if exists "authenticated can read vocab" on public.vocab;
create policy "authenticated can read vocab" on public.vocab
  for select to authenticated using (true);

-- user_settings
drop policy if exists "users manage own settings" on public.user_settings;
create policy "users manage own settings" on public.user_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_words
drop policy if exists "users manage own words" on public.user_words;
create policy "users manage own words" on public.user_words
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- daily_assignments
drop policy if exists "users manage own daily assignments" on public.daily_assignments;
create policy "users manage own daily assignments" on public.daily_assignments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- study_logs
drop policy if exists "users manage own study logs" on public.study_logs;
create policy "users manage own study logs" on public.study_logs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.pick_vocab_for_today(
  p_user_id uuid,
  p_limit int,
  p_exclude_ids bigint[] default '{}'
)
returns table(id bigint)
language sql
security invoker
as $$
  select v.id
  from public.vocab v
  left join public.user_words uw
    on uw.vocab_id = v.id and uw.user_id = p_user_id
  where not (v.id = any(coalesce(p_exclude_ids, '{}')))
  order by
    coalesce(uw.seen_count, 0) asc,
    case
      when v.priority_group like 'A%' then 1
      when v.priority_group like 'B%' then 2
      when v.priority_group like 'C%' then 3
      else 4
    end asc,
    v.id asc
  limit greatest(p_limit, 0);
$$;

create or replace function public.increment_seen_count(p_user_id uuid, p_vocab_id bigint)
returns void
language plpgsql
security invoker
as $$
begin
  insert into public.user_words (user_id, vocab_id, seen_count, last_seen_at, updated_at)
  values (p_user_id, p_vocab_id, 1, now(), now())
  on conflict (user_id, vocab_id)
  do update set
    seen_count = public.user_words.seen_count + 1,
    last_seen_at = now(),
    updated_at = now();
end;
$$;
