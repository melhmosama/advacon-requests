/* Request attachments, notification transitions and staff-history presentation. */
(function(){
'use strict';
const tr=(a,b)=>L==='ar'?a:b;
let command=crypto.randomUUID(),generation=0,uploads={image:null,file:null},pending=0,failed=new Set();
let audio=null,enabled=localStorage.getItem('advacon-request-sound')!=='off',busy=false,identity='',baseline=null,staffFilter='current',staffCount=50;
const currentIdentity=()=>{const s=admGetSession();return s?.user?.id||s?.user_id||s?.email||'admin';};
async function unlock(){if(!enabled||state.role!=='admin')return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});if(audio.state==='suspended')await audio.resume();decorate();}catch{}}
// Each stage has a distinct continuous tone, with no repeated beep per stage.
function sound(stage='incoming',delay=0){
 if(!enabled||audio?.state!=='running')return;
 const confirmation=stage==='confirmation',duration=confirmation?.46:.30;
 const o=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;
 o.frequency.setValueAtTime(confirmation?520:780,at);
 if(confirmation)o.frequency.exponentialRampToValueAtTime(390,at+.40);
 gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.30,at+.02);
 gain.gain.exponentialRampToValueAtTime(.001,at+duration-.02);
 o.connect(gain);gain.connect(audio.destination);o.start(at);o.stop(at+duration);
 o.onended=()=>{o.disconnect();gain.disconnect();};
}
function decorate(){if(state.role!=='admin')return;const area=document.querySelector('.side-foot');if(!area)return;let b=document.getElementById('request-sound-toggle');if(!b){b=document.createElement('button');b.id='request-sound-toggle';b.type='button';b.onclick=async()=>{enabled=!enabled;localStorage.setItem('advacon-request-sound',enabled?'on':'off');if(enabled){await unlock();sound();}decorate();};area.prepend(b);}b.textContent=enabled?(audio?.state==='running'?tr('الصوت مفعّل','Sound on'):tr('تفعيل صوت التنبيهات','Enable alert sound')):tr('الصوت مكتوم','Sound muted');b.setAttribute('aria-pressed',String(enabled));b.title=tr('طلب جديد: نغمة قصيرة حادة • بانتظار التأكيد: نغمة أخفض وأطول','New request: short high tone • Pending confirmation: lower, longer tone');if(enabled&&audio?.state!=='running')b.onclick=async()=>{await unlock();sound();decorate();};}
// The same rendered request snapshot drives the cards and sound. The lightweight
// notification RPC only wakes that refresh; it never plays an independent alert.
const eventKey=x=>x.id+':'+x.stage+':'+(x.at&&!Number.isNaN(Date.parse(x.at))?new Date(x.at).toISOString():x.at||'');
function transition(previous,items){const now=new Set(items.map(eventKey));return {now,newItems:previous===null?[]:[...now].filter(k=>!previous.has(k))};}
function requestEvents(rows){return rows.filter(r=>!r.archived&&!['Complete','Cancelled','Rejected','Deleted'].includes(r.status)&&(r.pendingConfirm||!r.accepted)).map(r=>({id:r.id,stage:r.pendingConfirm?'confirmation':'incoming',at:r.pendingConfirm?r.pendingConfirmAt:r.receivedAt}));}
function resetNotifications(){identity='';baseline=null;}
function rendered(rows){
 if(state.role!=='admin'){resetNotifications();return;}
 const owner=currentIdentity();if(owner!==identity){identity=owner;baseline=null;}
 const events=requestEvents(rows),stages=new Map(events.map(e=>[eventKey(e),e.stage]));
 const next=transition(baseline,events);baseline=next.now;
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
  // Batch arrivals of the same stage into one alert. If both stages arrive
  // together, play each stage once in sequence so neither is masked.
  const arrived=new Set(fresh.map(k=>stages.get(k)));let delay=0;
  for(const stage of ['incoming','confirmation'])if(arrived.has(stage)){
   sound(stage,delay);delay+=(stage==='confirmation'?.46:.30)+.12;
  }
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
 if(!uploadAllowed(file)||kind==='image'&&!AdvaconImages.isImage(file)){failed.add(kind);status.textContent=t('fileRejected');return;}
 pending++;input.disabled=true;status.textContent=t('uploading');
 try{const url=await(kind==='image'?sbUploadImage(file):sbUploadFile(file));if(own!==generation)return;uploads[kind]=kind==='image'?url:{url,name:file.name};status.textContent=tr('تم رفع: ','Uploaded: ')+file.name;}
 catch(e){if(own===generation){failed.add(kind);status.textContent=AdvaconImages.uploadError(e,tr('تعذّر الرفع. اختر الملف مجددًا أو أزله قبل الحفظ.','Upload failed. Reselect or remove the file before saving.'));}}
 finally{if(own===generation)pending--;if(input.isConnected)input.disabled=false;}
}
async function submit(payload){if(pending){toast(t('waitUpload'));return {ok:false,error:'attachments_uploading'};}if(failed.size){toast(tr('أكمل رفع المرفق أو أزله قبل الحفظ.','Upload or remove the failed attachment first.'));return {ok:false,error:'attachment_upload_failed'};}return admRpc('advacon_admin_add_request',{p_command_id:command,p_payload:{...payload,images:uploads.image?[uploads.image]:[],files:uploads.file?[uploads.file]:[]}});}
function shareSnapshot(row,completion=false){
 const snapshot={id:row.id,requester:row.requestedBy,phone:row.phone,project:requestProjectLabel(row.project),category:row.category,priority:dispPri(row.priority),description:row.title||'',received:row.received,submittedAt:row.receivedAt};
 if(completion){
  snapshot.heading=tr('ملخص إنجاز الطلب','Request completion summary');
  snapshot.subtitle=row.pendingConfirm?tr('بانتظار تأكيد المدير','Pending manager confirmation'):tr('ملخص بيانات الإنجاز','Completion details');
  snapshot.extraFields=[[tr('الفني المكلف','Assigned technician'),row.assignedTo],[tr('حالة الطلب','Request status'),row.pendingConfirm?tr('بانتظار التأكيد','Pending confirmation'):stfStatusLabel(row.status)],[tr('تاريخ إرسال الإنجاز','Completion submitted'),row.pendingConfirmAt?fmtTime(row.pendingConfirmAt):'']];
  snapshot.descriptionLabel=tr('تفاصيل الطلب والإنجاز','Request & completion details');
  snapshot.description=[[tr('وصف الطلب','Request description'),row.title],[tr('ملاحظات الطلب','Request notes'),row.notes],[tr('ملاحظات مدير القسم','Department manager notes'),row.managerNote],[tr('ملاحظات الفني','Technician notes'),row.closeoutNote]].map(([label,value])=>label+'\n'+(value||tr('لا توجد ملاحظات','No notes'))).join('\n\n');
 }
 return snapshot;
}
function shareAttachments(row){
 const parse=value=>{try{const data=typeof value==='string'?JSON.parse(value):value;return Array.isArray(data)?data:[];}catch{return [];}};
 return [...parse(row.closeoutImages).map((value,i)=>({url:typeof value==='string'?value:value.url,name:tr('صورة إنجاز ','Completion image ')+(i+1),image:true})),...parse(row.closeoutFiles).map((value,i)=>({url:typeof value==='string'?value:value.url,name:typeof value==='string'?tr('تقرير إنجاز ','Completion report ')+(i+1):value.name||tr('تقرير إنجاز ','Completion report ')+(i+1),image:false}))].filter(file=>AdvaconExperience.safeURL(file.url));
}
function share(id,completion=false){
 const row=state.requests.find(r=>Number(r.id)===Number(id));if(!row)return;
 const snapshot=shareSnapshot(row,completion),files=completion?shareAttachments(row):[],urls=[];
 const body=document.createElement('div');body.className='request-share-preview';
 body.innerHTML='<p class="request-share-id">'+esc(fmtID(id))+'</p><dl>'+receiptFields(snapshot).map(([key,value])=>'<div><dt>'+esc(key)+'</dt><dd dir="auto">'+esc(value)+'</dd></div>').join('')+'</dl><h3>'+esc(snapshot.descriptionLabel||tr('وصف الطلب','Request description'))+'</h3><div class="request-description" dir="auto">'+esc(snapshot.description)+'</div>';
 if(files.length){const group=document.createElement('fieldset');group.innerHTML='<legend>'+tr('مرفقات الإنجاز الاختيارية','Optional completion attachments')+'</legend>';files.forEach((file,index)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.attachment=index;label.append(input,document.createTextNode(file.name));group.append(label);});body.append(group);}
 const message=document.createElement('p');message.setAttribute('role','status');body.append(message);
 const downloads=document.createElement('div');downloads.className='request-share-downloads';body.append(downloads);
 const footer=document.createElement('div');footer.className='btnrow';const shareButton=document.createElement('button');shareButton.className='btn';shareButton.textContent=tr('مشاركة','Share');footer.append(shareButton);
 const dialog=AdvaconUI.modal({title:completion?tr('مشاركة ملخص الإنجاز','Share completion summary'):tr('مشاركة الطلب','Share request'),body,footer,wide:true,trackChanges:false,onClose:()=>urls.forEach(url=>URL.revokeObjectURL(url))});
 shareButton.onclick=async()=>{
  if(shareButton.disabled)return;shareButton.disabled=true;dialog.setBusy(true);message.textContent=tr('جارٍ تجهيز المشاركة…','Preparing share…');
  try{
   const output=await receiptImages(snapshot);
   for(const checkbox of body.querySelectorAll('[data-attachment]:checked')){
    const file=files[Number(checkbox.dataset.attachment)],response=await fetch(file.url,{credentials:'omit'});if(!response.ok)throw Error('attachment_unavailable');
    const blob=await response.blob();if(!blob.size)throw Error('attachment_unavailable');
    let name=file.name.replace(/[\\/:*?"<>|]/g,'_');if(file.image&&!/\.[a-z0-9]{2,5}$/i.test(name))name+='.'+(blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg');
    const attachment=new File([blob],name,{type:blob.type||'application/octet-stream'});output.push(file.image?await AdvaconImages.prepare(attachment):attachment);
   }
   const text=tr('رقم الطلب: ','Request number: ')+fmtID(id);
   let shared=false;
   if(navigator.canShare?.({files:output})){try{await navigator.share({files:output,title:fmtID(id),text});shared=true;}catch(error){if(error.name==='AbortError'){message.textContent='';return;}}}
   if(shared){message.textContent=tr('تمت المشاركة.','Shared.');return;}
   urls.splice(0).forEach(url=>URL.revokeObjectURL(url));downloads.replaceChildren();const caption=document.createElement('p');caption.textContent=text;caption.style.userSelect='all';downloads.append(caption);
   for(const file of output){const link=document.createElement('a');link.href=URL.createObjectURL(file);urls.push(link.href);link.download=file.name;link.textContent=file.name;downloads.append(link);}
   message.textContent=tr('المشاركة المباشرة غير متاحة في هذا المتصفح. حمّل الصور والمرفقات وأرفق معها رقم الطلب الظاهر أدناه.','Direct sharing is unavailable in this browser. Download the images and attachments and use the request number below as the caption.');
  }catch(error){message.textContent=tr('تعذر تجهيز أحد المرفقات. أعد المحاولة أو أزل اختياره للمشاركة.','An attachment could not be prepared. Retry or deselect it.');}
  finally{shareButton.disabled=false;dialog.setBusy(false);}
 };
}
window.AdvaconRequestTools={decorate,attachment,submit,transition,rendered,resetNotifications,share,shareSnapshot,shareAttachments,
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
