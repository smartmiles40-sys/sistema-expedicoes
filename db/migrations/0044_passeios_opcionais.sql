-- 0044_passeios_opcionais.sql
-- Passeios OPCIONAIS oferecidos nos dias livres do roteiro do ExpedAmigo.
-- Cada dia do roteiro pode oferecer até 3 passeios adicionais (foto + descritivo +
-- link do WhatsApp). A COMPRA é marcada manualmente pelo operacional no perfil do
-- passageiro: quando o pax compra, o passeio aparece "confirmado" no lugar do dia
-- livre no portal dele (e some o botão de WhatsApp). Quem não comprou vê a oferta.

-- ---------- Catálogo: passeios opcionais por dia do roteiro ----------
create table if not exists passeios_opcionais (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  roteiro_dia_id uuid not null references roteiro_dias(id) on delete cascade,
  titulo text,                                    -- ex.: "Balonismo na Capadócia"
  descricao text,                                 -- o descritivo do passeio
  foto_arquivo_id uuid references arquivos(id) on delete set null,
  whatsapp_url text,                              -- link "Falar no WhatsApp"
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_passeios_opcionais_exp on passeios_opcionais(expedicao_id, ordem);
create index if not exists idx_passeios_opcionais_dia on passeios_opcionais(roteiro_dia_id, ordem);

drop trigger if exists tg_passeios_opcionais_updated_at on passeios_opcionais;
create trigger tg_passeios_opcionais_updated_at
  before update on passeios_opcionais for each row execute function set_updated_at();

-- ---------- Compras: presença = passageiro comprou o passeio ----------
create table if not exists passeio_opcional_compras (
  id uuid primary key default gen_random_uuid(),
  passageiro_id uuid not null references passageiros(id) on delete cascade,
  passeio_opcional_id uuid not null references passeios_opcionais(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (passageiro_id, passeio_opcional_id)
);
create index if not exists idx_passeio_compras_pax on passeio_opcional_compras(passageiro_id);
create index if not exists idx_passeio_compras_passeio on passeio_opcional_compras(passeio_opcional_id);

-- ---------- RLS: leitura + escrita para autenticado (refinar antes de prod) ----------
do $$
declare t text;
begin
  foreach t in array array['passeios_opcionais','passeio_opcional_compras']
  loop
    execute format('alter table %I enable row level security', t);
    begin
      execute format('create policy "%s: leitura autenticado" on %I for select to authenticated using (true)', t, t);
    exception when duplicate_object then null; end;
    begin
      execute format('create policy "%s: escrita autenticado" on %I for all to authenticated using (true) with check (true)', t, t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
