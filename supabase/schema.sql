-- =====================================================================
--  Chef Chowder — banco de pedidos (Supabase)
--  Rode este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1) Tabela única de registros. Cada linha é um contato que anda pelo funil
--    (contato -> orcamento -> evento -> arquivo). Os detalhes ficam em "dados".
create table if not exists public.registros (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  dados         jsonb not null
);

-- 2) Quem pode usar o painel: só os e-mails desta lista.
create table if not exists public.admins (
  email text primary key
);
-- TROQUE pelos e-mails dos sócios (os mesmos usados no login do painel):
insert into public.admins (email) values
  ('socio1@exemplo.com'),
  ('socio2@exemplo.com')
on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'));
$$;

alter table public.registros enable row level security;
alter table public.admins    enable row level security;

-- 3) Visitantes da landing (sem login) só podem CRIAR um contato novo vindo do site.
--    Não conseguem ler, alterar nem apagar nada.
drop policy if exists "landing cria pedido" on public.registros;
create policy "landing cria pedido" on public.registros
  for insert to anon
  with check (
    dados ->> 'etapa' = 'contato'
    and dados ->> 'origem' in ('Site', 'Instagram')
    and length(coalesce(dados ->> 'nome', '')) between 1 and 120
    and pg_column_size(dados) < 20000
  );

-- 4) Sócios logados e autorizados podem tudo.
drop policy if exists "admin le"     on public.registros;
drop policy if exists "admin cria"   on public.registros;
drop policy if exists "admin altera" on public.registros;
drop policy if exists "admin apaga"  on public.registros;
create policy "admin le"     on public.registros for select to authenticated using (public.is_admin());
create policy "admin cria"   on public.registros for insert to authenticated with check (public.is_admin());
create policy "admin altera" on public.registros for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga"  on public.registros for delete to authenticated using (public.is_admin());

drop policy if exists "admin ve lista" on public.admins;
create policy "admin ve lista" on public.admins for select to authenticated using (public.is_admin());

-- 5) Atualização ao vivo no painel quando chega pedido novo.
do $$ begin
  alter publication supabase_realtime add table public.registros;
exception when duplicate_object then null; end $$;

-- 6) Pasta dos PDFs. Pública para leitura (o link vai na mensagem do WhatsApp;
--    o nome do arquivo é um código aleatório), só aceita PDF de até 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pedidos-pdf', 'pedidos-pdf', true, 2097152, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['application/pdf'];

drop policy if exists "landing envia pdf" on storage.objects;
create policy "landing envia pdf" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'pedidos-pdf');

drop policy if exists "admin apaga pdf" on storage.objects;
create policy "admin apaga pdf" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pedidos-pdf' and public.is_admin());
