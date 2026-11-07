-- Jalankan di Supabase > SQL Editor (aman dijalankan berulang)
create or replace function delete_journal(p_journal uuid, p_reason text)
returns void language plpgsql as $$
declare j journals%rowtype; amt numeric; bk uuid;
begin
  select * into j from journals where id = p_journal;
  if not found then raise exception 'Transaksi tidak ditemukan'; end if;
  if j.status <> 'Posted' then
    raise exception 'Hanya transaksi berstatus Posted yang bisa dihapus. Gunakan Balik untuk transaksi lain.'; end if;
  select id into bk from bookings where journal_id = p_journal;
  if bk is not null and exists (select 1 from journals where booking_id = bk and status = 'Posted') then
    raise exception 'Reservasi ini sudah punya pelunasan. Hapus dulu transaksi pelunasannya.'; end if;
  select coalesce(sum(debit),0) into amt from journal_lines where journal_id = p_journal;
  if j.booking_id is not null then
    update bookings set paid = paid - coalesce((select sum(credit) from journal_lines
      where journal_id = p_journal and account = 1103),0) where id = j.booking_id;
  end if;
  delete from bookings where journal_id = p_journal;
  delete from journal_lines where journal_id = p_journal;
  update journals set status = 'Dihapus',
    note = coalesce(note,'') || ' | Dihapus: ' || coalesce(nullif(p_reason,''),'-') || ' (nominal ' || amt || ')'
  where id = p_journal;
end $$;
notify pgrst, 'reload schema';
