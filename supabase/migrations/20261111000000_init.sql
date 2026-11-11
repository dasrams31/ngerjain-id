-- ngerjain.id: initial schema (MVP tables from the PRD) with Row Level Security.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null default '',
  role text not null default 'client' check (role in ('client', 'admin', 'worker')),
  phone text,
  referral_code text unique,
  created_at timestamptz not null default now()
);

-- Create a profile row for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nama)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nama text not null,
  kategori text not null check (kategori in ('web', 'ml', 'mentoring', 'review')),
  deskripsi text not null default '',
  harga_mulai integer not null check (harga_mulai >= 0),
  model_harga text not null default 'penawaran',
  revisi_default integer not null default 2,
  aktif boolean not null default true
);

create table public.brief_templates (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  pertanyaan jsonb not null default '[]'
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_code_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique default ('NGR-' || lpad(nextval('public.order_code_seq')::text, 4, '0')),
  client_id uuid not null references public.profiles (id),
  service_id uuid references public.services (id),
  worker_id uuid references public.profiles (id),
  judul text not null,
  brief jsonb not null default '{}',
  deadline date,
  status text not null default 'draft' check (status in (
    'draft', 'quoted', 'awaiting_dp', 'in_progress', 'review',
    'revision', 'awaiting_final', 'completed', 'cancelled'
  )),
  total integer check (total >= 0),
  express boolean not null default false,
  revisi_kuota integer not null default 2,
  revisi_terpakai integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_client_idx on public.orders (client_id);
create index orders_status_idx on public.orders (status);

create function public.can_access_order(oid uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.orders o
    where o.id = oid and (o.client_id = auth.uid() or o.worker_id = auth.uid())
  );
$$;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  versi integer not null default 1,
  total integer not null check (total >= 10000),
  catatan text not null default '',
  expires_at timestamptz not null default (now() + interval '7 days'),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'rejected', 'expired')),
  created_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  judul text not null,
  urutan integer not null,
  persen integer not null default 0 check (persen between 0 and 100),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  nominal integer
);

create table public.progress_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  catatan text not null,
  preview_url text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id),
  path text not null,
  nama text not null,
  ukuran bigint not null,
  jenis text not null check (jenis in ('brief', 'chat', 'preview', 'final')),
  terkunci boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (length(body) between 1 and 4000),
  attachment_id uuid references public.attachments (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_order_idx on public.messages (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  tipe text not null check (tipe in ('dp', 'final', 'milestone', 'revisi', 'langganan')),
  amount integer not null check (amount >= 10000),
  poketo_invoice_id text unique,
  payment_url text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled', 'refunded')),
  metode text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_pending_idx on public.payments (status, created_at) where status = 'pending';

create table public.webhook_events (
  poketo_event_id text primary key,
  tipe text not null,
  payload jsonb not null,
  processed_at timestamptz,
  received_at timestamptz not null default now()
);

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  nomor integer not null,
  permintaan text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  berbayar boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipe text not null,
  order_id uuid references public.orders (id) on delete cascade,
  pesan text not null,
  dibaca boolean not null default false,
  dikirim_email boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Writes to payments, webhook_events, quotes, milestones, and order status go
-- through the server with the service role key, so most tables only get read
-- policies for signed-in users.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.brief_templates enable row level security;
alter table public.orders enable row level security;
alter table public.quotes enable row level security;
alter table public.milestones enable row level security;
alter table public.progress_updates enable row level security;
alter table public.attachments enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.revisions enable row level security;
alter table public.notifications enable row level security;

create policy "own profile or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "catalog is public" on public.services for select using (aktif or public.is_admin());
create policy "templates are public" on public.brief_templates for select using (true);

create policy "read accessible orders" on public.orders
  for select using (public.can_access_order(id));
create policy "client creates draft order" on public.orders
  for insert with check (client_id = auth.uid() and status = 'draft');

create policy "read quotes" on public.quotes for select using (public.can_access_order(order_id));
create policy "read milestones" on public.milestones for select using (public.can_access_order(order_id));
create policy "read progress" on public.progress_updates for select using (public.can_access_order(order_id));
create policy "read payments" on public.payments for select using (public.can_access_order(order_id));
create policy "read revisions" on public.revisions for select using (public.can_access_order(order_id));

create policy "read attachments" on public.attachments
  for select using (public.can_access_order(order_id) and (not terkunci or public.is_admin()));
create policy "upload attachments" on public.attachments
  for insert with check (uploader_id = auth.uid() and public.can_access_order(order_id) and jenis in ('brief', 'chat'));

create policy "read messages" on public.messages for select using (public.can_access_order(order_id));
create policy "send messages" on public.messages
  for insert with check (sender_id = auth.uid() and public.can_access_order(order_id));

create policy "read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- webhook_events: no policies, service role only.

-- ---------------------------------------------------------------------------
-- Realtime: chat, progress, and order status stream to the browser.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.progress_updates;
alter publication supabase_realtime add table public.milestones;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.payments;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files stored under "<order_id>/<file name>".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('order-files', 'order-files', false, 52428800)
on conflict (id) do nothing;

create policy "read order files" on storage.objects
  for select using (
    bucket_id = 'order-files'
    and public.can_access_order(((storage.foldername(name))[1])::uuid)
  );
create policy "upload order files" on storage.objects
  for insert with check (
    bucket_id = 'order-files'
    and public.can_access_order(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Seed catalog (prices are the PRD's starting proposal)
-- ---------------------------------------------------------------------------
insert into public.services (slug, nama, kategori, deskripsi, harga_mulai, model_harga, revisi_default) values
  ('landing-page', 'Landing page / company profile', 'web', 'Situs 1-5 halaman, responsif, siap SEO.', 750000, 'paket', 2),
  ('web-app', 'Web app custom', 'web', 'Dashboard, sistem informasi, atau aplikasi dengan login.', 3000000, 'milestone', 3),
  ('olah-data', 'Olah data dan visualisasi', 'ml', 'Bersihkan data, analisis, dan dashboard visual.', 500000, 'penawaran', 2),
  ('model-ml', 'Training dan evaluasi model ML', 'ml', 'Eksperimen model yang rapi dan bisa direproduksi.', 1500000, 'milestone', 2),
  ('mentoring', 'Sesi mentoring coding / riset', 'mentoring', 'Sesi 60 menit, kamu tetap yang mengerjakan.', 100000, 'per sesi', 0),
  ('review-paper', 'Review dan proofreading', 'review', 'Struktur, grammar, dan format sitasi.', 150000, 'per dokumen', 1);
