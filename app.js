const ACC={1101:['Kas','D'],1102:['Bank','D'],1103:['Piutang Usaha','D'],1104:['Persediaan','D'],1201:['Aset Tetap','D'],1202:['Akumulasi Penyusutan','K'],2101:['Utang Usaha','K'],2102:['Uang Muka Pelanggan','K'],3101:['Modal','K'],3102:['Modal Saldo Awal','K'],4101:['Pendapatan Kamar','K'],5101:['Beban Operasional','D'],5102:['Beban Penyusutan','D']};
const CATS=['Pendapatan Lain','Beban Operasional','Pembelian Aset','Uang Muka Pelanggan','Pelunasan Piutang','Pembayaran Utang','Transfer Antar Rekening','Setoran Modal / Saldo Awal','Penyusutan','Lainnya'];
const ROOMS=['Kamar 1','Kamar 2','Kamar 3','Kamar 4','Kamar 5','Kamar 6'];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const Rp=n=>(n<0?'-':'')+'Rp '+Math.abs(Math.round(n)).toLocaleString('id-ID');
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
let pre=null,S,cur,view='home',calM=new Date(),calRoom=ROOMS[0],hf={q:'',m:'',c:'',asc:false};

S={units:[],d:{}};
const rooms=()=>D().rooms??=ROOMS.slice(0,4);
const save=()=>{};
const ROOMS0=null;const D=()=>S.d[cur]??={j:[],b:[],n:0};
const show=id=>{['login','units','app'].forEach(x=>$('#'+x).classList.toggle('hide',x!==id))};

// ---------- login ----------
$('#eye').onclick=()=>{const p=$('#pw');p.type=p.type==='password'?'text':'password'};
$('#lbtn').onclick=async()=>{
  $('#lerr').textContent='';$('#lbtn').disabled=true;
  const{error}=await db.auth.signInWithPassword({email:OWNER_EMAIL,password:$('#pw').value});
  $('#lbtn').disabled=false;
  if(error)return $('#lerr').textContent='Kata sandi salah atau koneksi bermasalah.';
  $('#pw').value='';openUnits();
};
$('#pw').onkeydown=e=>{if(e.key==='Enter')$('#lbtn').click()};
$('#lo1').onclick=$('#blo').onclick=async()=>{await db.auth.signOut();S.d={};show('login')};
$('#bset').onclick=async()=>{const p=prompt('Kata sandi baru (min. 6 karakter):');if(!p)return;if(p.length<6)return alert('Terlalu pendek.');const{error}=await db.auth.updateUser({password:p});alert(error?error.message:'Kata sandi diganti.')};

// ---------- units ----------
async function openUnits(){
  show('units');const{data,error}=await db.from('units').select('id,name,info').order('created_at');if(error)return alert(error.message);S.units=data;$('#ulist').innerHTML=S.units.map(u=>`<div class="unit glass" data-id="${u.id}"><div class="ic">🏡</div><h3>${esc(u.name)}</h3><small style="color:var(--mu)">${esc(u.info||'Unit usaha')}</small></div>`).join('')+`<div class="unit add glass" id="addu"><div class="ic">＋</div><h3>Tambah Unit Usaha Baru</h3></div>`;
  document.querySelectorAll('.unit[data-id]').forEach(el=>el.onclick=()=>{el.classList.add('go');setTimeout(()=>enter(el.dataset.id),550)});
  $('#addu').onclick=async()=>{const n=prompt('Nama unit usaha:');if(!n||!n.trim())return;const i=prompt('Informasi dasar (alamat/keterangan, opsional):')||'';
    const{data,error}=await db.from('units').insert({name:n.trim(),info:i.trim()}).select().single();if(error)return alert(error.message);
    await db.from('rooms').insert(['Kamar 1','Kamar 2','Kamar 3','Kamar 4'].map(x=>({unit_id:data.id,name:x})));openUnits()};
}
async function enter(id){cur=id;try{await loadUnit(id)}catch(e){alert('Gagal memuat data: '+e.message);return}show('app');const a=$('#app');a.classList.remove('enter');void a.offsetWidth;a.classList.add('enter');
  $('#hu').textContent=S.units.find(u=>u.id===id).name;
  $('#hd').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  nav('home')}
$('#bsw').onclick=openUnits;

