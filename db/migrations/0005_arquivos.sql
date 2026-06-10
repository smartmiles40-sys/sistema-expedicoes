-- =============================================================================
-- Arquivos: drive pra anexar apólices, bilhetes, documentos pessoais.
-- Pode ser por expedição (categoria) OU por passageiro específico.
-- Os arquivos físicos ficam no Supabase Storage (bucket "arquivos-expedicoes").
-- =============================================================================

do $$ begin
  create type categoria_arquivo as enum (
    'Aéreos',
    'Documentos pessoais',
    'Bilhetes',
    'Vistos',
    'Seguros',
    'Hospedagem',
    'Vouchers',
    'Outros'
  );
exception when duplicate_object then null; end $$;

create table if not exists arquivos (
  id uuid primary key default gen_random_uuid(),
  expedicao_id uuid not null references expedicoes(id) on delete cascade,
  passageiro_id uuid references passageiros(id) on delete cascade,
  categoria categoria_arquivo not null default 'Outros',
  nome text not null,
  descricao text,
  mime text,
  tamanho_bytes bigint,
  storage_path text not null unique,
  uploaded_by uuid references usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_arquivos_expedicao on arquivos(expedicao_id);
create index if not exists idx_arquivos_passageiro on arquivos(passageiro_id);
create index if not exists idx_arquivos_categoria on arquivos(categoria);

drop trigger if exists tg_arquivos_updated_at on arquivos;
create trigger tg_arquivos_updated_at
  before update on arquivos
  for each row execute function set_updated_at();

alter table arquivos enable row level security;

do $$ begin
  create policy "arquivos: leitura autenticado" on arquivos for select
    to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "arquivos: escrita autenticado" on arquivos for all
    to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
