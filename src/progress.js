(()=>{const K='fq-done',BASE=document.documentElement.dataset.base||'/';
let D=null;const data=()=>D?Promise.resolve(D):fetch(BASE+'data.json').then(r=>r.json()).then(j=>D=j);
const get=()=>JSON.parse(localStorage.getItem(K)||'{}'),set=o=>{localStorage.setItem(K,JSON.stringify(o));dispatchEvent(new Event('fq-progress'))};
const b64=u=>btoa(String.fromCharCode(...u)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
function encode(done){const ids=D.items.filter(i=>done[i.slug]).map(i=>i.idx);if(!ids.length)return '1';const b=new Uint8Array((Math.max(...ids)>>3)+1);ids.forEach(n=>b[n>>3]|=1<<(n&7));return '1'+b64(b)}
function decode(s){const out={};if(!s||s[0]!=='1')return null;try{const b=unb64(s.slice(1));const by={};D.items.forEach(i=>by[i.idx]=i.slug);b.forEach((v,k)=>{for(let j=0;j<8;j++)if(v>>j&1&&by[k*8+j])out[by[k*8+j]]=1})}catch(e){return null}return out}
const link=()=>location.origin+BASE+'#p='+encode(get());
function toast(t){let e=document.createElement('div');e.className='fq-toast';e.textContent=t;document.body.append(e);requestAnimationFrame(()=>e.classList.add('on'));setTimeout(()=>{e.classList.remove('on');setTimeout(()=>e.remove(),300)},2200)}
function modal(html){const w=document.createElement('div');w.className='fq-modal';w.innerHTML='<div class="fq-dlg" role="dialog" aria-modal="true">'+html+'</div>';document.body.append(w);w.onclick=e=>{if(e.target===w||e.target.closest('[data-close]'))w.remove()};addEventListener('keydown',function k(e){if(e.key==='Escape'){w.remove();removeEventListener('keydown',k)}});return w}
async function openSave(){await data();const n=Object.keys(get()).filter(s=>D.items.some(i=>i.slug===s)).length,url=link();
const w=modal(`<button class="fq-x" data-close aria-label="Close">×</button><div class="eyebrow">Your progress</div><h2>Save my progress</h2><p>${n} of ${D.items.length} items done. This personal link holds your checklist — no account needed. Open it on any device to restore it.</p><div class="fq-link"><input readonly value="${url}" aria-label="Personal progress link"><button class="fq-copy">Copy</button></div>${navigator.share?'<button class="fq-share cta">Share…</button>':''}<p class="fq-hint">🔖 Tip: bookmark this link (Ctrl/⌘+D after opening it) and check back after each patch.</p>`);
const inp=w.querySelector('input');inp.onfocus=()=>inp.select();
w.querySelector('.fq-copy').onclick=async()=>{try{await navigator.clipboard.writeText(url)}catch(e){inp.select();document.execCommand('copy')}toast('Link copied — bookmark it to keep your progress')};
const sh=w.querySelector('.fq-share');if(sh)sh.onclick=()=>navigator.share({title:'My WoW Forever progress · ForeverQuests',url}).catch(()=>{})}
async function importHash(){const m=location.hash.match(/[#&]p=([\w-]*)/);if(!m)return;await data();const inc=decode(m[1]);history.replaceState(null,'',location.pathname+location.search);if(!inc){toast('That progress link looks broken');return}
const cur=get(),same=JSON.stringify(Object.keys(cur).sort())===JSON.stringify(Object.keys(inc).sort());
const apply=()=>{set(Object.assign(cur,inc));toast('Progress loaded ✔')};
if(same||!Object.keys(cur).length){apply();return}
const w=modal(`<div class="eyebrow">Progress link</div><h2>Load saved progress?</h2><p>This link has ${Object.keys(inc).length} checked items; this device has ${Object.keys(cur).length}. Loading merges them (nothing is unchecked).</p><div class="fq-row"><button class="fq-load">Load &amp; merge</button><button class="fq-ghost" data-close>Keep this device's</button></div>`);
w.querySelector('.fq-load').onclick=()=>{apply();w.remove()}}
window.FQ={openSave,encode:async d=>(await data(),encode(d)),decode:async s=>(await data(),decode(s))};
document.addEventListener('click',e=>{if(e.target.closest('[data-save]'))openSave()});
importHash();addEventListener('hashchange',importHash)})();