// ---------- accounting ----------
const bal=a=>D().j.reduce((s,j)=>s+j.l.reduce((t,l)=>t+(l.a==a?l.d-l.c:0),0),0);
const disp=a=>ACC[a][1]==='K'?-bal(a):bal(a);
const accSel=(id)=>`<select id="${id}">${Object.entries(ACC).map(([k,v])=>`<option value="${k}">${k} · ${v[0]}</option>`).join('')}</select>`;
const mk=w=>w&&w.kind==='Bank'?'Bank':'Tunai';
const wbal=id=>D().j.reduce((s,j)=>s+j.l.reduce((t,l)=>t+(l.w===id?l.d-l.c:0),0),0);
const wsel=id=>`<select id="${id}">${D().w.map(x=>`<option value="${x.id}">${esc(x.name)} (${Rp(wbal(x.id))})</option>`).join('')}</select>`;
async function loadUnit(id){
  let w=await db.from('wallets').select('id,name,kind,acc').eq('unit_id',id).order('created_at');
  if(w.error)throw w.error;
  if(!w.data.length){const i=await db.from('wallets').insert([{unit_id:id,name:'Kas Tunai',kind:'Kas',acc:1101},{unit_id:id,name:'Rekening Bank',kind:'Bank',acc:1102}]).select();if(i.error)throw i.error;w={data:i.data}}
  const[r,j,b]=await Promise.all([
    db.from('rooms').select('id,name').eq('unit_id',id).order('name'),
    db.from('journals').select('*, journal_lines(account,debit,credit,wallet_id)').eq('unit_id',id).order('created_at'),
    db.from('bookings').select('id,room_id,journal_id,guest,check_in,check_out,total,paid').eq('unit_id',id)]);
  const err=r.error||j.error||b.error;if(err)throw err;
  const nm={};r.data.forEach(x=>nm[x.id]=x.name);
  S.d[id]={n:j.data.length,w:w.data,rooms:r.data.map(x=>x.name),rid:Object.fromEntries(r.data.map(x=>[x.name,x.id])),
    j:j.data.map(x=>({id:x.id,no:x.no,date:x.date,desc:x.descr,cat:x.category,method:x.method,note:x.note,st:x.status,l:x.journal_lines.map(l=>({a:l.account,d:+l.debit,c:+l.credit,w:l.wallet_id}))})),
    b:b.data.map(x=>({id:x.id,room:nm[x.room_id],ci:x.check_in,co:x.check_out,guest:x.guest||'',total:+x.total,paid:+x.paid}))};
}
async function post(date,desc,cat,lines,method,note,extra={}){
  const td=lines.reduce((s,l)=>s+l.d,0),tc=lines.reduce((s,l)=>s+l.c,0);
  if(!lines.length||td<=0||Math.abs(td-tc)>0.005)throw new Error('Jurnal tidak seimbang: debit '+Rp(td)+' ≠ kredit '+Rp(tc));
  const{error}=await db.rpc('post_journal',{p_unit:cur,p_date:date,p_desc:desc,p_cat:cat,p_method:method,p_note:note||'',p_lines:lines,p_reverses:extra.reverses||null,p_booking:extra.booking||null,p_pay_booking:extra.payBooking||null});
  if(error)throw new Error(error.code==='23P01'?'Kamar sudah dipesan pada tanggal tersebut.':error.code==='23514'?'Nominal pembayaran melebihi sisa tagihan.':error.message);
  await loadUnit(cur);
}

// ---------- navigation ----------
function nav(v){view=v;document.querySelectorAll('nav.foot button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));({home,hist,trx,room,cal,wal,piu,lap}[v])();window.scrollTo(0,0)}
document.querySelectorAll('nav.foot button').forEach(b=>b.onclick=()=>nav(b.dataset.v));

// ---------- home ----------
function home(){
  const m=today().slice(0,7),d=D();
  let pen=0,beb=0;d.j.filter(j=>j.date.startsWith(m)).forEach(j=>j.l.forEach(l=>{const a=String(l.a);if(a[0]=='4')pen+=l.c-l.d;if(a[0]=='5')beb+=l.d-l.c}));
  const tot=[1101,1102,1103,1104,1201,1202].reduce((s,a)=>s+bal(a),0);
  const tb=Object.keys(ACC).map(a=>[a,bal(a)]).filter(x=>Math.abs(x[1])>0.004);
  $('#main').innerHTML=`
  <div class="panel glass"><div style="display:flex;justify-content:space-between;align-items:center"><h2>Ringkasan Aset</h2><button class="btn sm" id="ta">💰 Lihat Aset</button></div>
    <div id="ad" class="hide" style="margin-top:12px"><div class="stat" style="margin-bottom:10px">Total Aset<b style="font-size:22px">${Rp(tot)}</b></div>
    <div class="grid">${[['Kas',1101],['Bank',1102],['Piutang',1103],['Persediaan',1104]].map(x=>`<div class="stat">${x[0]}<b>${Rp(bal(x[1]))}</b></div>`).join('')}
    <div class="stat">Aset Tetap (perolehan)<b>${Rp(bal(1201))}</b></div><div class="stat">Akum. Penyusutan<b>${Rp(bal(1202))}</b></div><div class="stat">Nilai Buku Aset Tetap<b>${Rp(bal(1201)+bal(1202))}</b></div></div>
    <button class="btn sec sm" id="ca" style="margin-top:10px">Tutup</button></div></div>
  <div class="panel glass" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-go="wal">🏦 Rekening & Saldo</button><button class="btn sec" data-go="piu">🧾 Piutang Reservasi</button><button class="btn sec" data-go="lap">📊 Laporan</button></div>
  <div class="panel glass"><h2>Bulan Ini</h2><div class="grid" style="margin-top:10px"><div class="stat">Pendapatan<b>${Rp(pen)}</b></div><div class="stat">Beban<b>${Rp(beb)}</b></div><div class="stat">Laba / Rugi<b style="color:${pen-beb<0?'var(--er)':'var(--ok)'}">${Rp(pen-beb)}</b></div><div class="stat">Piutang<b>${Rp(bal(1103))}</b></div></div></div>
  <div class="panel glass"><h2>Neraca Saldo</h2><div class="scroll"><table><tr><th>Akun</th><th class="r">Debit</th><th class="r">Kredit</th></tr>
  ${tb.map(([a,b])=>`<tr><td>${a} · ${ACC[a][0]}</td><td class="r">${b>0?Rp(b):''}</td><td class="r">${b<0?Rp(-b):''}</td></tr>`).join('')||'<tr><td colspan=3 style="color:var(--mu)">Belum ada transaksi. Mulai dari menu Transaksi atau Kamar.</td></tr>'}
  </table></div></div>
  <div style="text-align:center"><button class="btn sec sm" id="th">🌓 Ganti tema</button></div>`;
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go));$('#ta').onclick=()=>$('#ad').classList.remove('hide');$('#ca').onclick=()=>$('#ad').classList.add('hide');
  $('#th').onclick=()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==='light'?'dark':'light'};
}

