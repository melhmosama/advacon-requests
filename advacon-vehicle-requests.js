/* Normal request flow: identified employee custody and catalog services. */
(()=>{'use strict';
const T=(a,b)=>document.documentElement.dir==='rtl'?a:b;
const N=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const field=(label,input)=>{const l=N('label',label);l.style.display='block';l.append(input);return l;};
const style=N('style');style.textContent=`#vehicle-request-fields,#vehicle-close-fields{font:inherit;text-align:start}#vehicle-request-fields:empty,#vehicle-close-fields:empty{display:none}#vehicle-request-fields label,#vehicle-close-fields label{margin:10px 0;line-height:1.6}#vehicle-request-fields input:not([type=checkbox]),#vehicle-request-fields select,#vehicle-close-fields input,#vehicle-close-fields select{display:block;width:100%;box-sizing:border-box;font:inherit;padding:9px;border:1px solid #cedae8;border-radius:7px}#vehicle-request-fields label:has(input[type=checkbox]){display:flex!important;align-items:center;gap:8px;flex-direction:row-reverse;justify-content:flex-end}#vehicle-request-fields input[type=checkbox]{width:18px;height:18px;flex:none}#vehicle-request-fields .vr-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px;padding:10px 0}#vehicle-close-fields .vw-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 14px}#vehicle-close-fields details{padding:14px;border:1px solid #d8e2ed;border-radius:10px;margin:12px 0}#vehicle-close-fields summary{font-weight:600;cursor:pointer}#vehicle-close-fields p{line-height:1.7;color:#52677c}@media(max-width:550px){#vehicle-close-fields .vw-form,#vehicle-request-fields .vr-choices{grid-template-columns:1fr}}`;
document.head.append(style);
style.textContent+='#vehicle-close-fields [hidden],#vehicle-request-fields [hidden]{display:none!important}';
style.textContent+=`
#vehicle-request-fields .vr-choices{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px 0;margin:0}
#vehicle-request-fields .vr-choices>label{display:flex!important;flex-direction:row-reverse;justify-content:flex-end;align-items:center;gap:8px;min-height:42px;height:auto;margin:0!important;padding:7px 10px!important;border:1px solid #d7e2ed;border-radius:8px;background:#fff;font-size:13px;line-height:1.5;cursor:pointer;box-sizing:border-box}
#vehicle-request-fields .vr-choices>label:has(:checked){background:#eaf3fb;border-color:#547da6;color:#143d64}
#vehicle-request-fields .vr-choices input[type=checkbox]{display:inline-block!important;width:17px!important;height:17px!important;min-height:0!important;margin:0!important;padding:0!important;accent-color:#174574;flex:none}
#vehicle-request-fields .vr-choices>label:focus-within{outline:2px solid #91b5dc;outline-offset:1px}
#vehicle-request-fields .vr-photo-status{font-size:13px;margin:5px 0;line-height:1.5}
#vehicle-request-fields .vr-photo-preview{display:block;max-width:220px;max-height:160px;object-fit:contain;border:1px solid #d7e2ed;border-radius:8px;margin:8px 0}
.vr-evidence:empty{display:none}.vr-evidence{margin:14px 0;padding:14px;border:1px solid #d7e2ed;border-radius:10px;background:#f7faff;text-align:start;overflow-wrap:anywhere}.vr-evidence h4{margin:0 0 8px}.vr-evidence p{margin:6px 0;line-height:1.6}.vr-evidence img{display:block;width:auto;max-width:100%;max-height:320px;object-fit:contain;border-radius:7px}.vr-evidence details{margin-top:8px}.vr-evidence summary{cursor:pointer;font-weight:600;margin-bottom:8px}.vr-evidence .btn{margin-top:8px}
@media(max-width:380px){#vehicle-request-fields .vr-choices>label{font-size:12px;padding:7px!important;gap:5px}}
`;
style.textContent=style.textContent.replaceAll('#vehicle-request-fields',':is(#vehicle-request-fields,#admin-vehicle-request-fields)');
let publicState=null,publicSession=null,closeState=null,adminState=null;
const publicOptionsTimeout=15000;
function readingValue(vehicle){const value=vehicle?.odometer;if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
function selectedVehicle(data){return data?.vehicles?.find(v=>v.id===data.cars.value)||null;}
function readingReference(vehicle){const km=readingValue(vehicle);return km===null?T('لا توجد قراءة عداد سابقة مسجلة لهذه السيارة.','No previous odometer is recorded for this vehicle.'):T('آخر قراءة مسجلة: ','Latest recorded odometer: ')+km+' '+T('كم','km')+(vehicle.observed_on?' · '+vehicle.observed_on:'');}
function vehicleVersion(value){return value!==null&&value!==undefined&&/^[1-9][0-9]*$/.test(String(value));}
function isVehicleCategory(value){return /^(vehicles? maintenance|car maintenance|صيانة مركبات|صيانة المركبات|صيانة السيارات)$/i.test(String(value||'').trim());}
function vehicleCategory(){const el=document.getElementById('f_cat');return isVehicleCategory(el?.value)||isVehicleCategory(el?.selectedOptions?.[0]?.textContent);}
function categoryChanged(){const host=document.getElementById('vehicle-request-fields');if(!host)return;host.hidden=!vehicleCategory();if(publicState?.check){publicState.check.checked=vehicleCategory();publicState.check.dispatchEvent(new Event('change'));}mountPublic();}
function publicTicket(){return typeof visitorIdentity==='undefined'?'':visitorIdentity.ticket||'';}
function publicIdentityKey(){const value=typeof visitorIdentity==='undefined'?'':String(visitorIdentity.value||'').trim();return /^\d{10}$/.test(value)?value:'';}
function activePublicData(){return publicState&&publicSession?.ticket===publicTicket()&&publicSession.host.isConnected?publicState:null;}
function hasPublicDraft(){const data=activePublicData();return !!(data&&(data.vehicleChosen||data.km.value!==''||data.image||data.imagePending||data.picture.files.length||data.selected.some(([,input])=>input.checked)||data.mode.value==='other'||data.other.value));}
function isPublicBusy(){const data=activePublicData();return !!(publicSession?.ticket===publicTicket()&&publicSession.host.isConnected&&(publicSession.pending||data?.imagePending||data?.verificationPending));}
// The caller uses this only after confirmed submission. Failed submissions retain the draft.
function resetPublicAfterSubmit(){if(publicSession)publicSession.sequence++;publicSession=null;publicState=null;}
function publicSessionCurrent(session){return publicSession===session&&publicTicket()===session.ticket;}
function publicLoadError(error,retained=false){
 const code=String(error?.message||error?.error||error||'');let message;
 if(code.includes('vehicle_options_timeout'))message=T('استغرق تحميل السيارات وقتًا طويلًا. تحقق من الاتصال وأعد المحاولة.','Vehicle loading timed out. Check your connection and retry.');
 else if(/identity_required|invalid_ticket|ticket_expired|identity_expired|invalid_identity|expired_identity|visitor_ticket/.test(code))message=T('تعذر التحقق من هوية الموظف. أعد المحاولة، وإذا استمرت المشكلة فتحقق من رقم الإقامة مجددًا.','The employee identity could not be verified. Retry, then verify the iqama again if the problem continues.');
 else message=errorMessage(code)||T('تعذر تحميل بيانات السيارات. تحقق من الاتصال وأعد المحاولة.','Vehicle details could not load. Check your connection and retry.');
 return message+(retained?T(' بياناتك والصورة المختارة محفوظة في هذه الصفحة.',' Your entered details and selected photo are kept on this page.'):'');
}
function publicOptions(result){if(!result?.ok)throw Error(result?.error||'vehicle_options_unavailable');if(!result.enabled)throw Error('vehicle_requests_disabled');return result;}
function publicRpc(name,args){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('vehicle_options_timeout')),publicOptionsTimeout);Promise.resolve().then(()=>submitReqRpc(name,args)).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
function publicStatus(session,status,message='',retry=false){
 session.status=status;session.host.dataset.vehicleState=status;session.notice.hidden=!message;session.notice.replaceChildren();
 if(message)session.notice.append(N('p',message));
 if(retry){const button=N('button',T('إعادة تحميل السيارات','Retry vehicle loading'));button.type='button';button.className='btn sec';button.onclick=()=>refreshPublic({reason:'retry'});session.notice.append(button);}
}
function ensurePublicSession(){
 const host=document.getElementById('vehicle-request-fields');if(!host)return null;const ticket=publicTicket(),identityKey=publicIdentityKey();host.hidden=!vehicleCategory();
 if(!ticket){if(publicSession||host.childNodes.length){resetPublicAfterSubmit();host.replaceChildren();}host.dataset.vehicleState='idle';delete host.dataset.ticket;return null;}
 // A renewed ticket for the same verified iqama is not a change of employee.
 if(publicSession?.ticket!==ticket&&identityKey&&publicSession?.identityKey===identityKey){
  publicSession.sequence++;publicSession.pending=null;publicSession.ticket=ticket;publicSession.status='idle';host.dataset.ticket=ticket;
  if(publicState){publicState.ticket=ticket;publicState.holderSequence++;publicState.verificationPending=false;publicState.verify.disabled=false;}
 }
 if(publicSession?.ticket===ticket){
  // Move the existing DOM, including FileList, if the surrounding page was rendered again.
  if(publicSession.host!==host){publicSession.host=host;host.replaceChildren(publicSession.surface);host.dataset.ticket=ticket;host.dataset.vehicleState=publicSession.status;}
  return publicSession;
 }
 resetPublicAfterSubmit();const surface=N('div'),notice=N('div'),body=N('div');notice.className='vr-load-status';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');surface.append(notice,body);
 const session={ticket,identityKey,host,surface,notice,body,status:'idle',sequence:0,pending:null,config:null};publicSession=session;host.dataset.ticket=ticket;host.dataset.vehicleState='idle';host.replaceChildren(surface);return session;
}
function cancelPublicRefresh(session){session.sequence++;session.pending=null;publicStatus(session,'loaded');}
function loadPublicOptions(session){
 if(session.pending)return session.pending;
 const data=publicState,holderSequence=data?.holderSequence,otherTicket=data?.mode.value==='other'?data.otherTicket:null,sequence=++session.sequence;
 const current=()=>publicSessionCurrent(session)&&session.sequence===sequence;
 publicStatus(session,'loading',T('جارٍ تحميل السيارات…','Loading vehicles…'));
 session.pending=(async()=>{
  try{
   const args={p_ticket:session.ticket};if(otherTicket)args.p_other_ticket=otherTicket;
   const config=publicOptions(await publicRpc('advacon_vehicle_request_options',args));if(!current())return false;
   if(!otherTicket)session.config=config;
   if(!publicState)buildPublic(session,config);
   else if(publicState===data&&data.holderSequence===holderSequence){
    data.blockedError='';data.updateServices(config.services);
    if(data.mode.value==='self'||otherTicket)data.showCars(config.vehicles,true);
   }
   publicStatus(session,'loaded');return true;
  }catch(error){
   if(!current())return false;
   if(data&&/vehicle_requests_disabled|identity_required|invalid_ticket|ticket_expired|identity_expired|invalid_identity|expired_identity|visitor_ticket/.test(String(error?.message)))data.blockedError=publicLoadError(error,true);
   publicStatus(session,'error',publicLoadError(error,!!publicState),true);return false;
  }finally{if(current())session.pending=null;}
 })();return session.pending;
}
function mountPublic(){const session=ensurePublicSession();if(!session)return Promise.resolve(false);if(session.status==='idle')return loadPublicOptions(session);return session.pending||Promise.resolve(session.status==='loaded');}
function refreshPublic({reason='retry'}={}){if(typeof visitorSubmitting!=='undefined'&&visitorSubmitting)return Promise.resolve(false);const session=ensurePublicSession();if(!session)return Promise.resolve(false);if(publicState?.verificationPending)return Promise.resolve(false);return loadPublicOptions(session);}
function buildPublic(session,config){
 const ticket=session.ticket,host=session.body;
 const check=N('input');check.type='checkbox';check.checked=vehicleCategory();const categoryMarker=N('div');categoryMarker.hidden=true;categoryMarker.append(check);host.append(categoryMarker);
 const box=N('div');box.hidden=!vehicleCategory();host.append(box);
 const mode=N('select');mode.add(new Option(T('سيارتي','My vehicle'),'self'));mode.add(new Option(T('سيارة موظف آخر','Another employee’s vehicle'),'other'));box.append(field(T('صاحب السيارة','Vehicle holder'),mode));
 const other=N('input');other.inputMode='numeric';other.maxLength=10;const verify=N('button',T('تحقق','Verify'));verify.type='button';const otherBox=N('div');otherBox.hidden=true;otherBox.append(field(T('إقامة الموظف الآخر','Other employee’s iqama'),other),verify);box.append(otherBox);
 const cars=N('select'),message=N('p');box.append(message,field(T('السيارة','Vehicle'),cars));
 box.append(N('p',T('اختر الخدمات المطلوبة؛ قراءة العداد وصورته إلزاميتان لكل طلب سيارة.','Select the services needed. Every vehicle request requires an odometer reading and photo.')));
 const choices=N('div');choices.className='vr-choices';choices.setAttribute('role','group');choices.setAttribute('aria-label',T('خدمات المركبة','Vehicle services'));box.append(choices);const selected=[];
 const km=N('input');km.type='number';km.min=0;km.max=10000000;km.required=true;km.inputMode='numeric';const picture=N('input');picture.type='file';picture.required=true;picture.accept=AdvaconImages.accept;box.append(field(T('قراءة العداد الحالية (كم) *','Current odometer (km) *'),km),field(T('صورة واضحة للعداد *','Clear odometer photo *'),picture));
 const photoStatus=N('p'),preview=N('img');photoStatus.className='vr-photo-status';photoStatus.setAttribute('role','status');preview.className='vr-photo-preview';preview.alt=T('صورة العداد المختارة','Selected odometer photo');preview.hidden=true;box.append(photoStatus,preview);
 const reference=N('p');reference.className='vr-reading-reference';box.append(reference);const data={ticket,check,cars,selected,km,picture,mode,other,verify,image:null,imagePending:false,verificationPending:false,holderSequence:0,vehicleChosen:false,otherTicket:null,otherIqama:'',holderName:'',ready:true,blockedError:'',vehicles:[],allowedVehicles:new Set(),allowedServices:new Set()};publicState=data;let imageSeq=0;const current=()=>publicSessionCurrent(session)&&publicState===data;
 const showReference=()=>{const vehicle=selectedVehicle(data);reference.textContent=vehicle?readingReference(vehicle):'';km.min=readingValue(vehicle)??0;};
 const clearReading=()=>{imageSeq++;data.image=null;data.imagePending=false;data.vehicleChosen=false;km.value='';picture.value='';photoStatus.textContent='';preview.hidden=true;preview.removeAttribute('src');};cars.onchange=()=>{clearReading();data.vehicleChosen=!!cars.value;showReference();};
 picture.onchange=async()=>{const n=++imageSeq;data.image=null;data.imagePending=false;preview.hidden=true;preview.removeAttribute('src');photoStatus.textContent='';const file=picture.files[0];if(!file)return;data.imagePending=true;photoStatus.textContent=T('جارٍ تجهيز الصورة…','Preparing photo…');try{const image=await AdvaconVehicleServices.photo(file);if(n===imageSeq&&current()){data.image=image;preview.src=image;preview.hidden=false;photoStatus.textContent=T('الصورة جاهزة. تأكد أن أرقام العداد واضحة.','Photo ready. Check that the odometer digits are clear.');}}catch(e){if(n===imageSeq&&current())photoStatus.textContent=e.message;}finally{if(n===imageSeq&&current())data.imagePending=false;}};
 data.updateServices=services=>{
  const list=Array.isArray(services)?services:(window.AdvaconVehicleServiceCatalog||[]);data.allowedServices=new Set(list.map(service=>service.key));
  for(const service of list){const existing=selected.find(([key])=>key===service.key);if(existing){existing[1].parentElement.hidden=false;continue;}const input=N('input');input.type='checkbox';input.value=service.key;choices.append(field(T(service.ar,service.en),input));selected.push([service.key,input]);}
  for(const [key,input]of selected)input.parentElement.hidden=!data.allowedServices.has(key)&&!input.checked;
 };
 const showCars=(vs,preserve=false)=>{
  const value=preserve?cars.value:'',previous=selectedVehicle(data);data.vehicles=Array.isArray(vs)?vs.slice():[];data.allowedVehicles=new Set(data.vehicles.map(vehicle=>vehicle.id));
  // An outdated selection remains visible until the employee explicitly changes it.
  if(value&&!data.allowedVehicles.has(value)&&previous)data.vehicles.push(previous);
  cars.replaceChildren(new Option(T('اختر السيارة','Choose vehicle'),''));for(const v of data.vehicles)cars.add(new Option([v.plate,v.description].filter(Boolean).join(' — '),v.id));
  if(preserve)cars.value=value;else if(data.vehicles.length===1)cars.value=data.vehicles[0].id;
  if(value&&!data.allowedVehicles.has(value))message.textContent=T('تغيّرت السيارات المسندة. اختيارك وبياناتك محفوظة؛ اختر سيارة مسندة حاليًا قبل الإرسال.','Vehicle assignments changed. Your selection and details are kept; choose a currently assigned vehicle before submitting.');
  else if(!data.vehicles.length)message.textContent=T('لا توجد سيارة مسندة لهذا الموظف','No vehicle assigned to this employee');else message.textContent=mode.value==='other'?data.holderName:'';showReference();
 };data.showCars=showCars;data.updateServices(config.services);showCars(config.vehicles);
 check.onchange=()=>box.hidden=!check.checked;
 const holderChanged=()=>{data.holderSequence++;data.verificationPending=false;verify.disabled=false;cancelPublicRefresh(session);clearReading();data.otherTicket=null;data.otherIqama='';data.holderName='';data.blockedError='';message.textContent='';};
 mode.onchange=()=>{holderChanged();otherBox.hidden=mode.value==='self';data.ready=mode.value==='self';showCars(mode.value==='self'?session.config.vehicles:[]);};
 other.oninput=()=>{holderChanged();data.ready=false;data.vehicles=[];data.allowedVehicles.clear();cars.replaceChildren();showReference();};
 verify.onclick=async()=>{
  const n=++data.holderSequence,iqama=other.value,preserve=data.otherIqama===iqama&&data.ready;cancelPublicRefresh(session);data.verificationPending=true;verify.disabled=true;message.textContent=T('جارٍ التحقق من الموظف…','Verifying employee…');
  const own=()=>current()&&n===data.holderSequence&&mode.value==='other'&&other.value===iqama;
  try{const id=await publicRpc('advacon_visitor_identify',{p_iqama:iqama});if(!own())return;if(!id?.ok||!id.ticket)throw Error('invalid_identity');const r=publicOptions(await publicRpc('advacon_vehicle_request_options',{p_ticket:session.ticket,p_other_ticket:id.ticket}));if(!own())return;data.otherTicket=id.ticket;data.otherIqama=iqama;data.holderName=id.name_ar||id.name_en||'';data.ready=true;data.blockedError='';data.updateServices(r.services);showCars(r.vehicles,preserve);
  }catch(e){if(own())message.textContent=publicLoadError(e,preserve);}finally{if(own()){data.verificationPending=false;verify.disabled=false;}}
 };
}
function selection(){if(!vehicleCategory())return null;if(!publicState?.check.isConnected||!publicState.ready||publicState.verificationPending)throw new Error(T('انتظر تحميل بيانات السيارة أو أعد المحاولة','Wait for vehicle details to load or retry'));if(!publicState.check.checked)publicState.check.checked=true;if(publicState.ticket!==visitorIdentity.ticket)throw Error(T('تحقق من الإقامة مجددًا','Verify identity again'));if(publicState.blockedError)throw Error(publicState.blockedError);const s=publicState.selected.filter(x=>x[1].checked).map(x=>x[0]);if(!publicState.ready||!publicState.cars.value||!s.length)throw Error(T('اختر السيارة والخدمات المطلوبة','Choose the vehicle and required services'));if(!publicState.allowedVehicles.has(publicState.cars.value))throw Error(errorMessage('vehicle_not_assigned'));if(s.some(key=>!publicState.allowedServices.has(key)))throw Error(errorMessage('invalid_services'));const floor=readingValue(selectedVehicle(publicState));if(publicState.km.value!==''&&floor!==null&&Number(publicState.km.value)<floor)throw Error(errorMessage('odometer_below_recorded'));if(publicState.km.value===''||!publicState.km.checkValidity()||!publicState.image||publicState.imagePending)throw Error(T('أدخل قراءة العداد وأرفق صورته وانتظر اكتمال تحميلها','Enter the odometer and wait for its photo to load'));return {vehicle_id:publicState.cars.value,other_ticket:publicState.otherTicket,services:s,odometer:Number(publicState.km.value),image:publicState.image};}
async function mountAdmin(){
 const host=document.getElementById('admin-vehicle-request-fields'),category=document.getElementById('tf_cat');if(!host||!category)return;
 const applies=isVehicleCategory(category.value)||isVehicleCategory(category.selectedOptions[0]?.textContent);host.hidden=!applies;
 if(!applies)return;const actor=evidenceActor('admin');if(!actor)return;if(host.dataset.actor===actor)return;host.dataset.actor=actor;adminState=null;
 host.replaceChildren(N('p',T('جارٍ تحميل السيارات…','Loading vehicles…')));
 try{
  const config=await admRpc('advacon_admin_vehicle_request_options',{});if(!host.isConnected||evidenceActor('admin')!==actor)return;if(!config?.ok)throw Error('vehicle_options_unavailable');host.replaceChildren();
  const cars=N('select'),km=N('input'),picture=N('input'),choices=N('div'),status=N('p'),preview=N('img');cars.add(new Option(T('اختر المركبة والموظف المستفيد','Choose the vehicle and beneficiary employee'),''));
  for(const v of config.vehicles||[])cars.add(new Option([T(v.name_ar||v.name_en,v.name_en||v.name_ar),v.plate,v.description].filter(Boolean).join(' — '),v.id));
  host.append(N('p',T('يبقى مدير القسم مقدم الطلب. اختر المركبة حسب الموظف المستلم حاليًا.','The department manager remains the requester. Select a vehicle by its current holder.')),field(T('المركبة والموظف المستفيد *','Vehicle and beneficiary employee *'),cars));
  choices.className='vr-choices';choices.setAttribute('role','group');choices.setAttribute('aria-label',T('خدمات المركبة','Vehicle services'));const selected=[];
  for(const service of config.services||[]){const input=N('input');input.type='checkbox';input.value=service.key;choices.append(field(T(service.ar,service.en),input));selected.push([service.key,input]);}host.append(choices);
  km.type='number';km.min=0;km.max=10000000;km.required=true;km.inputMode='numeric';picture.type='file';picture.accept=AdvaconImages.accept;picture.required=true;
  status.className='vr-photo-status';status.setAttribute('role','status');preview.className='vr-photo-preview';preview.alt=T('صورة العداد المختارة','Selected odometer photo');preview.hidden=true;
  host.append(field(T('قراءة العداد الحالية (كم) *','Current odometer (km) *'),km),field(T('صورة واضحة للعداد *','Clear odometer photo *'),picture),status,preview);
  const reference=N('p');reference.className='vr-reading-reference';host.append(reference);const data={host,actor,cars,km,selected,image:null,vehicles:config.vehicles||[]};adminState=data;let sequence=0;const showReference=()=>{const vehicle=selectedVehicle(data);reference.textContent=vehicle?readingReference(vehicle):'';km.min=readingValue(vehicle)??0;};
  cars.onchange=()=>{sequence++;data.image=null;km.value='';picture.value='';status.textContent='';preview.hidden=true;preview.removeAttribute('src');showReference();};
  picture.onchange=async()=>{const own=++sequence;data.image=null;preview.hidden=true;preview.removeAttribute('src');status.textContent='';const file=picture.files[0];if(!file)return;status.textContent=T('جارٍ تجهيز الصورة…','Preparing photo…');try{const image=await AdvaconVehicleServices.photo(file);if(own===sequence&&adminState===data&&host.isConnected&&evidenceActor('admin')===actor){data.image=image;preview.src=image;preview.hidden=false;status.textContent=T('الصورة جاهزة. تأكد أن أرقام العداد واضحة.','Photo ready. Check that the odometer digits are clear.');}}catch(error){if(own===sequence&&adminState===data&&host.isConnected)status.textContent=error.message;}};
 }catch(error){if(!host.isConnected||evidenceActor('admin')!==actor)return;const retry=N('button',T('إعادة تحميل السيارات','Retry vehicle loading'));retry.type='button';retry.onclick=()=>{delete host.dataset.actor;mountAdmin();};host.replaceChildren(N('p',T('تعذر تحميل بيانات السيارات. أعد المحاولة.','Vehicle details could not load. Please retry.')),retry);}
}
function adminSelection(category){
 if(!isVehicleCategory(category))return null;const data=adminState;
 if(!data?.host.isConnected||data.actor!==evidenceActor('admin'))throw Error(T('انتظر تحميل بيانات السيارة أو أعد المحاولة','Wait for vehicle details to load or retry'));
 const vehicle=data.vehicles.find(v=>v.id===data.cars.value),services=data.selected.filter(x=>x[1].checked).map(x=>x[0]);
 if(!vehicle||!services.length)throw Error(T('اختر السيارة والخدمات المطلوبة','Choose the vehicle and required services'));
 const floor=readingValue(vehicle);if(data.km.value!==''&&floor!==null&&Number(data.km.value)<floor)throw Error(errorMessage('odometer_below_recorded'));
 if(data.km.value===''||!data.km.checkValidity()||!data.image)throw Error(T('أدخل قراءة العداد وأرفق صورته وانتظر اكتمال تحميلها','Enter the odometer and wait for its photo to load'));
 return {vehicle_id:vehicle.id,beneficiary_employee_id:vehicle.employee_id,services,odometer:Number(data.km.value),image:data.image};
}
const requestPhoto=value=>typeof value==='string'&&value.length<=2000000&&/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';
const serviceLabel=key=>{const service=(window.AdvaconVehicleServiceCatalog||[]).find(s=>s.key===key);return service?T(service.ar,service.en):key;};
function receiptSnapshot(value){if(!value)return null;return {label:publicState?.cars.selectedOptions[0]?.textContent||'',odometer:value.odometer,photo:requestPhoto(value.image),services:value.services.map(serviceLabel)};}
// Evidence is fetched only for the opened request, never added to the full request list.
const evidenceLoads=new WeakMap();
function evidenceActor(role){if(typeof state==='undefined'||state.role!==role)return '';return role==='admin'?(typeof admActorKey==='function'?admActorKey():''):role==='staff'?(typeof stfGetSession==='function'?stfGetSession()?.token||'':''):'';}
async function mountEvidence(host,id,role){
 id=Number(id);const actor=evidenceActor(role);if(!host?.isConnected||!Number.isSafeInteger(id)||id<=0||!actor)return;
 const previous=evidenceLoads.get(host);if(previous?.id===id&&previous.actor===actor)return;
 const load={id,actor};evidenceLoads.set(host,load);host.classList.add('vr-evidence');host.replaceChildren(N('p',T('جارٍ تحميل بيانات المركبة…','Loading vehicle details…')));
 const current=()=>host.isConnected&&evidenceLoads.get(host)===load&&evidenceActor(role)===actor;
 try{
  const data=await (role==='admin'?admRpc('advacon_vehicle_request_details',{p_request_id:id}):sbRpc('advacon_vehicle_request_details',{p_request_id:id,p_staff_token:actor}));
  if(!current()){if(evidenceLoads.get(host)===load)host.replaceChildren();return;}
  if(!data?.ok)throw Error('vehicle_evidence_unavailable');host.replaceChildren();if(!data.vehicle)return;
  host.append(N('h4',T('بيانات المركبة وقت الطلب','Vehicle details at submission')),N('p',[data.vehicle.plate,data.vehicle.description].filter(Boolean).join(' — ')));
  if(data.beneficiary){const name=T(data.beneficiary.name_ar||data.beneficiary.name_en,data.beneficiary.name_en||data.beneficiary.name_ar);if(name)host.append(N('p',T('الموظف المستفيد: ','Beneficiary employee: ')+name));}
  if(Array.isArray(data.services)&&data.services.length)host.append(N('p',T('الخدمات المطلوبة: ','Requested services: ')+data.services.map(serviceLabel).join('، ')));
  host.append(N('p',T('قراءة العداد عند تقديم الطلب: ','Odometer at submission: ')+(data.request_reading==null?T('غير مسجلة','Not recorded'):String(data.request_reading)+' '+T('كم','km'))));
  const photo=requestPhoto(data.request_photo);if(photo){const image=N('img');image.src=photo;image.alt=T('صورة العداد عند تقديم الطلب','Odometer photo at submission');const details=N('details');details.open=true;details.append(N('summary',T('صورة العداد','Odometer photo')),image);host.append(details);}else host.append(N('p',T('صورة العداد غير مسجلة لهذا الطلب.','No odometer photo is recorded for this request.')));
 }catch(error){if(!current())return;const retry=N('button',T('إعادة المحاولة','Retry'));retry.type='button';retry.className='btn sec';retry.onclick=()=>{evidenceLoads.delete(host);mountEvidence(host,id,role);};host.replaceChildren(N('p',T('تعذر عرض بيانات المركبة. أعد المحاولة.','Vehicle details could not load. Please retry.')),retry);}
}
function discoverEvidence(node){if(node.nodeType!==1)return;const hosts=node.matches('[data-vehicle-request-detail]')?[node]:node.querySelectorAll('[data-vehicle-request-detail]');for(const host of hosts)mountEvidence(host,host.dataset.vehicleRequestDetail,host.dataset.vehicleDetailRole);}
async function mountClose(id){
 const host=document.getElementById('vehicle-close-fields');if(!host)return;
 closeState={id,host,ready:false};const state=closeState;
 host.replaceChildren(N('p',T('جارٍ التحقق من بيانات الطلب…','Checking request details…')));
 try{const d=await admRpc('advacon_vehicle_request_close_context',{p_request_id:id});if(closeState!==state||!host.isConnected)return;if(!d?.ok)throw Error(T('تعذر تحميل بيانات الطلب، أعد المحاولة','Could not load request details; retry'));host.replaceChildren();state.ready=true;if(!d.vehicle||d.applied)return;if(!vehicleVersion(d.vehicle.version))throw Error(errorMessage('version_required'));state.vehicle=d.vehicle;
 host.append(N('h4',[d.vehicle.plate,d.vehicle.description].filter(Boolean).join(' — ')),N('p',T('أكد الخدمات المنفذة ضمن إغلاق الطلب. تتحدث السيارة تلقائيًا بعد الإغلاق.','Confirm performed services here. Closing updates the vehicle automatically.')));
 if(d.request_reading!=null){const evidence=N('details');evidence.append(N('summary',T('قراءة العداد وقت الطلب: ','Odometer when requested: ')+d.request_reading));if(/^data:image\/(jpeg|png);base64,/.test(d.request_photo||'')){const img=N('img');img.src=d.request_photo;img.alt=T('صورة العداد عند تقديم الطلب','Odometer photo at submission');img.style.maxWidth='100%';evidence.append(img);}host.append(evidence);}
 const form=N('form');state.form=form;const km=N('input'),date=N('input');km.type='number';km.min=0;km.required=true;date.type='date';date.required=true;date.max=new Date(Date.now()+10800000).toISOString().slice(0,10);km.max=10000000;km.value=d.draft?.odometer??'';date.value=d.draft?.observed_on||date.max;form.append(field(T('قراءة العداد عند التنفيذ','Odometer at service'),km),field(T('تاريخ التنفيذ','Service date'),date));state.km=km;state.date=date;
 const reference=N('p');reference.textContent=readingReference(d.vehicle);form.prepend(reference);
 const historical=N('p');historical.setAttribute('role','status');historical.className='vw-partial-history';historical.hidden=true;
 const updateHistorical=()=>{const prior=readingValue(d.vehicle),olderReading=km.value!==''&&prior!==null&&Number(km.value)<prior,olderDate=date.value&&d.vehicle.observed_on&&date.value<d.vehicle.observed_on;historical.hidden=!(olderReading||olderDate);historical.textContent=historical.hidden?'':T('هذه قراءة تنفيذ قديمة مقارنة بآخر قراءة مسجلة. سيُحفظ التنفيذ بتاريخِه، ولن تُخفض قراءة العداد الحالية أو تُستبدل معلومات أحدث.','This execution predates the latest recorded reading. It will remain dated history without lowering the current odometer or replacing newer information.');};
 km.oninput=updateHistorical;date.onchange=updateHistorical;updateHistorical();form.append(historical);
 state.getters=d.services.map(key=>AdvaconVehicleServices.formEntries(form,{single:key,execution:true,initial:d.draft?.entries?.find(e=>e.service===key)}));host.append(form);
 }catch(e){if(closeState!==state||!host.isConnected)return;state.ready=false;host.replaceChildren(N('p',e.message));const retry=N('button',T('إعادة المحاولة','Retry'));retry.type='button';retry.onclick=()=>mountClose(id);host.append(retry);}
}
async function prepareClose(id){
 const s=closeState;if(!s||s.id!==id||!s.ready||!s.host.isConnected){toast(T('انتظر تحميل بيانات الطلب أو أعد المحاولة','Wait for request details or retry'));return false;}
 if(!s.vehicle)return true;if(s.saving)return false;if(!s.form.reportValidity())return false;
 const entries=s.getters.flatMap(g=>g());if(!entries.length){toast(T('حدد الخدمة التي نُفذت','Select the service actually performed'));return false;}
 if(!vehicleVersion(s.vehicle.version)){toast(errorMessage('version_required'));return false;}
 s.saving=true;
 try{
  const r=await admRpc('advacon_vehicle_execution',{p_request_id:id,p_vehicle_id:s.vehicle.id,p_payload:{odometer:s.km.value,observed_on:s.date.value,entries,expected_vehicle_version:s.vehicle.version}});
  if(closeState!==s||!s.host.isConnected)return false;
  if(!r?.ok)throw Error(r?.error||'vehicle_execution_save_failed');return true;
 }catch(error){
  toast(errorMessage(error?.message)||T('تعذر حفظ بيانات التنفيذ. راجع المدخلات ثم أعد المحاولة.','Could not save the service details. Check the fields and retry.'));
  closeFailed(id,error);
  return false;
 }finally{s.saving=false;}
}
function closeFailed(id,error){
 const s=closeState;if(!s||String(s.id)!==String(id)||!s.host.isConnected)return false;
 const code=String(error?.error||error?.message||error?.details||error||'');
 const stale=/record_changed_refresh|vehicle_version_conflict|vehicle_changed_refresh|version_required/.test(code);
 let notice=s.host.querySelector('[data-close-failure]');if(!notice){notice=N('div');notice.dataset.closeFailure='';notice.setAttribute('role','alert');s.host.append(notice);}
 const mapped=errorMessage(code);notice.replaceChildren(N('p',mapped?T('لم يُغلق الطلب. ','The request was not closed. ')+mapped:T('لم يُغلق الطلب. بيانات التنفيذ ما زالت ظاهرة؛ راجع سبب الخطأ ثم أعد المحاولة.','The request was not closed. Your execution details remain visible; review the error and retry.')));
 if(stale){s.ready=false;const retry=N('button',T('تحديث بيانات المركبة وإعادة المراجعة','Refresh vehicle details and review again'));retry.type='button';retry.className='btn sec';retry.onclick=()=>mountClose(id);notice.append(retry);}
 return true;
}
function errorMessage(code){const text=String(code||'');const messages={version_required:['حدّث بيانات المركبة قبل حفظ التنفيذ.','Refresh vehicle details before saving the execution.'],record_changed_refresh:['تغيّرت بيانات المركبة أثناء العمل. حدّثها وراجع التنفيذ مجددًا.','The vehicle changed while you were working. Refresh it and review the execution again.'],vehicle_changed_refresh:['تغيّرت بيانات المركبة. أعد تحميلها قبل الحفظ.','Vehicle details changed. Reload before saving.'],vehicle_version_conflict:['تغيّرت بيانات المركبة. أعد تحميلها قبل الحفظ.','Vehicle details changed. Reload before saving.'],odometer_date_before_recorded:['تاريخ القراءة أقدم من القراءة الحالية. راجع التاريخ؛ السجل التاريخي لا يستبدل القراءة الحالية.','The reading date is older than the current observation. Check the date; history does not replace the current reading.'],vehicle_details_required:['اختر المركبة والخدمات وأدخل قراءة العداد وأرفق صورته.','Choose the vehicle and services, enter the odometer and attach its photo.'],department_manager_employee_required:['اربط مدير القسم بسجل الموظف قبل إضافة طلب مركبة.','Link the department manager to their employee record before adding a vehicle request.'],invalid_services:['اختر خدمات المركبة من القائمة.','Choose vehicle services from the list.'],vehicle_requests_disabled:['خدمات السيارات لم تُفعّل بعد.','Vehicle requests are not enabled yet.'],vehicle_not_assigned:['تغيّرت عهدة السيارة. تحقق من الموظف واختر سيارته مجددًا.','Vehicle custody changed. Verify the employee and select their vehicle again.'],vehicle_service_not_due:['الخدمة لم تستحق بعد حسب القاعدة المعتمدة. راجع المسؤول إن كان هناك عطل طارئ.','This service is not due under the configured rule. Contact the administrator for an urgent fault.'],odometer_below_recorded:['قراءة العداد أقل من القراءة المسجلة للسيارة. تحقق منها.','The odometer is below the recorded reading. Check it.'],odometer_photo_required:['أرفق صورة واضحة للعداد.','Attach an odometer photo.'],invalid_current_reading:['تحقق من قراءة العداد وتاريخها.','Check the odometer reading and its date.']};for(const [key,labels]of Object.entries(messages))if(text.includes(key))return T(...labels);return null;}
window.AdvaconVehicleRequests={mountPublic,refreshPublic,hasPublicDraft,isPublicBusy,resetPublicAfterSubmit,selection,mountClose,prepareClose,closeFailed,errorMessage,categoryChanged,mountEvidence,receiptSnapshot,requestPhoto,mountAdmin,adminSelection};
new MutationObserver(changes=>{mountPublic();if(typeof visitorSubmitting!=='undefined'&&visitorSubmitting&&typeof lockVisitorSubmission==='function')lockVisitorSubmission(true);for(const change of changes)for(const node of change.addedNodes)discoverEvidence(node);}).observe(document.body,{childList:true,subtree:true});
discoverEvidence(document.body);
})();
