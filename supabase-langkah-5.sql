-- Jalankan di Supabase > SQL Editor (aman dijalankan berulang)
alter table journals add column if not exists snapshot jsonb;
alter table bookings
  add column if not exists nationality text, add column if not exists id_type text,
  add column if not exists id_number text, add column if not exists phone text,
  add column if not exists email text, add column if not exists pax int,
  add column if not exists id_note text, add column if not exists id_photo text;

create or replace function post_journal(
  p_unit uuid, p_date date, p_desc text, p_cat text, p_method text, p_note text,
  p_lines jsonb, p_reverses uuid default null, p_booking jsonb default null, p_pay_booking uuid default null)
returns uuid language plpgsql as $$
declare jid uuid; n int; td numeric; tc numeric; rec numeric; snap jsonb;
begin
  select coalesce(sum((x->>'d')::numeric),0), coalesce(sum((x->>'c')::numeric),0)
    into td, tc from jsonb_array_elements(p_lines) x;
  if td <= 0 or td <> tc then raise exception 'Jurnal tidak seimbang'; end if;
  select count(*)+1 into n from journals where unit_id = p_unit;
  insert into journals(unit_id,no,date,descr,category,method,note,status,reverses,booking_id)
  values (p_unit,'TRX-'||lpad(n::text,4,'0'),p_date,p_desc,p_cat,p_method,p_note,
          case when p_reverses is null then 'Posted' else 'Pembalikan' end,p_reverses,p_pay_booking)
  returning id into jid;
  insert into journal_lines(journal_id,unit_id,account,debit,credit,wallet_id)
  select jid,p_unit,(x->>'a')::int,(x->>'d')::numeric,(x->>'c')::numeric,nullif(x->>'w','')::uuid
  from jsonb_array_elements(p_lines) x;
  if p_reverses is not null then
    select to_jsonb(b) into snap from bookings b where b.journal_id = p_reverses and b.unit_id = p_unit;
    if snap is not null then update journals set snapshot = snap where id = jid; end if;
    update bookings set paid = paid - coalesce((select sum(credit) from journal_lines
      where journal_id=p_reverses and account=1103),0)
      where id=(select booking_id from journals where id=p_reverses) and unit_id=p_unit;
    update journals set status='Dibalik' where id=p_reverses and unit_id=p_unit;
    delete from bookings where journal_id=p_reverses and unit_id=p_unit;
  end if;
  if p_pay_booking is not null then
    select coalesce(sum(credit),0) into rec from journal_lines where journal_id=jid and account=1103;
    update bookings set paid = paid + rec where id=p_pay_booking and unit_id=p_unit;
    if not found then raise exception 'Reservasi tidak ditemukan'; end if;
  end if;
  if p_booking is not null then
    insert into bookings(unit_id,room_id,journal_id,guest,check_in,check_out,total,paid)
    values (p_unit,(p_booking->>'room')::uuid,jid,p_booking->>'guest',(p_booking->>'ci')::date,
            (p_booking->>'co')::date,coalesce((p_booking->>'total')::numeric,0),coalesce((p_booking->>'paid')::numeric,0));
  end if;
  return jid;
end $$;

create or replace function undo_reversal(p_journal uuid) returns void language plpgsql as $$
declare r journals%rowtype; o journals%rowtype; b jsonb;
begin
  select * into r from journals where id = p_journal;
  if not found or r.status <> 'Pembalikan' or r.reverses is null then
    raise exception 'Hanya jurnal pembalik yang bisa dibatalkan'; end if;
  select * into o from journals where id = r.reverses;
  if not found or o.status <> 'Dibalik' then raise exception 'Transaksi asli tidak berstatus Dibalik'; end if;
  if o.booking_id is not null then
    update bookings set paid = paid + coalesce((select sum(credit) from journal_lines
      where journal_id = o.id and account = 1103),0) where id = o.booking_id;
  end if;
  b := r.snapshot;
  if b is not null then
    insert into bookings(id,unit_id,room_id,journal_id,guest,check_in,check_out,total,paid,
      nationality,id_type,id_number,phone,email,pax,id_note,id_photo)
    values ((b->>'id')::uuid,(b->>'unit_id')::uuid,(b->>'room_id')::uuid,o.id,b->>'guest',
      (b->>'check_in')::date,(b->>'check_out')::date,(b->>'total')::numeric,(b->>'paid')::numeric,
      b->>'nationality',b->>'id_type',b->>'id_number',b->>'phone',b->>'email',(b->>'pax')::int,b->>'id_note',b->>'id_photo');
  end if;
  delete from journal_lines where journal_id = r.id;
  update journals set status = 'Dihapus', note = coalesce(note,'') || ' | Pembalikan dibatalkan' where id = r.id;
  update journals set status = 'Posted' where id = o.id;
end $$;

-- Penyimpanan foto identitas (privat)
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('guest-ids','guest-ids',false,5242880,array['image/jpeg'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "guest-ids milik unit sendiri" on storage.objects;
create policy "guest-ids milik unit sendiri" on storage.objects for all to authenticated
  using (bucket_id = 'guest-ids' and exists (select 1 from public.units u
    where u.id::text = (storage.foldername(name))[1] and u.owner_id = auth.uid()))
  with check (bucket_id = 'guest-ids' and exists (select 1 from public.units u
    where u.id::text = (storage.foldername(name))[1] and u.owner_id = auth.uid()));
notify pgrst, 'reload schema';