// ---------- input transaksi ----------
function trx(){
  $('#main').innerHTML=`<div class="panel glass"><h2>Input Transaksi</h2><p style="color:var(--mu);font-size:13px;margin:4px 0 0">Unit: <b>${esc($('#hu').textContent)}</b> · setiap jurnal otomatis seimbang (debit = kredit)</p>
  <div class="row2"><div><label>Tanggal</label><input type="date" id="t_d" value="${today()}"></div><div><label>Kategori</label><select id="t_c">${CATS.map(c=>`<option>${c}</option>`).join('')}</select></div></div>
  <label>Deskripsi transaksi</label><input id="t_n" placeholder="mis. Beli perlengkapan kamar">
  <div class="row2"><div><label>Akun debit</label>${accSel('t_a')}</div><div><label>Akun kredit</label>${accSel('t_b')}</div></div>
  <div class="row2"><div><label>Nominal (Rp)</label><input type="number" id="t_v" min="0" inputmode="numeric"></div><div><label>Rekening kas/bank (jika akun kas/bank dipakai)</label>${wsel('t_w')}</div></div>
  <label>Keterangan tambahan</label><textarea id="t_k" rows="2"></textarea>
  <div class="err" id="tm"></div>
  <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="ts">Simpan & Posting</button><button class="btn sec" id="tc">Batal</button></div></div>`;
  $('#t_a').value=1101;$('#t_b').value=4101;
  $('#tc').onclick=()=>nav('home');
  $('#ts').onclick=async()=>{const m=$('#tm'),v=+$('#t_v').value,a=+$('#t_a').value,b=+$('#t_b').value,n=$('#t_n').value.trim();m.className='err';
    if(!$('#t_d').value)return m.textContent='Tanggal wajib diisi.';
    if(!n)return m.textContent='Deskripsi wajib diisi.';
    if(!(v>0))return m.textContent='Nominal harus lebih dari nol.';
    if(a===b)return m.textContent='Akun debit dan kredit tidak boleh sama.';
    const cb=x=>x==1101||x==1102,wv=$('#t_w').value,wo=D().w.find(x=>x.id===wv);
    if(cb(a)&&cb(b))return m.textContent='Perpindahan antar kas/bank dicatat lewat menu Rekening & Saldo (Transfer).';
    if((cb(a)||cb(b))&&(!wo||wo.acc!=(cb(a)?a:b)))return m.textContent='Pilih rekening yang sesuai dengan akun Kas/Bank yang dipakai.';
    if(!confirm('Posting transaksi sebesar '+Rp(v)+'?'))return;
    try{await post($('#t_d').value,n,$('#t_c').value,[{a,d:v,c:0,w:cb(a)?wv:null},{a:b,d:0,c:v,w:cb(b)?wv:null}],cb(a)||cb(b)?mk(wo):'Lainnya',$('#t_k').value);m.className='err okm';m.textContent='✔ Transaksi berhasil diposting.';$('#t_n').value='';$('#t_v').value=''}catch(e){m.textContent=e.message}};
}

