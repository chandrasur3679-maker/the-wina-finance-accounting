-- Jalankan di Supabase > SQL Editor (aman dijalankan berulang)
create table if not exists journal_audit(
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  journal_id uuid not null,
  action text not null, reason text, old_data jsonb,
  changed_by uuid default auth.uid(), changed_at timestamptz default now());
alter table journal_audit enable row level security;
drop policy if exists "audit baca" on journal_audit;
drop policy if exists "audit tambah" on journal_audit;
create policy "audit baca" on journal_audit for select to authenticated
  using (exists (select 1 from units u where u.id = unit_id and u.owner_id = auth.uid()));
create policy "audit tambah" on journal_audit for insert to authenticated
  with check (exists (select 1 from units u where u.id = unit_id and u.owner_id = auth.uid()));
-- sengaja tanpa kebijakan update/delete: catatan audit tidak bisa diubah dari aplikasi

create or replace function edit_journal(
  p_journal uuid, p_date date, p_desc text, p_cat text, p_method text, p_note text,
  p_lines jsonb, p_reason text) returns void language plpgsql as $$
declare j journals%rowtype; td numeric; tc numeric;
begin
  select * into j from journals where id = p_journal;
  if not found then raise exception 'Transaksi tidak ditemukan'; end if;
  if j.status <> 'Posted' then raise exception 'Hanya transaksi berstatus Posted yang bisa diedit'; end if;
  if j.booking_id is not null or exists (select 1 from bookings where journal_id = p_journal) then
    raise exception 'Transaksi reservasi/pelunasan tidak bisa diedit. Gunakan Balik lalu catat ulang.'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'Alasan perubahan wajib diisi'; end if;
  select coalesce(sum((x->>'d')::numeric),0), coalesce(sum((x->>'c')::numeric),0)
    into td, tc from jsonb_array_elements(p_lines) x;
  if td <= 0 or td <> tc then raise exception 'Jurnal tidak seimbang'; end if;
  insert into journal_audit(unit_id, journal_id, action, reason, old_data)
  values (j.unit_id, j.id, 'edit', p_reason, jsonb_build_object(
    'date', j.date, 'descr', j.descr, 'category', j.category, 'method', j.method, 'note', j.note,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('account',account,'debit',debit,'credit',credit,'wallet_id',wallet_id)),'[]'::jsonb)
              from journal_lines where journal_id = j.id)));
  delete from journal_lines where journal_id = j.id;
  insert into journal_lines(journal_id, unit_id, account, debit, credit, wallet_id)
  select j.id, j.unit_id, (x->>'a')::int, (x->>'d')::numeric, (x->>'c')::numeric, nullif(x->>'w','')::uuid
  from jsonb_array_elements(p_lines) x;
  update journals set date = p_date, descr = p_desc, category = p_cat, method = p_method, note = p_note where id = j.id;
end $$;
notify pgrst, 'reload schema';
