-- CoinCubby ESP32 locker-device integration tables.
-- Run this in the Supabase SQL editor after backing up your current schema.

create table if not exists public.devices (
  device_id bigserial primary key,
  device_code varchar(32) not null unique,
  device_name varchar(80),
  location varchar(120),
  status varchar(24) not null default 'Offline',
  token_hash text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.lockers
  add column if not exists device_id bigint references public.devices(device_id);

create table if not exists public.payment_sessions (
  payment_session_id bigserial primary key,
  transaction_id uuid references public.transactions(transaction_id) on delete cascade,
  customer_id uuid references public.customers(customer_id),
  locker_id bigint references public.lockers(locker_id),
  device_id bigint references public.devices(device_id),
  session_type varchar(32) not null check (session_type in ('rental_payment', 'overtime_payment')),
  amount_due numeric(10, 2) not null default 0,
  amount_paid numeric(10, 2) not null default 0,
  status varchar(24) not null default 'Pending' check (status in ('Pending', 'Paid', 'Expired', 'Cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_sessions_device_status
  on public.payment_sessions(device_id, status);

create index if not exists idx_payment_sessions_transaction
  on public.payment_sessions(transaction_id);

create table if not exists public.device_commands (
  command_id bigserial primary key,
  device_id bigint not null references public.devices(device_id),
  locker_id bigint references public.lockers(locker_id),
  transaction_id uuid references public.transactions(transaction_id) on delete cascade,
  payment_session_id bigint references public.payment_sessions(payment_session_id) on delete set null,
  command varchar(32) not null check (
    command in (
      'display_payment',
      'unlock_locker',
      'lock_locker',
      'release_locker',
      'cancel_payment'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  status varchar(24) not null default 'Pending' check (
    status in ('Pending', 'Processing', 'Completed', 'Failed', 'Cancelled')
  ),
  error_message text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_device_commands_next
  on public.device_commands(device_id, status, created_at);

-- Optional starter device. Change token handling before production.
insert into public.devices (device_code, device_name, location, status, token_hash)
values ('DEVICE001', 'Main Locker Kiosk', 'Prototype Area', 'Offline', 'change-me')
on conflict (device_code) do nothing;

-- If DEVICE001 already existed before running this file, set a prototype token:
-- update public.devices set token_hash = 'change-me' where device_code = 'DEVICE001';

-- If you want the user-facing 6-digit customer ID to be clearer later,
-- consider renaming customers.user_id to customer_code in a future cleanup.
