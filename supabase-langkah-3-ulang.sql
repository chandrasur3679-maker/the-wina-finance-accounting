-- VERSI AMAN DIJALANKAN BERULANG. Jalankan di Supabase > SQL Editor (seluruh isi, sekali Run)
insert into accounts values (3102,'Modal Saldo Awal','K') on conflict do nothing;

create table if not exists wallets(
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  name text not null, kind text not null check (kind in ('Kas','Bank')),
  acc int not null references accounts(code),
  created_at timestamptz default now(), unique(unit_id,name));
alter table wallets enable row level security;
drop policy if exists "milik unit sendiri" on wallets;
create policy "milik unit sendiri" on wallets for all to authenticated
  using (exists (select 1 from units u where u.id=unit_id and u.owner_id=auth.uid()))
  with check (exists (select 1 from units u where u.id=unit_id and u.owner_id=auth.uid()));

alter table journal_lines add column if not exists wallet_id uuid references wallets(id);
alter table journals add column if not exists booking_id uuid references bookings(id) on delete set null;
alter table bookings add column if not exists total numeric(16,2) not null default 0,
                     add column if not exists paid numeric(16,2) not null default 0;
alter table bookings drop constraint if exists paid_ok;
alter table bookings add constraint paid_ok check (paid >= 0 and paid <= total);

drop function if exists post_journal(uuid,date,text,text,text,text,jsonb,uuid,jsonb);
drop function if exists post_journal(uuid,date,text,text,text,text,jsonb,uuid,jsonb,uuid);
create or replace function post_journal(
  p_unit uuid, p_date date, p_desc text, p_cat text, p_method text, p_note text,
  p_lines jsonb, p_reverses uuid default null, p_booking jsonb default null, p_pay_booking uuid default null)
returns uuid language plpgsql as $$
declare jid uuid; n int; td numeric; tc numeric; rec numeric;
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
notify pgrst, 'reload schema';

-- Pengecekan hasil (harus: wallets terisi nama tabel, fungsi = 1, kolom_bookings = total, paid)
select to_regclass('public.wallets') as wallets,
  (select count(*) from pg_proc where proname='post_journal') as fungsi,
  (select string_agg(column_name,', ') from information_schema.columns
    where table_name='bookings' and column_name in ('total','paid')) as kolom_bookings;
