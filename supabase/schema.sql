-- =====================================================================
--  Chef Chowder — banco de pedidos (Supabase)
--  Rode este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1) Tabela única de registros. Cada linha é um contato que anda pelo funil
--    (contato -> orcamento -> evento -> arquivo). Os detalhes ficam em "dados".
create table if not exists public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  dados         jsonb not null
);

-- 2) Quem pode usar o painel: só os e-mails desta lista.
--    (Nomes com prefixo "pedidos" para conviver com outros sistemas no mesmo projeto.)
create table if not exists public.pedidos_admins (
  email text primary key
);
-- TROQUE pelos e-mails dos sócios (os mesmos usados no login do painel):
insert into public.pedidos_admins (email) values
  ('socio1@exemplo.com')
on conflict do nothing;

create or replace function public.pedidos_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pedidos_admins where email = lower(auth.jwt() ->> 'email'));
$$;

revoke execute on function public.pedidos_is_admin() from public, anon;
grant execute on function public.pedidos_is_admin() to authenticated;

-- Projetos novos do Supabase não liberam tabelas automaticamente: permissões explícitas.
grant insert on public.pedidos to anon;
grant select, insert, update, delete on public.pedidos to authenticated;
grant select on public.pedidos_admins to authenticated;

alter table public.pedidos enable row level security;
alter table public.pedidos_admins    enable row level security;

-- 3) Visitantes da landing (sem login) só podem CRIAR um contato novo vindo do site.
--    Não conseguem ler, alterar nem apagar nada.
drop policy if exists "landing cria pedido" on public.pedidos;
create policy "landing cria pedido" on public.pedidos
  for insert to anon
  with check (
    dados ->> 'etapa' = 'contato'
    and dados ->> 'origem' in ('Site', 'Instagram')
    and length(coalesce(dados ->> 'nome', '')) between 1 and 120
    and pg_column_size(dados) < 20000
  );

-- 4) Sócios logados e autorizados podem tudo.
drop policy if exists "admin le"     on public.pedidos;
drop policy if exists "admin cria"   on public.pedidos;
drop policy if exists "admin altera" on public.pedidos;
drop policy if exists "admin apaga"  on public.pedidos;
create policy "admin le"     on public.pedidos for select to authenticated using (public.pedidos_is_admin());
create policy "admin cria"   on public.pedidos for insert to authenticated with check (public.pedidos_is_admin());
create policy "admin altera" on public.pedidos for update to authenticated using (public.pedidos_is_admin()) with check (public.pedidos_is_admin());
create policy "admin apaga"  on public.pedidos for delete to authenticated using (public.pedidos_is_admin());

drop policy if exists "admin ve lista" on public.pedidos_admins;
create policy "admin ve lista" on public.pedidos_admins for select to authenticated using (public.pedidos_is_admin());

-- 5) Atualização ao vivo no painel quando chega pedido novo.
do $$ begin
  alter publication supabase_realtime add table public.pedidos;
exception when duplicate_object then null; end $$;

-- 6) Pasta dos PDFs. Pública para leitura (o link vai na mensagem do WhatsApp;
--    o nome do arquivo é um código aleatório), só aceita PDF de até 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pedidos-pdf', 'pedidos-pdf', true, 2097152, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['application/pdf'];

drop policy if exists "pedidos: landing envia pdf" on storage.objects;
create policy "pedidos: landing envia pdf" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'pedidos-pdf');

drop policy if exists "pedidos: admin apaga pdf" on storage.objects;
create policy "pedidos: admin apaga pdf" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pedidos-pdf' and public.pedidos_is_admin());
