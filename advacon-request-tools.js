/* Request attachments, notification transitions and staff-history presentation. */
(function(){
'use strict';
const tr=(a,b)=>L==='ar'?a:b;
let command=crypto.randomUUID(),generation=0,uploads={image:null,file:null},pending=0,failed=new Set();
let audio=null,enabled=localStorage.getItem('advacon-request-sound')!=='off',busy=false,identity='',baseline=null,staffFilter='current',staffCount=50;
const currentIdentity=()=>{const s=admGetSession();return s?.user?.id||s?.user_id||s?.email||'admin';};
async function unlock(){if(!enabled||state.role!=='admin')return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')await audio.resume();decorate();}catch{}}
function sound(){if(!enabled||audio?.state!=='running')return;[0,.18].forEach((delay,i)=>{const o=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;o.frequency.value=i?880:660;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.12,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.15);o.connect(gain);gain.connect(audio.destination);o.start(at);o.stop(at+.17);});}
function decorate(){if(state.role!=='admin')return;const area=document.querySelector('.side-foot');if(!area)return;let b=document.getElementById('request-sound-toggle');if(!b){b=document.createElement('button');b.id='request-sound-toggle';b.type='button';b.onclick=async()=>{enabled=!enabled;localStorage.setItem('advacon-request-sound',enabled?'on':'off');if(enabled){await unlock();sound();}decorate();};area.prepend(b);}b.textContent=enabled?(audio?.state==='running'?tr('الصوت مفعّل','Sound on'):tr('تفعيل صوت التنبيهات','Enable alert sound')):tr('الصوت مكتوم','Sound muted');b.setAttribute('aria-pressed',String(enabled));b.title=tr('تنبيه الطلبات الواردة وبانتظار التأكيد','Incoming and confirmation request alerts');if(enabled&&audio?.state!=='running')b.onclick=async()=>{await unlock();sound();decorate();};}
function transition(previous,items){const now=new Set(items.map(x=>x.id+':'+x.stage+':'+(x.at||'')));return {now,newItems:previous===null?[]:[...now].filter(k=>!previous.has(k))};}
async function poll(){
 if(busy||state.role!=='admin'){if(state.role!=='admin'){identity='';baseline=null;}return;}
 const owner=currentIdentity();if(owner!==identity){identity=owner;baseline=null;}busy=true;
 try{const r=await admRpc('advacon_request_notifications',{});if(!r?.ok||state.role!=='admin'||identity!==owner)return;
  const next=transition(baseline,r.items||[]);baseline=next.now;
  if(next.newItems.length){const key='advacon-request-alert:'+owner;const deliver=()=>{if(!enabled||audio?.state!=='running')return;let seen={};try{seen=JSON.parse(localStorage.getItem(key)||'{}');}catch{}const fresh=next.newItems.filter(k=>!seen[k]||Date.now()-seen[k]>86400000);if(!fresh.length)return;for(const k of fresh)seen[k]=Date.now();for(const k of Object.keys(seen))if(Date.now()-seen[k]>86400000)delete seen[k];localStorage.setItem(key,JSON.stringify(seen));sound();};if(navigator.locks)await navigator.locks.request(key,deliver);else deliver();
   if(!document.hidden&&!modal&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))refreshNow();
  }
 }catch{/* Retry on the next poll; never reset the baseline on a transient failure. */}finally{busy=false;}
}
async function attachment(input,kind){
 const file=input.files?.[0],own=generation;uploads[kind]=null;failed.delete(kind);const status=document.getElementById('admin-'+kind+'-state');if(!file){if(status)status.textContent='';return;}
 if(!uploadAllowed(file)||kind==='image'&&!/^image\/(jpeg|png|webp)$/.test(file.type)){failed.add(kind);status.textContent=t('fileRejected');return;}
 pending++;input.disabled=true;status.textContent=t('uploading');
 try{const url=await(kind==='image'?sbUploadImage(file):sbUploadFile(file));if(own!==generation)return;uploads[kind]=kind==='image'?url:{url,name:file.name};status.textContent=tr('تم رفع: ','Uploaded: ')+file.name;}
 catch{if(own===generation){failed.add(kind);status.textContent=tr('تعذّر الرفع. اختر الملف مجددًا أو أزله قبل الحفظ.','Upload failed. Reselect or remove the file before saving.');}}
 finally{if(own===generation)pending--;if(input.isConnected)input.disabled=false;}
}
async function submit(payload){if(pending){toast(t('waitUpload'));return {ok:false,error:'attachments_uploading'};}if(failed.size){toast(tr('أكمل رفع المرفق أو أزله قبل الحفظ.','Upload or remove the failed attachment first.'));return {ok:false,error:'attachment_upload_failed'};}return admRpc('advacon_admin_add_request',{p_command_id:command,p_payload:{...payload,images:uploads.image?[uploads.image]:[],files:uploads.file?[uploads.file]:[]}});}
window.AdvaconRequestTools={decorate,attachment,submit,transition,
 reset(){command=crypto.randomUUID();generation++;pending=0;failed.clear();uploads={image:null,file:null};},
 staffMatch(r){const closed=['Complete','Cancelled','Rejected'].includes(r.status);return staffFilter==='all'||(staffFilter==='current'?!closed:closed);},
 staffLimit:()=>staffCount,
 staffSet(value){staffFilter=value;staffCount=50;render();},staffMore(){staffCount+=50;render();},
 staffControls(total){return `<div class="ops-staff-filters">${[['current',tr('القائمة','Current')],['closed',tr('المنتهية والملغاة','Closed')],['all',tr('الكل','All')]].map(([k,l])=>`<button class="btn sec" aria-pressed="${staffFilter===k}" onclick="AdvaconRequestTools.staffSet('${k}')">${l}</button>`).join('')}${total>staffCount?`<button class="btn" onclick="AdvaconRequestTools.staffMore()">${tr('عرض المزيد','Show more')} (${Math.min(staffCount,total)}/${total})</button>`:''}</div>`;}
};
document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock,{passive:true});
window.addEventListener('storage',e=>{if(e.key==='advacon-request-sound'){enabled=e.newValue!=='off';decorate();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
setInterval(poll,15000);setTimeout(()=>{decorate();poll();},1000);
})();
