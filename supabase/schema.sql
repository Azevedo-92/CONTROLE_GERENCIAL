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

-- 7) Configurações do painel (ex.: textos de follow-up), compartilhadas entre os sócios.
create table if not exists public.pedidos_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.pedidos_config enable row level security;
drop policy if exists "admin le config" on public.pedidos_config;
drop policy if exists "admin cria config" on public.pedidos_config;
drop policy if exists "admin altera config" on public.pedidos_config;
create policy "admin le config" on public.pedidos_config for select to authenticated using (public.pedidos_is_admin());
create policy "admin cria config" on public.pedidos_config for insert to authenticated with check (public.pedidos_is_admin());
create policy "admin altera config" on public.pedidos_config for update to authenticated using (public.pedidos_is_admin()) with check (public.pedidos_is_admin());
grant select, insert, update on public.pedidos_config to authenticated;
grant select, insert, update, delete on public.pedidos_admins to service_role;
grant select, insert, update, delete on public.pedidos to service_role;
grant select, insert, update, delete on public.pedidos_config to service_role;

-- 8) Promoções (ex.: Black Friday). A landing mostra a promoção no ar e recebe cadastros
--    (nome, WhatsApp, e-mail). Visitantes só leem promoções no período e só criam cadastros nelas.
create table if not exists public.promocoes (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  titulo    text not null check (length(titulo) between 1 and 80),
  chamada   text not null default '' check (length(chamada) <= 300),
  botao     text not null default 'Quero receber as ofertas' check (length(botao) <= 60),
  inicio    date not null,
  fim       date not null,
  ativa     boolean not null default true,
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);
create table if not exists public.promocoes_leads (
  id           uuid primary key default gen_random_uuid(),
  criado_em    timestamptz not null default now(),
  promocao_id  uuid not null references public.promocoes(id) on delete cascade,
  nome         text not null check (length(nome) between 1 and 120),
  telefone     text not null check (length(regexp_replace(telefone, '\D', '', 'g')) between 10 and 13),
  email        text not null check (length(email) <= 160 and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  aceite       boolean not null check (aceite),
  utm          jsonb not null default '{}'::jsonb check (pg_column_size(utm) < 2000),
  contatado_em timestamptz
);
create unique index if not exists promocoes_leads_tel_unico
  on public.promocoes_leads (promocao_id, (regexp_replace(telefone, '\D', '', 'g')));
create index if not exists promocoes_leads_promo on public.promocoes_leads (promocao_id, criado_em desc);

create or replace function public.promo_no_ar(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.promocoes
    where id = p and ativa and (now() at time zone 'America/Sao_Paulo')::date between inicio and fim);
$$;
revoke execute on function public.promo_no_ar(uuid) from public;
grant execute on function public.promo_no_ar(uuid) to anon, authenticated;

alter table public.promocoes enable row level security;
alter table public.promocoes_leads enable row level security;
grant select on public.promocoes to anon;
grant select, insert, update, delete on public.promocoes to authenticated, service_role;
grant insert on public.promocoes_leads to anon;
grant select, insert, update, delete on public.promocoes_leads to authenticated, service_role;

drop policy if exists "landing ve promo no ar" on public.promocoes;
drop policy if exists "admin promocoes" on public.promocoes;
create policy "landing ve promo no ar" on public.promocoes for select to anon using (public.promo_no_ar(id));
create policy "admin promocoes" on public.promocoes for all to authenticated
  using (public.pedidos_is_admin()) with check (public.pedidos_is_admin());

drop policy if exists "landing cadastra na promo" on public.promocoes_leads;
drop policy if exists "admin promocoes leads" on public.promocoes_leads;
create policy "landing cadastra na promo" on public.promocoes_leads for insert to anon
  with check (public.promo_no_ar(promocao_id) and contatado_em is null);
create policy "admin promocoes leads" on public.promocoes_leads for all to authenticated
  using (public.pedidos_is_admin()) with check (public.pedidos_is_admin());

do $$ begin
  alter publication supabase_realtime add table public.promocoes_leads;
exception when duplicate_object then null; end $$;

-- 9) Imagens e criativos das promoções (a primeira é a capa da caixinha).
--    Pasta pública para leitura; só sócios enviam e apagam.
alter table public.promocoes add column if not exists imagens jsonb not null default '[]'::jsonb;
alter table public.promocoes drop constraint if exists promocoes_imagens_check;
alter table public.promocoes add constraint promocoes_imagens_check check (jsonb_typeof(imagens) = 'array' and jsonb_array_length(imagens) <= 12);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promocoes-img', 'promocoes-img', true, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/webp','image/jpeg','image/png'];
drop policy if exists "promocoes: admin envia imagem" on storage.objects;
drop policy if exists "promocoes: admin apaga imagem" on storage.objects;
drop policy if exists "promocoes: admin le imagem" on storage.objects;
create policy "promocoes: admin envia imagem" on storage.objects for insert to authenticated
  with check (bucket_id = 'promocoes-img' and public.pedidos_is_admin());
create policy "promocoes: admin apaga imagem" on storage.objects for delete to authenticated
  using (bucket_id = 'promocoes-img' and public.pedidos_is_admin());
create policy "promocoes: admin le imagem" on storage.objects for select to authenticated
  using (bucket_id = 'promocoes-img' and public.pedidos_is_admin());
