-- Schema to create the public.wallets table, trigger for auto-creation, and populate existing customers.

create table if not exists public.wallets (
  wallet_id bigserial primary key,
  customer_id uuid not null unique references public.customers(customer_id) on delete cascade,
  balance numeric(10, 2) not null default 50.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger function to automatically create a wallet for newly registered customers
create or replace function public.handle_new_customer_wallet()
returns trigger as $$
begin
  insert into public.wallets (customer_id, balance)
  values (new.customer_id, 50.00)
  on conflict (customer_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger definition on customer insertion
create or replace trigger on_customer_created
  after insert on public.customers
  for each row execute function public.handle_new_customer_wallet();

-- Populate wallets for all existing customers
insert into public.wallets (customer_id, balance)
select customer_id, 50.00 from public.customers
on conflict (customer_id) do nothing;