// ---------- riwayat ----------
function hist(){
  $('#main').innerHTML=`<div class="panel glass"><h2>Riwayat Transaksi</h2>
  <div class="row2"><div><input id="h_q" placeholder="Cari deskripsi / nomor / akun" value="${esc(hf.q)}"></div><div><select id="h_c"><option value="">Semua kategori</option>${CATS.concat(['Pendapatan Kamar','Koreksi','Saldo Awal']).map(c=>`<option ${hf.c===c?'selected':''}>${c}</option>`).join('')}</select></div></div>
  <div class="row2" style="margin-top:6px"><select id="h_m"><option value="">Semua metode</option>${['Tunai','Bank','Lainnya'].map(c=>`<option ${hf.m===c?'selected':''}>${c}</option>`).join('')}</select><button class="btn sec" id="h_s">Urutan: ${hf.asc?'Terlama ↑':'Terbaru ↓'}</button></div>
  <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="h_d" style="width:auto;margin:0" ${hf.del?'checked':''}>Tampilkan transaksi yang dihapus</label><div class="scroll" style="margin-top:10px" id="h_t"></div></div>`;
  const draw=()=>{const q=hf.q.toLowerCase();
    let L=D().j.filter(j=>(hf.del||j.st!=='Dihapus')&&(!hf.c||j.cat===hf.c)&&(!hf.m||j.method===hf.m)&&(!q||(j.desc+j.no+j.l.map(l=>ACC[l.a][0]).join(' ')).toLowerCase().includes(q)));
    L.sort((a,b)=>(a.date+a.id).localeCompare(b.date+b.id)*(hf.asc?1:-1));
    $('#h_t').innerHTML=`<table><tr><th>Tanggal / No</th><th>Deskripsi & Akun</th><th class="r">Debit</th><th class="r">Kredit</th><th>Status</th></tr>`+(L.map(j=>`<tr><td>${j.date}<br><small>${j.no}</small></td><td>${esc(j.desc)}<br><small style="color:var(--mu)">${esc(j.cat)} · ${esc(j.method)}${j.note?' · '+esc(j.note):''}</small><br>${j.l.map(l=>`<small>${l.d?'Dr':'&nbsp;&nbsp;Kr'} ${ACC[l.a][0]}</small>`).join('<br>')}</td><td class="r">${Rp(j.l.reduce((s,l)=>s+l.d,0))}</td><td class="r">${Rp(j.l.reduce((s,l)=>s+l.c,0))}</td><td><span class="tag">${j.st}</span>${j.st==='Posted'?`<br><button class="btn sec sm" data-r="${j.id}" style="margin-top:6px">Balik</button> <button class="btn sec sm" data-x="${j.id}" style="margin-top:6px">Hapus</button>`:''}</td></tr>`).join('')||'<tr><td colspan=5 style="color:var(--mu)">Tidak ada transaksi.</td></tr>')+'</table>';
    document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>reverse(b.dataset.r));document.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>hapus(b.dataset.x));};
  $('#h_q').oninput=e=>{hf.q=e.target.value;draw()};$('#h_c').onchange=e=>{hf.c=e.target.value;draw()};$('#h_m').onchange=e=>{hf.m=e.target.value;draw()};$('#h_d').onchange=e=>{hf.del=e.target.checked;draw()};
  $('#h_s').onclick=()=>{hf.asc=!hf.asc;hist()};draw();
}
async function hapus(id){const o=D().j.find(j=>j.id===id);
  if(!o||!confirm('HAPUS transaksi '+o.no+' ('+o.desc+')?\nNilainya dikeluarkan dari semua saldo dan laporan. Catatan penghapusan tetap tersimpan.'))return;
  const alasan=prompt('Alasan menghapus (wajib):');if(!alasan||!alasan.trim())return alert('Alasan wajib diisi.');
  const{error}=await db.rpc('delete_journal',{p_journal:id,p_reason:alasan.trim()});
  if(error)return alert(error.message);
  await loadUnit(cur);hist()}
async function reverse(id){const o=D().j.find(j=>j.id===id);if(!o||!confirm('Buat jurnal pembalik untuk '+o.no+'? Transaksi asli tetap tersimpan sebagai jejak audit.'))return;
  const alasan=prompt('Alasan koreksi:')||'-';
  try{await post(today(),'Pembalikan '+o.no+': '+o.desc,'Koreksi',o.l.map(l=>({a:l.a,d:l.c,c:l.d})),o.method,'Alasan: '+alasan,{reverses:id})}catch(e){alert(e.message)}
  hist()}

// ---------- pendapatan kamar ----------
function room(){
  $('#main').innerHTML=`<div class="panel glass"><h2>Pendapatan Kamar</h2>
  <div class="row2"><div><label>Tanggal transaksi</label><input type="date" id="r_d" value="${today()}"></div><div><label>Kamar</label><select id="r_r">${rooms().map(r=>`<option>${esc(r)}</option>`).join('')}</select></div></div>
  <label>Nama tamu / kode reservasi</label><input id="r_g">
  <div class="row2"><div><label>Check-in</label><input type="date" id="r_i" value="${today()}"></div><div><label>Check-out</label><input type="date" id="r_o"></div></div>
  <div class="row2"><div><label>Tarif per malam (Rp)</label><input type="number" id="r_t" min="0"></div><div><label>Diskon (Rp)</label><input type="number" id="r_x" min="0" value="0"></div></div>
  <div class="stat" style="margin-top:10px">Jumlah malam: <b id="r_n" style="display:inline">0</b> · Total pendapatan: <b id="r_tot" style="display:inline">Rp 0</b></div>
  <div class="row2"><div><label>Status pembayaran</label><select id="r_s"><option>Lunas</option><option>DP / Sebagian</option><option>Belum bayar</option></select></div><div><label>Dibayar (Rp)</label><input type="number" id="r_p" min="0" value="0"></div></div>
  <div class="row2"><div><label>Diterima di rekening</label>${wsel('r_m')}</div><div><label>Sumber pemesanan</label><select id="r_src"><option>Langsung</option><option>OTA</option><option>Lainnya</option></select></div></div>
  <label>Catatan</label><input id="r_k">
  <div class="stat" style="margin-top:10px">Saldo piutang: <b id="r_pi" style="display:inline">Rp 0</b></div>
  <div class="err" id="rm"></div><button class="btn" id="rs">Simpan Pendapatan</button></div>`;
  const calc=()=>{const n=Math.round((new Date($('#r_o').value)-new Date($('#r_i').value))/864e5)||0;const tot=Math.max(0,n*(+$('#r_t').value||0)-(+$('#r_x').value||0));
    const st=$('#r_s').value;if(st==='Lunas')$('#r_p').value=tot;if(st==='Belum bayar')$('#r_p').value=0;
    $('#r_n').textContent=n;$('#r_tot').textContent=Rp(tot);$('#r_pi').textContent=Rp(tot-(+$('#r_p').value||0));return{n,tot}};
  ['r_i','r_o','r_t','r_x','r_s','r_p'].forEach(i=>$('#'+i).oninput=calc);$('#r_s').onchange=calc;if(pre){$('#r_r').value=pre.room;$('#r_i').value=pre.ci;pre=null}
  $('#rs').onclick=async()=>{const{n,tot}=calc(),m=$('#rm'),p=+$('#r_p').value||0,rm=$('#r_r').value,ci=$('#r_i').value,co=$('#r_o').value;m.className='err';
    if(n<=0)return m.textContent='Check-out harus setelah check-in.';
    if(!(tot>0))return m.textContent='Total pendapatan harus lebih dari nol.';
    if(p<0||p>tot)return m.textContent='Nominal dibayar tidak valid (0 sampai total).';
    const clash=D().b.find(b=>b.room===rm&&ci<b.co&&co>b.ci);
    if(clash)return m.textContent=`Bentrok! ${rm} sudah dipesan ${clash.ci} s/d ${clash.co} (${clash.guest||'tanpa nama'}).`;
    const bk='B'+Date.now(),wo=D().w.find(x=>x.id===$('#r_m').value),pay=wo.acc,L=[];
    if(p>0)L.push({a:pay,d:p,c:0,w:wo.id});if(tot-p>0)L.push({a:1103,d:tot-p,c:0});L.push({a:4101,d:0,c:tot});
    try{await post($('#r_d').value,`Kamar ${rm} – ${$('#r_g').value||'tamu'} (${n} malam, ${$('#r_src').value})`,'Pendapatan Kamar',L,mk(wo),$('#r_k').value,{booking:{room:D().rid[rm],guest:$('#r_g').value.trim(),ci,co,total:tot,paid:p}});m.className='err okm';m.textContent='✔ Tersimpan. Kalender kamar sudah diperbarui.'}catch(e){m.textContent=e.message}};
}

