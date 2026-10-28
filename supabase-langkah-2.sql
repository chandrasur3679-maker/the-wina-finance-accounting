-- Jalankan di Supabase > SQL Editor (setelah tabel dari langkah sebelumnya dibuat)
create or replace function post_journal(
  p_unit uuid, p_date date, p_desc text, p_cat text, p_method text, p_note text,
  p_lines jsonb, p_reverses uuid default null, p_booking jsonb default null)
returns uuid language plpgsql as $$
declare jid uuid; n int; td numeric; tc numeric;
begin
  select coalesce(sum((x->>'d')::numeric),0), coalesce(sum((x->>'c')::numeric),0)
    into td, tc from jsonb_array_elements(p_lines) x;
  if td <= 0 or td <> tc then raise exception 'Jurnal tidak seimbang'; end if;
  select count(*)+1 into n from journals where unit_id = p_unit;
  insert into journals(unit_id,no,date,descr,category,method,note,status,reverses)
  values (p_unit,'TRX-'||lpad(n::text,4,'0'),p_date,p_desc,p_cat,p_method,p_note,
          case when p_reverses is null then 'Posted' else 'Pembalikan' end,p_reverses)
  returning id into jid;
  insert into journal_lines(journal_id,unit_id,account,debit,credit)
  select jid,p_unit,(x->>'a')::int,(x->>'d')::numeric,(x->>'c')::numeric from jsonb_array_elements(p_lines) x;
  if p_reverses is not null then
    update journals set status='Dibalik' where id=p_reverses and unit_id=p_unit;
    delete from bookings where journal_id=p_reverses and unit_id=p_unit;
  end if;
  if p_booking is not null then
    insert into bookings(unit_id,room_id,journal_id,guest,check_in,check_out)
    values (p_unit,(p_booking->>'room')::uuid,jid,p_booking->>'guest',(p_booking->>'ci')::date,(p_booking->>'co')::date);
  end if;
  return jid;
end $$;
