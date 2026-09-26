/* Request attachments, notification transitions and staff-history presentation. */
(function(){
'use strict';
const tr=(a,b)=>L==='ar'?a:b;
let command=crypto.randomUUID(),generation=0,uploads={image:null,file:null},pending=0,failed=new Set();
let audio=null,enabled=localStorage.getItem('advacon-request-sound')!=='off',busy=false,identity='',baseline=null,staffFilter='current',staffCount=50;
const currentIdentity=()=>{const s=admGetSession();return s?.user?.id||s?.user_id||s?.email||'admin';};
async function unlock(){if(!enabled||state.role!=='admin')return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});if(audio.state==='suspended')await audio.resume();decorate();}catch{}}
function sound(){if(!enabled||audio?.state!=='running')return;[0,.18].forEach((delay,i)=>{const o=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;o.frequency.value=i?880:660;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.30,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.15);o.connect(gain);gain.connect(audio.destination);o.start(at);o.stop(at+.17);});}
function decorate(){if(state.role!=='admin')return;const area=document.querySelector('.side-foot');if(!area)return;let b=document.getElementById('request-sound-toggle');if(!b){b=document.createElement('button');b.id='request-sound-toggle';b.type='button';b.onclick=async()=>{enabled=!enabled;localStorage.setItem('advacon-request-sound',enabled?'on':'off');if(enabled){await unlock();sound();}decorate();};area.prepend(b);}b.textContent=enabled?(audio?.state==='running'?tr('الصوت مفعّل','Sound on'):tr('تفعيل صوت التنبيهات','Enable alert sound')):tr('الصوت مكتوم','Sound muted');b.setAttribute('aria-pressed',String(enabled));b.title=tr('تنبيه الطلبات الواردة وبانتظار التأكيد','Incoming and confirmation request alerts');if(enabled&&audio?.state!=='running')b.onclick=async()=>{await unlock();sound();decorate();};}
// The same rendered request snapshot drives the cards and sound. The lightweight
// notification RPC only wakes that refresh; it never plays an independent alert.
const eventKey=x=>x.id+':'+x.stage+':'+(x.at&&!Number.isNaN(Date.parse(x.at))?new Date(x.at).toISOString():x.at||'');
function transition(previous,items){const now=new Set(items.map(eventKey));return {now,newItems:previous===null?[]:[...now].filter(k=>!previous.has(k))};}
function requestEvents(rows){return rows.filter(r=>!r.archived&&!['Complete','Cancelled','Rejected','Deleted'].includes(r.status)&&(r.pendingConfirm||!r.accepted)).map(r=>({id:r.id,stage:r.pendingConfirm?'confirmation':'incoming',at:r.pendingConfirm?r.pendingConfirmAt:r.receivedAt}));}
function resetNotifications(){identity='';baseline=null;}
function rendered(rows){
 if(state.role!=='admin'){resetNotifications();return;}
 const owner=currentIdentity();if(owner!==identity){identity=owner;baseline=null;}
 const next=transition(baseline,requestEvents(rows));baseline=next.now;
 if(!next.newItems.length||!enabled||audio?.state!=='running')return;
 const key='advacon-request-alert:'+owner,detected=performance.now();
 const deliver=()=>{
  // Never queue a chime behind another tab, a suspended context, or a later screen.
  if(state.role!=='admin'||currentIdentity()!==owner||!enabled||audio?.state!=='running'||performance.now()-detected>250)return;
  let seen={};try{seen=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
  const fresh=next.newItems.filter(k=>baseline?.has(k)&&(!seen[k]||Date.now()-seen[k]>86400000));
  if(!fresh.length)return;
  for(const k of fresh)seen[k]=Date.now();
  for(const k of Object.keys(seen))if(Date.now()-seen[k]>86400000)delete seen[k];
  try{localStorage.setItem(key,JSON.stringify(seen));}catch{}
  sound();
 };
 if(navigator.locks)void navigator.locks.request(key,{ifAvailable:true},lock=>{if(lock)deliver();}).catch(()=>{});
 else deliver();
}
async function poll(){
 if(busy)return;
 if(state.role!=='admin'){resetNotifications();return;}
 const owner=currentIdentity();busy=true;
 try{
  const r=await admRpc('advacon_request_notifications',{});
  if(!r?.ok||!Array.isArray(r.items)||state.role!=='admin'||currentIdentity()!==owner)return;
  const next=transition(baseline,r.items);
  if(baseline===null||next.newItems.length||next.now.size!==baseline.size)await refreshNow({allowBackground:true});
 }catch{/* Keep the rendered baseline after a transient failure. */}finally{busy=false;}
}
async function watch(){await poll();setTimeout(watch,2000);}
async function attachment(input,kind){
 const file=input.files?.[0],own=generation;uploads[kind]=null;failed.delete(kind);const status=document.getElementById('admin-'+kind+'-state');if(!file){if(status)status.textContent='';return;}
 if(!uploadAllowed(file)||kind==='image'&&!/^image\/(jpeg|png|webp)$/.test(file.type)){failed.add(kind);status.textContent=t('fileRejected');return;}
 pending++;input.disabled=true;status.textContent=t('uploading');
 try{const url=await(kind==='image'?sbUploadImage(file):sbUploadFile(file));if(own!==generation)return;uploads[kind]=kind==='image'?url:{url,name:file.name};status.textContent=tr('تم رفع: ','Uploaded: ')+file.name;}
 catch{if(own===generation){failed.add(kind);status.textContent=tr('تعذّر الرفع. اختر الملف مجددًا أو أزله قبل الحفظ.','Upload failed. Reselect or remove the file before saving.');}}
 finally{if(own===generation)pending--;if(input.isConnected)input.disabled=false;}
}
async function submit(payload){if(pending){toast(t('waitUpload'));return {ok:false,error:'attachments_uploading'};}if(failed.size){toast(tr('أكمل رفع المرفق أو أزله قبل الحفظ.','Upload or remove the failed attachment first.'));return {ok:false,error:'attachment_upload_failed'};}return admRpc('advacon_admin_add_request',{p_command_id:command,p_payload:{...payload,images:uploads.image?[uploads.image]:[],files:uploads.file?[uploads.file]:[]}});}
window.AdvaconRequestTools={decorate,attachment,submit,transition,rendered,resetNotifications,
 reset(){command=crypto.randomUUID();generation++;pending=0;failed.clear();uploads={image:null,file:null};},
 staffMatch(r){const closed=['Complete','Cancelled','Rejected'].includes(r.status);return staffFilter==='all'||(staffFilter==='current'?!closed:closed);},
 staffLimit:()=>staffCount,
 staffSet(value){staffFilter=value;staffCount=50;render();},staffMore(){staffCount+=50;render();},
 staffControls(total){return `<div class="ops-staff-filters">${[['current',tr('القائمة','Current')],['closed',tr('المنتهية والملغاة','Closed')],['all',tr('الكل','All')]].map(([k,l])=>`<button class="btn sec" aria-pressed="${staffFilter===k}" onclick="AdvaconRequestTools.staffSet('${k}')">${l}</button>`).join('')}${total>staffCount?`<button class="btn" onclick="AdvaconRequestTools.staffMore()">${tr('عرض المزيد','Show more')} (${Math.min(staffCount,total)}/${total})</button>`:''}</div>`;}
};
const unlockFromGesture=e=>{if(!e.target.closest?.('#request-sound-toggle'))void unlock();};
document.addEventListener('pointerdown',unlockFromGesture,{passive:true});document.addEventListener('keydown',unlockFromGesture,{passive:true});
window.addEventListener('storage',e=>{if(e.key==='advacon-request-sound'){enabled=e.newValue!=='off';decorate();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
decorate();setTimeout(watch,0);
})();
