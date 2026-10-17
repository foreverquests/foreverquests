/* ForeverScout accounts: Supabase auth + progress sync. supabase-js is only loaded when needed,
   so logged-out visitors get exactly the old localStorage behavior. */
(()=>{
const CFG={
  url:'https://aycbvnzqofjnecyoefqp.supabase.co',
  anon:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Y2J2bnpxb2ZqbmVjeW9lZnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxOTQ4MjQsImV4cCI6MjEwNzc3MDgyNH0.nmS9JvANZ3P5EobrlltN7yPKHNg-lD4_emh2eehcocI',
  battlenet:false,            // flip to true once the custom:battlenet provider is created in Supabase
  bnetProvider:'custom:battlenet',
  magicLink:true
};
const BASE=document.documentElement.dataset.base||'/',K='fq-done',SK='fq-sync',TK='sb-aycbvnzqofjnecyoefqp-auth-token';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const get=()=>JSON.parse(localStorage.getItem(K)||'{}');
const setLocal=o=>{localStorage.setItem(K,JSON.stringify(o));dispatchEvent(new Event('fq-progress'))};
const meta=()=>JSON.parse(localStorage.getItem(SK)||'null');const setMeta=m=>m?localStorage.setItem(SK,JSON.stringify(m)):localStorage.removeItem(SK);
let sb=null,user=null,profile=null,pushT=null,applying=false;
const slot=$('#fq-acct');if(!slot)return;

function loadLib(){if(sb)return Promise.resolve(sb);return new Promise((ok,no)=>{const s=document.createElement('script');s.src=BASE+'vendor/supabase.js';s.onload=()=>{
  sb=window.supabase.createClient(CFG.url,CFG.anon,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
  sb.auth.onAuthStateChange((ev,session)=>{setTimeout(()=>onAuth(ev,session),0)});ok(sb)};s.onerror=no;document.head.append(s)})}

function name(){if(!user)return'';const m=user.user_metadata||{},c=m.custom_claims||{};
  return profile?.battletag||m.battletag||m.battle_tag||c.battletag||c.battle_tag||user.email||'Account'}
function draw(){
  if(!user){slot.innerHTML='<button class="fq-login" data-login>Log in</button>';return}
  slot.innerHTML='<div class="fq-menu"><button class="fq-me" aria-haspopup="true">👤 '+esc(name())+'</button><div class="fq-drop" hidden><p>Progress synced to your account.</p><button data-logout>Log out</button></div></div>'}
slot.addEventListener('click',e=>{
  if(e.target.closest('[data-login]'))openLogin();
  else if(e.target.closest('.fq-me')){const d=slot.querySelector('.fq-drop');d.hidden=!d.hidden}
  else if(e.target.closest('[data-logout]'))logout()});
document.addEventListener('click',e=>{const d=slot.querySelector('.fq-drop');if(d&&!d.hidden&&!e.target.closest('#fq-acct'))d.hidden=true});

function modal(html){const w=document.createElement('div');w.className='fq-modal';w.innerHTML='<div class="fq-dlg" role="dialog" aria-modal="true"><button class="fq-x" data-close aria-label="Close">×</button>'+html+'</div>';document.body.append(w);w.onclick=e=>{if(e.target===w||e.target.closest('[data-close]'))w.remove()};return w}
function openLogin(){
  const w=modal('<div class="eyebrow">Your account</div><h2>Log in to ForeverScout</h2><p>Sync your checklist across devices. Anything you already checked on this device is kept.</p>'+
   (CFG.battlenet?'<button class="cta fq-bnet">Log in with Battle.net</button>'+(CFG.magicLink?'<p class="fq-or">or</p>':''):'')+
   (CFG.magicLink?'<form class="fq-ml"><input type="email" required placeholder="you@example.com" aria-label="Email"><button>Email me a login link</button></form><p class="fq-hint">No password needed. We\'ll email you a one-time sign-in link.</p>':''));
  const redirect=location.origin+location.pathname;
  const b=w.querySelector('.fq-bnet');if(b)b.onclick=async()=>{b.disabled=true;await loadLib();const{error}=await sb.auth.signInWithOAuth({provider:CFG.bnetProvider,options:{redirectTo:redirect}});if(error){b.disabled=false;alert('Battle.net login failed: '+error.message)}};
  const f=w.querySelector('.fq-ml');if(f)f.onsubmit=async e=>{e.preventDefault();const em=f.querySelector('input').value.trim(),bt=f.querySelector('button');bt.disabled=true;bt.textContent='Sending…';
    try{await loadLib();const{error}=await sb.auth.signInWithOtp({email:em,options:{emailRedirectTo:redirect}});if(error)throw error;
      f.outerHTML='<p><b>Check your inbox.</b> We sent a login link to '+esc(em)+'. Open it on this device to finish.</p>'}
    catch(err){bt.disabled=false;bt.textContent='Email me a login link';alert('Could not send link: '+(err.message||err))}}}

async function onAuth(ev,session){
  const u=session?.user||null;
  if(!u){if(user&&ev==='SIGNED_OUT')setMeta(null);user=null;profile=null;draw();return}
  const first=!user||user.id!==u.id;user=u;draw();
  if(first&&(ev==='SIGNED_IN'||ev==='INITIAL_SESSION')){
    sb.from('profiles').select('battletag').eq('id',u.id).maybeSingle().then(({data})=>{if(data){profile=data;draw()}});
    await pull();document.querySelector('.fq-modal')?.remove()}}

async function pull(){
  const{data,error}=await sb.from('progress').select('done').eq('user_id',user.id).maybeSingle();if(error){console.warn('sync pull',error);return}
  const remote=data?.done||{},local=get(),m=meta();let next;
  if(m&&m.uid===user.id&&!m.dirty)next=remote;            // known device, nothing pending: account is the source of truth
  else next=Object.assign({},remote,local);               // first login here (or unsynced edits): union, never lose a check
  applying=true;setLocal(next);applying=false;
  setMeta({uid:user.id,dirty:false});
  if(!data||JSON.stringify(sortK(next))!==JSON.stringify(sortK(remote)))await push()}
const sortK=o=>Object.keys(o).sort();
async function push(){if(!user)return;const{error}=await sb.from('progress').upsert({user_id:user.id,done:get()});
  if(error){console.warn('sync push',error);setMeta({uid:user.id,dirty:true})}else setMeta({uid:user.id,dirty:false})}
function changed(){if(!user||applying)return;setMeta({uid:user.id,dirty:true});clearTimeout(pushT);pushT=setTimeout(push,1200)}
// Pages write localStorage directly on checkbox change; catch those plus progress-link imports.
document.addEventListener('change',e=>{if(e.target.matches('input[type=checkbox]'))setTimeout(changed,0)});
addEventListener('fq-progress',changed);
addEventListener('pagehide',()=>{if(pushT){clearTimeout(pushT);push()}});

async function logout(){await sb.auth.signOut();setMeta(null);user=null;profile=null;draw()}

draw();
const h=location.hash+location.search;
if(localStorage.getItem(TK)||/access_token=|error_description=|[?&]code=/.test(h))loadLib().catch(e=>console.warn('auth lib',e));
})();