// ---------- kalender ----------
function cal(){
  const y=calM.getFullYear(),mo=calM.getMonth(),days=new Date(y,mo+1,0).getDate(),R=rooms(),B=D().b,t=today();
  const iso=d=>`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,wd=['Mi','Se','Sl','Ra','Ka','Ju','Sa'];
  let g=`<div class="tl" style="grid-template-columns:120px repeat(${days},40px)"><div class="rn hd">Kamar</div>`;
  for(let d=1;d<=days;d++)g+=`<div class="dh${iso(d)===t?' td':''}"><small>${wd[new Date(y,mo,d).getDay()]}</small>${d}</div>`;
  R.forEach((r,ri)=>{g+=`<div class="rn"><span>${esc(r)}</span><button data-del="${ri}" title="Hapus kamar">✕</button></div>`;
    for(let d=1;d<=days;d++){const i=iso(d),b=B.find(b=>b.room===r&&i>=b.ci&&i<b.co);
      g+=b?`<div class="cl bk" data-b="${b.id}">${i===b.ci||d===1?esc((b.guest||'•').slice(0,6)):''}</div>`:`<div class="cl" data-r="${ri}" data-d="${i}"></div>`}});
  g+='</div>';
  const mb=B.filter(b=>b.ci<=iso(days)&&b.co>iso(1)).sort((a,b)=>a.ci.localeCompare(b.ci));
  $('#main').innerHTML=`<div class="panel glass"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h2>Kalender Ketersediaan</h2><button class="btn sm" id="c_a">＋ Tambah Kamar</button></div>
  <div style="display:flex;gap:6px;align-items:center;justify-content:center;margin:12px 0"><button class="btn sec sm" id="c_p">◀</button><b style="min-width:150px;text-align:center">${calM.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</b><button class="btn sec sm" id="c_n">▶</button></div>
  <div class="scroll">${R.length?g:'<p style="color:var(--mu)">Belum ada kamar. Tekan “Tambah Kamar”.</p>'}</div>
  <p style="font-size:12px;color:var(--mu)">Blok hijau = terisi · blok kosong = tersedia (ketuk untuk membuat reservasi) · hari check-out dianggap tersedia.</p>
  <h3 style="font-size:14px">Reservasi bulan ini</h3>${mb.map(b=>`<div class="stat" style="margin-top:6px">${esc(b.room)} · ${b.ci} → ${b.co} · ${esc(b.guest||'-')}</div>`).join('')||'<small style="color:var(--mu)">Belum ada reservasi.</small>'}</div>`;
  $('#c_p').onclick=()=>{calM=new Date(y,mo-1,1);cal()};$('#c_n').onclick=()=>{calM=new Date(y,mo+1,1);cal()};
  $('#c_a').onclick=async()=>{const n=(prompt('Nama kamar baru:')||'').trim();if(!n)return;if(R.includes(n))return alert('Nama kamar sudah ada.');const{error}=await db.from('rooms').insert({unit_id:cur,name:n});if(error)return alert(error.message);await loadUnit(cur);cal()};
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const r=R[+b.dataset.del];if(B.some(x=>x.room===r))return alert('Kamar masih punya reservasi, tidak bisa dihapus.');if(confirm('Hapus '+r+'?')){const{error}=await db.from('rooms').delete().eq('id',D().rid[r]);if(error)return alert(error.message);await loadUnit(cur);cal()}});
  document.querySelectorAll('.cl.bk').forEach(c=>c.onclick=()=>{const b=B.find(x=>x.id===c.dataset.b);alert(`${b.room}\nTamu: ${b.guest||'-'}\nCheck-in: ${b.ci}\nCheck-out: ${b.co}`)});
  document.querySelectorAll('.cl[data-r]').forEach(c=>c.onclick=()=>{pre={room:R[+c.dataset.r],ci:c.dataset.d};nav('room')});
}
// ---------- rekening, transfer, saldo awal ----------
function wal(){
  const W=D().w,un=[1101,1102].map(a=>[a,bal(a)-W.filter(x=>x.acc===a).reduce((s,x)=>s+wbal(x.id),0)]).filter(x=>Math.abs(x[1])>.004);
  const opt=Object.entries(ACC).filter(([k])=>k<3000).map(([k,v])=>`<option value="${k}">${k} · ${v[0]}</option>`).join('');
  $('#main').innerHTML=`
  <div class="panel glass"><h2>Rekening Kas & Bank</h2><div class="scroll"><table><tr><th>Rekening</th><th>Jenis</th><th class="r">Saldo</th></tr>
  ${W.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.kind}</td><td class="r">${Rp(wbal(x.id))}</td></tr>`).join('')}
  ${un.map(x=>`<tr><td colspan=2 style="color:var(--mu)">Belum dialokasikan (${ACC[x[0]][0]})</td><td class="r">${Rp(x[1])}</td></tr>`).join('')}</table></div>
  <div class="row2"><div><label>Nama rekening baru</label><input id="w_n" placeholder="mis. BCA Operasional"></div><div><label>Jenis</label><select id="w_k"><option>Bank</option><option>Kas</option></select></div></div>
  <div class="err" id="wm1"></div><button class="btn sm" id="w_a">＋ Tambah Rekening</button></div>
  <div class="panel glass"><h2>Transfer Antar Rekening</h2>
  <div class="row2"><div><label>Tanggal</label><input type="date" id="x_d" value="${today()}"></div><div><label>Nominal (Rp)</label><input type="number" id="x_v" min="0"></div></div>
  <div class="row2"><div><label>Dari rekening</label>${wsel('x_f')}</div><div><label>Ke rekening</label>${wsel('x_t')}</div></div>
  <label>Keterangan</label><input id="x_k"><div class="err" id="wm2"></div><button class="btn" id="x_b">Transfer</button></div>
  <div class="panel glass"><h2>Saldo Awal</h2><p style="color:var(--mu);font-size:13px;margin:4px 0 0">Dicatat sebagai Modal Saldo Awal, bukan pendapatan.</p>
  <div class="row2"><div><label>Tanggal</label><input type="date" id="s_d" value="${today()}"></div><div><label>Akun</label><select id="s_a">${opt}</select></div></div>
  <div class="row2"><div><label>Rekening (khusus Kas/Bank)</label>${wsel('s_w')}</div><div><label>Nominal (Rp)</label><input type="number" id="s_v" min="0"></div></div>
  <div class="err" id="wm3"></div><button class="btn" id="s_b">Simpan Saldo Awal</button></div>`;
  const ok=(id,t)=>{$(id).className='err okm';$(id).textContent=t};
  $('#w_a').onclick=async()=>{const n=$('#w_n').value.trim(),k=$('#w_k').value,m=$('#wm1');m.className='err';if(!n)return m.textContent='Nama rekening wajib diisi.';
    const{error}=await db.from('wallets').insert({unit_id:cur,name:n,kind:k,acc:k==='Bank'?1102:1101});if(error)return m.textContent=error.code==='23505'?'Nama rekening sudah ada.':error.message;await loadUnit(cur);wal()};
  $('#x_b').onclick=async()=>{const m=$('#wm2'),f=D().w.find(x=>x.id===$('#x_f').value),t=D().w.find(x=>x.id===$('#x_t').value),v=+$('#x_v').value;m.className='err';
    if(!f||!t||f.id===t.id)return m.textContent='Pilih dua rekening yang berbeda.';
    if(!(v>0))return m.textContent='Nominal harus lebih dari nol.';
    if(v>wbal(f.id))return m.textContent='Saldo '+f.name+' tidak cukup ('+Rp(wbal(f.id))+').';
    if(!confirm(`Transfer ${Rp(v)} dari ${f.name} ke ${t.name}?`))return;
    try{await post($('#x_d').value,`Transfer ${f.name} → ${t.name}`,'Transfer Antar Rekening',[{a:t.acc,d:v,c:0,w:t.id},{a:f.acc,d:0,c:v,w:f.id}],mk(t),$('#x_k').value);wal();ok('#wm2','✔ Transfer berhasil.')}catch(e){m.textContent=e.message}};
  $('#s_b').onclick=async()=>{const m=$('#wm3'),a=+$('#s_a').value,v=+$('#s_v').value,cb=a==1101||a==1102,wo=D().w.find(x=>x.id===$('#s_w').value);m.className='err';
    if(!(v>0))return m.textContent='Nominal harus lebih dari nol.';
    if(cb&&(!wo||wo.acc!==a))return m.textContent='Pilih rekening yang sesuai dengan akun Kas/Bank.';
    if(!confirm(`Catat saldo awal ${ACC[a][0]} sebesar ${Rp(v)}?`))return;
    const L=ACC[a][1]==='D'?[{a,d:v,c:0,w:cb?wo.id:null},{a:3102,d:0,c:v}]:[{a:3102,d:v,c:0},{a,d:0,c:v}];
    try{await post($('#s_d').value,'Saldo awal '+ACC[a][0],'Saldo Awal',L,cb?mk(wo):'Lainnya','');wal();ok('#wm3','✔ Saldo awal tersimpan.')}catch(e){m.textContent=e.message}};
}

// ---------- piutang reservasi ----------
function piu(){
  const B=D().b.filter(b=>b.total-b.paid>.004),tot=B.reduce((s,b)=>s+b.total-b.paid,0),lama=bal(1103)-D().b.reduce((s,b)=>s+b.total-b.paid,0);
  $('#main').innerHTML=`<div class="panel glass"><h2>Piutang Reservasi</h2><div class="stat" style="margin:10px 0">Total belum dibayar<b>${Rp(tot)}</b></div>
  <div class="scroll"><table><tr><th>Reservasi</th><th class="r">Total</th><th class="r">Dibayar</th><th class="r">Sisa</th><th></th></tr>
  ${B.map(b=>`<tr><td>${esc(b.room)}<br><small>${esc(b.guest||'-')} · ${b.ci} → ${b.co}</small></td><td class="r">${Rp(b.total)}</td><td class="r">${Rp(b.paid)}</td><td class="r">${Rp(b.total-b.paid)}</td><td><button class="btn sm" data-p="${b.id}">Terima</button></td></tr>`).join('')||'<tr><td colspan=5 style="color:var(--mu)">Tidak ada piutang reservasi.</td></tr>'}</table></div>
  ${Math.abs(lama)>.004?`<p style="font-size:12px;color:var(--mu)">Piutang di luar reservasi: ${Rp(lama)} (pelunasannya dicatat lewat menu Transaksi).</p>`:''}<div id="pf"></div></div>`;
  document.querySelectorAll('[data-p]').forEach(btn=>btn.onclick=()=>{const b=D().b.find(x=>x.id===btn.dataset.p),sisa=b.total-b.paid;
    $('#pf').innerHTML=`<h3 style="margin-top:14px;font-size:15px">Pelunasan ${esc(b.room)} – ${esc(b.guest||'tamu')}</h3>
    <div class="row2"><div><label>Tanggal</label><input type="date" id="p_d" value="${today()}"></div><div><label>Nominal (Rp)</label><input type="number" id="p_v" value="${sisa}" min="0"></div></div>
    <label>Diterima di rekening</label>${wsel('p_w')}<label>Catatan</label><input id="p_k"><div class="err" id="pm"></div><button class="btn" id="p_b">Simpan Pelunasan</button>`;
    $('#p_b').onclick=async()=>{const v=+$('#p_v').value,w=D().w.find(x=>x.id===$('#p_w').value),m=$('#pm');m.className='err';
      if(!(v>0)||v>sisa+.004)return m.textContent='Nominal harus lebih dari nol dan tidak melebihi sisa '+Rp(sisa)+'.';
      try{await post($('#p_d').value,`Pelunasan ${b.room} – ${b.guest||'tamu'}`,'Pelunasan Piutang',[{a:w.acc,d:v,c:0,w:w.id},{a:1103,d:0,c:v}],mk(w),$('#p_k').value,{payBooking:b.id});piu()}catch(e){m.textContent=e.message}}});
}

// ---------- laporan keuangan ----------
let lf={r:'lr',from:today().slice(0,8)+'01',to:today(),acc:1101};
function lap(){
  const per=j=>j.date>=lf.from&&j.date<=lf.to,upto=j=>j.date<=lf.to;
  const sA=(a,f)=>D().j.reduce((s,j)=>f(j)?s+j.l.reduce((t,l)=>t+(l.a==a?l.d-l.c:0),0):s,0);
  const ks=Object.keys(ACC),R=[],h=l=>R.push({c:[l,''],k:'h'}),r=(l,v)=>R.push({c:[l,v]}),s=(l,v)=>R.push({c:[l,v],k:'s'}),nm=a=>a+' · '+ACC[a][0],cash=a=>a==1101||a==1102;
  let head=['Keterangan','Jumlah'],title;
  if(lf.r==='lr'){title='Laporan Laba Rugi';let tp=0,tb=0;
    h('Pendapatan');ks.filter(a=>a[0]=='4').forEach(a=>{const v=-sA(a,per);if(Math.abs(v)>.004){r(nm(a),v);tp+=v}});s('Total Pendapatan',tp);
    h('Beban');ks.filter(a=>a[0]=='5').forEach(a=>{const v=sA(a,per);if(Math.abs(v)>.004){r(nm(a),v);tb+=v}});s('Total Beban',tb);s('Laba / (Rugi) Bersih',tp-tb)}
  else if(lf.r==='nr'){title='Neraca (Posisi Keuangan)';let ta=0,tk=0,te=0;
    h('Aset');ks.filter(a=>a[0]=='1').forEach(a=>{const v=sA(a,upto);if(Math.abs(v)>.004){r(nm(a),v);ta+=v}});s('Total Aset',ta);
    h('Kewajiban');ks.filter(a=>a[0]=='2').forEach(a=>{const v=-sA(a,upto);if(Math.abs(v)>.004){r(nm(a),v);tk+=v}});s('Total Kewajiban',tk);
    h('Ekuitas');ks.filter(a=>a[0]=='3').forEach(a=>{const v=-sA(a,upto);if(Math.abs(v)>.004){r(nm(a),v);te+=v}});
    const lb=-ks.filter(a=>a[0]=='4'||a[0]=='5').reduce((x,a)=>x+sA(a,upto),0);r('Laba berjalan (s.d. tanggal)',lb);te+=lb;
    s('Total Ekuitas',te);s('Total Kewajiban + Ekuitas',tk+te);if(Math.abs(ta-tk-te)>.004)s('SELISIH (periksa jurnal)',ta-tk-te)}
  else if(lf.r==='ak'){title='Laporan Arus Kas';let o0=0,o1=0,iv=0,fn=0,sa=0,aw=0;
    D().j.forEach(j=>{const net=j.l.reduce((x,l)=>cash(l.a)?x+l.d-l.c:x,0);if(Math.abs(net)<.004)return;
      if(j.date<lf.from){aw+=net;return}if(j.date>lf.to)return;
      const o=j.l.filter(l=>!cash(l.a)).sort((x,y)=>Math.abs(y.d-y.c)-Math.abs(x.d-x.c))[0],a=o?String(o.a):'';
      if(a==='3102')sa+=net;else if(a==='1201'||a==='1202')iv+=net;else if(a[0]==='3')fn+=net;else if(net>0)o0+=net;else o1+=net});
    h('Aktivitas Operasi');r('Kas masuk operasional',o0);r('Kas keluar operasional',o1);s('Kas bersih dari operasi',o0+o1);
    h('Aktivitas Investasi');s('Kas bersih investasi',iv);h('Aktivitas Pendanaan');s('Kas bersih pendanaan',fn);
    if(Math.abs(sa)>.004){h('Lainnya');r('Saldo awal yang dicatat pada periode',sa)}
    const tot=o0+o1+iv+fn+sa;s('Kenaikan (penurunan) kas bersih',tot);r('Kas & bank awal periode',aw);s('Kas & bank akhir periode',aw+tot)}
  else{title='Buku Besar – '+nm(lf.acc);head=['Tanggal','No / Keterangan','Debit','Kredit','Saldo'];
    const sg=ACC[lf.acc][1]==='K'?-1:1;let sd=sg*sA(lf.acc,j=>j.date<lf.from);R.push({c:['','Saldo awal','','',sd],k:'s'});
    D().j.filter(per).slice().sort((a,b)=>(a.date+a.no).localeCompare(b.date+b.no)).forEach(j=>j.l.forEach(l=>{if(l.a==lf.acc){sd+=sg*(l.d-l.c);R.push({c:[j.date,j.no+' · '+j.desc,l.d||'',l.c||'',sd]})}}));
    R.push({c:['','Saldo akhir','','',sd],k:'s'})}
  const cell=x=>typeof x==='number'?`<td class="r">${Rp(x)}</td>`:`<td>${esc(x)}</td>`;
  $('#main').innerHTML=`<div class="panel glass"><h2>Laporan Keuangan</h2>
  <div class="row2"><div><label>Laporan</label><select id="l_r">${[['lr','Laba Rugi'],['nr','Neraca'],['ak','Arus Kas'],['bb','Buku Besar']].map(x=>`<option value="${x[0]}" ${lf.r===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
  <div ${lf.r==='bb'?'':'class="hide"'}><label>Akun</label><select id="l_a">${ks.map(a=>`<option value="${a}" ${lf.acc==a?'selected':''}>${nm(a)}</option>`).join('')}</select></div></div>
  <div class="row2"><div ${lf.r==='nr'?'class="hide"':''}><label>Dari tanggal</label><input type="date" id="l_f" value="${lf.from}"></div><div><label>${lf.r==='nr'?'Per tanggal':'Sampai tanggal'}</label><input type="date" id="l_t" value="${lf.to}"></div></div>
  <h3 style="margin:14px 0 6px;font-size:15px">${esc(title)}</h3>
  <div class="scroll"><table><tr>${head.map((x,i)=>`<th class="${i>(head.length>2?1:0)?'r':''}">${x}</th>`).join('')}</tr>
  ${R.map(x=>x.k==='h'?`<tr><td colspan="${head.length}" style="font-weight:700;color:var(--ac)">${esc(x.c[0])}</td></tr>`:`<tr style="${x.k==='s'?'font-weight:700':''}">${x.c.map(cell).join('')}</tr>`).join('')}</table></div>
  <button class="btn sec sm" id="l_x" style="margin-top:10px">⬇ Ekspor CSV</button></div>`;
  const on=(id,f)=>{const e=$(id);if(e)e.onchange=()=>{f(e.value);lap()}};
  on('#l_r',v=>lf.r=v);on('#l_a',v=>lf.acc=+v);on('#l_f',v=>lf.from=v||lf.from);on('#l_t',v=>lf.to=v||lf.to);
  $('#l_x').onclick=()=>{const q=x=>'"'+String(x).replace(/"/g,'""')+'"',
    csv='\ufeff'+[q($('#hu').textContent+' – '+title+' ('+lf.from+' s.d. '+lf.to+')'),head.map(q).join(';')].concat(R.map(x=>x.c.map(q).join(';'))).join('\r\n'),
    a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=lf.r+'_'+lf.to+'.csv';a.click()};
}

db.auth.getSession().then(({data})=>{if(data.session)openUnits()});
