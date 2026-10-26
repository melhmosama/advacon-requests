(function(){'use strict';
const C=()=>window.AdvaconVehicleServiceCatalog,ar=()=>document.documentElement.dir==='rtl',T=(a,b)=>ar()?a:b;
const labels={yes:['نعم','Yes'],no:['لا','No'],none:['بدون','None'],oil:['زيت','Oil'],air:['هواء','Air'],cabin:['مكيف','Cabin'],oil_air:['زيت وهواء','Oil & air'],oil_cabin:['زيت ومكيف','Oil & cabin'],all:['الكل','All'],alignment:['ميزان','Alignment'],balancing:['ترصيص','Balancing'],both:['كلاهما','Both'],front_pads:['فحمات أمامية','Front pads'],rear_pads:['فحمات خلفية','Rear pads'],all_pads:['فحمات أمامية وخلفية','All pads'],discs:['هوبات','Discs'],fluid:['سائل فرامل','Brake fluid'],repair:['إصلاح','Repair'],filter:['فلتر','Filter'],cleaning:['تنظيف','Cleaning'],gas:['شحن غاز','Gas'],multiple:['عدة أعمال','Multiple'],pass:['اجتاز','Pass'],fail:['لم يجتز','Fail'],engine:['محرك','Engine'],cooling:['تبريد','Cooling'],fuel:['وقود','Fuel'],lights:['إنارة','Lights'],starter:['سلف','Starter'],alternator:['دينمو','Alternator'],wiring:['توصيلات','Wiring'],other:['أخرى','Other'],body:['هيكل','Body'],glass:['زجاج','Glass'],wipers:['مساحات','Wipers'],replace:['استبدال','Replacement'],adjust:['ضبط','Adjustment']};
function N(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}function B(text,fn){const b=N('button',text,'btn sec');b.type='button';b.onclick=fn;return b;}function field(text,input){const l=N('label',text);l.append(input);return l;}function opts(values){const s=N('select');s.add(new Option(T('اختر','Choose'),''));for(const [k,l]of values)s.add(new Option(l,k));return s;}
function today(){return new Date(Date.now()+10800000).toISOString().slice(0,10);}
function formEntries(root,{single,execution=false,initial,partial=false,forceDone=false}={}){
 const getters=[];
 for(const c of C().filter(c=>!single||c.key===single)){
  const box=N('details',undefined,'vw-panel');if(single)box.open=true;
  box.append(N('summary',T(c.ar,c.en),'vw-summary'));
  const status=opts(execution||forceDone?[['done',T('تم التنفيذ','Performed')]]:[['done',T('نُفذت سابقًا','Previously performed')],['never',T('لم تُنفّذ سابقًا','Never performed')],['needs_admin',T('البيانات تحتاج استكمال الأدمن','Admin must complete data')]]);
  status.required=!execution;status.dataset.serviceStatus=c.key;
  const statusField=field(execution?T('اختر الخدمات المنفذة فقط','Select only performed services'):T('حالة الخدمة','Service status'),status);
  statusField.hidden=forceDone;box.append(statusField);
  if(partial)box.append(N('p',T('اكتب المعلومات المؤكدة فقط. اترك التفاصيل غير المعروفة فارغة.','Enter only confirmed information. Leave unknown details blank.'),'vw-muted'));
  const fields=N('div',undefined,'vw-form');fields.hidden=true;
  const date=N('input');date.type='date';date.max=today();date.dataset.serviceDate=c.key;
  fields.append(field(T('تاريخ التنفيذ','Service date'),date));
  let receipt=initial?.details?.receipt||'',readSequence=0;const values={};
  for(const f of c.fields){
   const input=f.kind==='choice'?opts(f.options.map(k=>[k,labels[k]?T(...labels[k]):k])):N('input');
   if(f.kind!=='choice'){input.type=f.kind.includes('date')?'date':'number';if(input.type==='number'){input.min=f.key==='odometer'?0:1;input.max=10000000;input.step='any';}}
   input.dataset.serviceField=f.key;
   if(partial)input.setAttribute('aria-label',T(f.ar,f.en)+' — '+T('اتركه فارغًا إن لم يُعرف','leave blank if unknown'));
   if(recorded(initial?.details?.[f.key]))input.value=initial.details[f.key];
   values[f.key]=input;fields.append(field(T(f.ar,f.en),input));
  }
  const attach=N('input');attach.type='file';attach.accept='image/jpeg,image/png,application/pdf';
  attach.onchange=()=>{
   const sequence=++readSequence,file=attach.files[0];attach.setCustomValidity('');if(!file)return;
   if(file.size>750000){attach.setCustomValidity(T('الحد الأقصى للمرفق 750 كيلوبايت','Attachment maximum is 750 KB'));attach.reportValidity();return;}
   if(!['image/jpeg','image/png','application/pdf'].includes(file.type)){attach.setCustomValidity(T('اختر صورة JPEG أو PNG أو ملف PDF','Choose a JPEG/PNG image or PDF'));attach.reportValidity();return;}
   attach.setCustomValidity(T('جارٍ قراءة المرفق','Reading attachment'));
   const reader=new FileReader();reader.onload=()=>{if(sequence===readSequence){receipt=reader.result;attach.setCustomValidity('');}};reader.onerror=()=>{if(sequence===readSequence)attach.setCustomValidity(T('تعذر قراءة الملف','Cannot read file'));};reader.readAsDataURL(file);
  };
  fields.append(field(T('مرفق إن وجد — صورة أو PDF حتى 750 كيلوبايت','Optional image/PDF, up to 750 KB'),attach));
  status.onchange=()=>{const done=status.value==='done';fields.hidden=!done;date.required=done;for(const f of c.fields)values[f.key].required=done&&!partial&&f.kind!=='optional_date';attach.disabled=!done;};
  if(initial){status.value=initial.status||'done';date.value=initial.performed_on||initial.date||'';}if(forceDone)status.value='done';status.onchange();
  box.append(fields);root.append(box);
  getters.push(()=>{
   if(execution&&!status.value)return null;
   const details={};
   if(status.value==='done'){
    for(const [key,input]of Object.entries(values)){if(!partial||recorded(input.value))details[key]=input.value;}
    if(partial&&initial?.details)for(const key of ['replaced_quantity','partial_replacement','_historical_action'])if(initial.details[key]!==undefined)details[key]=initial.details[key];
    if(receipt)details.receipt=receipt;
   }
   return {service:c.key,status:status.value,date:status.value==='done'?date.value:'',details};
  });
 }
 return ()=>getters.map(g=>g()).filter(Boolean);
}

async function photo(file){return AdvaconImages.dataURL(await AdvaconImages.prepare(file,{maxEdge:1400,forceJpeg:true,quality:.8}));}
function recorded(value){return value!==undefined&&value!==null&&!(typeof value==='string'&&value.trim()==='');}
function numberValue(value){if(!recorded(value))return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function partialNotice(s){return s?.details?._partial_historical_details===true?T('بيانات قديمة جزئية — التفاصيل غير المسجلة تحتاج استكمال.','Partial historical data — unrecorded details still need completion.'):'';}
function serviceDetails(c,s,{includeMissing=false}={}){if(!s)return [T('غير مسجل','Not recorded')];const details=s.details||{},rows=[];for(const f of c.fields){const value=details[f.key];if(recorded(value))rows.push(T(f.ar,f.en)+': '+(labels[value]?T(...labels[value]):String(value)));else if(includeMissing)rows.push(T(f.ar,f.en)+': '+T('غير مسجل','Not recorded'));}
 if(c.key==='battery'&&recorded(details.replaced_quantity))rows.push(T('عدد البطاريات المستبدلة: ','Batteries replaced: ')+details.replaced_quantity);
 if(c.key==='battery'&&details.partial_replacement===true)rows.push(T('استبدال جزئي — لا يعني استبدال جميع بطاريات السيارة.','Partial replacement — not all vehicle batteries were replaced.'));
 return rows;}
function due(s,rule,vehicle){if(!s||s.status!=='done')return T('يحتاج بيانات مكتملة','Complete data required');const details=s.details||{},km=numberValue(recorded(rule?.interval_km)?rule.interval_km:s.service==='oil'?details.interval_km:null),days=numberValue(rule?.interval_days),parts=[],serviceKm=numberValue(details.odometer),currentKm=numberValue(vehicle?.odometer);
 if(km!==null&&km>0){if(serviceKm!==null&&serviceKm>=0){const target=serviceKm+km;parts.push(T('العداد القادم: ','Next odometer: ')+target+(currentKm!==null&&currentKm>=0?T(' · المتبقي: ',' · Remaining: ')+(target-currentKm)+' '+T('كم','km'):''));}else parts.push(T('استحقاق المسافة يحتاج قراءة العداد وقت الخدمة.','Mileage due needs the odometer at service.'));}
 if(days!==null&&days>0&&s.performed_on){const date=new Date(s.performed_on+'T00:00:00Z');if(Number.isFinite(date.getTime())){date.setUTCDate(date.getUTCDate()+days);parts.push(T('التاريخ القادم: ','Next date: ')+date.toISOString().slice(0,10));}}
 if(s.service==='inspection'&&details.result==='pass'&&details.expires_on)parts.push(T('انتهاء الفحص: ','Inspection expiry: ')+details.expires_on);if(s.service==='battery'&&details.warranty==='yes'&&details.warranty_end)parts.push(T('انتهاء الضمان: ','Warranty expiry: ')+details.warranty_end);return parts.join(' · ')||T('لا توجد قاعدة استحقاق معتمدة','No due rule configured');}

async function mount(root,v,api){const loading=N('p',T('جارٍ التحميل','Loading'));root.replaceChildren(loading);try{const d=await api('advacon_vehicle_services',{p_vehicle_id:v.id});if(!root.isConnected||root.firstChild!==loading)return;root.replaceChildren(N('h2',T('حالة خدمات السيارة','Vehicle service status')),N('p',T('الطلبات القديمة محفوظة، ولا تتحول تلقائيًا إلى صيانة منفذة. بيانات الموظف تظهر كتأسيس، والتنفيذ الفعلي كتحديث مرتبط بطلب.','Historical requests remain separate from performed maintenance. Employee baseline and executed service are labeled separately.')));const anchor=root.firstChild,stillHere=()=>root.isConnected&&root.firstChild===anchor,reload=()=>stillHere()?mount(root,v,api):undefined;const tools=N('div',undefined,'vw-tools');tools.append(B(T('تقرير حالة الخدمات / PDF','Service status report / PDF'),()=>AdvaconVehicles.report(T('حالة خدمات السيارة','Vehicle service status'),[T('الخدمة','Service'),T('آخر تنفيذ','Last performed'),T('البيانات','Details'),T('الاستحقاق','Due')],C().map(c=>{const s=d.states.find(x=>x.service===c.key);return [T(c.ar,c.en),s?.performed_on||T('غير مسجل','Not recorded'),[partialNotice(s),...serviceDetails(c,s,{includeMissing:true})].filter(Boolean).join(' · '),due(s,d.rules.find(r=>r.service===c.key),d.vehicle)];}),v.plate||v.description)));if(d.can_reopen_intake===true){
  tools.append(B(T('رابط تحديث بيانات السيارات','Vehicle data update link'),()=>{const i=N('input');i.readOnly=true;i.value=new URL('/vehicle-intake',location.href).href;tools.append(i);i.select();}));
  const reopen=B(T('إعادة فتح تعبئة هذه السيارة','Reopen intake for this vehicle'),async()=>{
   const yes=await AdvaconUI.confirm({title:T('إعادة فتح تعبئة السيارة','Reopen vehicle intake'),message:T('سيتمكن صاحب السيارة من تعبئة بياناتها مرة أخرى. هل تريد إعادة فتح التعبئة لهذه السيارة؟','The vehicle holder will be able to submit its intake again. Reopen intake for this vehicle?'),confirmLabel:T('إعادة فتح التعبئة','Reopen intake')});
   if(!yes||!stillHere())return;reopen.disabled=true;
   try{const result=await api('advacon_vehicle_intake_reopen',{p_vehicle_id:v.id});if(!result?.ok)throw Error(result?.error||'operation_failed');AdvaconUI.toast(T('أعيد فتح التعبئة لهذه السيارة','Intake reopened for this vehicle'));}
   catch(e){AdvaconUI.toast(message(e));}finally{if(reopen.isConnected)reopen.disabled=false;}
  });tools.append(reopen);
 }root.append(tools);
 const grid=N('div',undefined,'vw-grid');for(const c of C()){const s=d.states.find(x=>x.service===c.key),rule=d.rules.find(x=>x.service===c.key);const card=N('article',undefined,'vw-card');card.append(N('h3',T(c.ar,c.en)),N('p',!s?T('غير مسجل','Not recorded'):s.status==='never'?T('لم تُنفّذ سابقًا','Never performed'):s.status==='needs_admin'?T('تحتاج استكمال الأدمن','Admin completion required'):T('آخر تنفيذ: ','Last service: ')+(s.performed_on||T('غير مسجل','Not recorded'))));if(partialNotice(s))card.append(N('p',partialNotice(s),'vw-partial-history'));if(s?.status==='done')for(const text of serviceDetails(c,s,{includeMissing:!!partialNotice(s)}))card.append(N('p',text,'vw-muted'));card.append(N('p',due(s,rule,d.vehicle)));if(s?.details?.receipt&&/^data:(image\/(jpeg|png)|application\/pdf);base64,/.test(s.details.receipt)){const a=N('a',T('تحميل المرفق','Download attachment'));a.href=s.details.receipt;a.download=c.key+(s.details.receipt.startsWith('data:application/pdf')?'.pdf':'.jpg');card.append(a);}if(s)card.append(N('small',s.basis==='employee_baseline'?T('بيانات تأسيس من الموظف','Employee baseline'):s.basis==='request_execution'?'TSK-'+s.request_id:T('تعديل الأدمن','Admin update')));if(d.can_correct_services===true)card.append(B(T('تصحيح / إضافة سجل خدمة','Correct / add service history'),()=>editService(c,v,d,api,reload)));
 if(d.can_manage_rules===true)card.append(B(T('تعديل قاعدة الاستحقاق','Edit due rule'),()=>editRule(c,v,d,api,reload)));grid.append(card);}root.append(grid);
 const open=N('details',undefined,'vw-panel');open.append(N('summary',T('الطلبات المفتوحة','Open requests')+' ('+d.open_requests.length+')'));d.open_requests.forEach(r=>open.append(N('p','TSK-'+r.id+' · '+r.title+' · '+r.status)));root.append(open);
 const hist=N('details',undefined,'vw-panel');hist.append(N('summary',T('سجل تحديثات الخدمات','Service update history')+' ('+d.history.length+')'));d.history.forEach(s=>hist.append(N('p',(C().find(c=>c.key===s.service)?.[ar()?'ar':'en']||s.service)+' · '+(s.performed_on||s.created_at.slice(0,10))+' · '+(s.basis==='employee_baseline'?T('تأسيس الموظف','Employee baseline'):s.basis==='admin'?T('تعديل الأدمن','Admin update'):T('تنفيذ طلب','Request execution'))+(s.request_id?' · TSK-'+s.request_id:'')+(partialNotice(s)?' · '+partialNotice(s):'')+(s.service==='battery'?' · '+serviceDetails({key:'battery',fields:[]},s).join(' · '):''))));root.append(hist);
 for(const row of d.history||[])if(row.details?._correction_reason){const line=N('p',T('سبب تعديل الخدمة: ','Service correction reason: ')+row.details._correction_reason+' · '+(row.details._correction_mode==='historical'?T('سجل تاريخي فقط','Historical record only'):T('تصحيح الحالة الحالية','Current-state correction')));hist.append(line);}
 renderOdometerHistory(root,d,api);
 if(d.evidence){const det=N('details',undefined,'vw-panel');det.append(N('summary',T('صورة عداد التأسيس','Baseline odometer photo')));const img=N('img');img.src=d.evidence.image;img.alt=T('صورة العداد','Odometer photo');img.style.maxWidth='100%';det.append(img);root.append(det);}
 }catch(e){if(root.isConnected&&root.firstChild===loading)AdvaconUI.errorState(root,e,()=>mount(root,v,api));}}
function message(error){
 const text=String(error?.message||error||'');
 const map={
  version_required:['حدّث بيانات السيارة ثم أعد المحاولة.','Refresh vehicle details and retry.'],
  record_changed_refresh:['تغيّرت بيانات السيارة أثناء العمل. أعد فتح النموذج للاطلاع على أحدث المعلومات.','The vehicle changed while you were working. Reopen the form to review current information.'],
  vehicle_version_conflict:['تغيّرت بيانات السيارة. أعد فتح النموذج قبل الحفظ.','Vehicle details changed. Reopen the form before saving.'],
  correction_reason_required:['اكتب سبب التصحيح بوضوح (5 أحرف على الأقل).','Enter a clear correction reason (at least 5 characters).'],
  correction_mode_required:['اختر سجلًا تاريخيًا أو تصحيحًا للحالة الحالية.','Choose historical entry or explicit current-state correction.'],
  historical_service_date_required:['السجل التاريخي يحتاج خدمة منفذة وتاريخ تنفيذ صحيحًا.','A historical entry needs a performed service and a valid service date.'],
  service_date_required:['أدخل تاريخ تنفيذ صحيحًا للخدمة.','Enter a valid service date.'],
  service_odometer_above_current:['عداد وقت الخدمة أعلى من القراءة الحالية المسجلة. صحّح القيمة أو حدّث قراءة السيارة الموثقة أولًا.','The service odometer exceeds the recorded current reading. Correct it or update the vehicle’s documented reading first.'],
  invalid_service_rules:['أدخل فاصلًا موجبًا صحيحًا؛ عدد الأيام لا يتجاوز 36500.','Enter a valid positive interval; days must not exceed 36500.'],
  vehicle_service_correction_required:['استخدم تصحيح الخدمة أو تعديل قاعدة الاستحقاق من ملف السيارة.','Use service correction or due-rule editing from the vehicle file.'],
  invalid_reason:['اكتب سببًا واضحًا من 5 إلى 1000 حرف.','Enter a clear reason of 5–1000 characters.'],
  reason_required:['اكتب سبب هذا التعديل.','Enter a reason for this change.'],
  odometer_photo_required:['أرفق صورة واضحة للعداد وانتظر تجهيزها.','Attach a clear odometer photo and wait for it to finish loading.'],
  invalid_current_reading:['راجع قراءة العداد وتاريخها.','Check the odometer reading and its date.'],
  odometer_reference_changed:['تغيّرت قراءة العداد المسجلة. أعد فتح النموذج قبل التصحيح.','The recorded odometer changed. Reopen the form before correcting it.'],
  vehicle_reading_changed_refresh:['تغيّرت قراءة العداد المسجلة. أعد فتح النموذج وراجع القراءة الجديدة قبل التصحيح.','The recorded odometer changed. Reopen the form and review the new reading before correcting it.'],
  command_id_reused:['اختلفت بيانات محاولة الحفظ. أعد فتح النموذج وراجع المعلومات.','The save attempt changed. Reopen the form and review its information.'],
  command_id_conflict:['اختلفت بيانات محاولة الحفظ. أعد فتح النموذج وراجع المعلومات.','The save attempt changed. Reopen the form and review its information.'],
  permission_denied:['لا تملك صلاحية تنفيذ هذا التعديل.','You do not have permission to make this change.'],
  access_denied:['لا تملك صلاحية تنفيذ هذا التعديل.','You do not have permission to make this change.'],
  forbidden:['لا تملك صلاحية تنفيذ هذا التعديل.','You do not have permission to make this change.'],
  invalid_service_details:['راجع تفاصيل الخدمة المدخلة. اترك المعلومة غير المعروفة فارغة.','Check the service details. Leave unknown values blank.'],
  invalid_service_date:['اختر تاريخ تنفيذ صحيحًا لا يتجاوز اليوم.','Choose a valid service date no later than today.']
 };
 for(const [key,value]of Object.entries(map))if(text.includes(key))return T(...value);
 return window.AdvaconVehicleRequests?.errorMessage?.(text)||T('تعذر حفظ التعديل. راجع المدخلات أو أعد المحاولة.','The change could not be saved. Check the fields or retry.');
}
function validVersion(value){return value!==null&&value!==undefined&&/^[1-9][0-9]*$/.test(String(value));}
function commandId(){if(window.crypto?.randomUUID)return window.crypto.randomUUID();if(!window.crypto?.getRandomValues)throw Error('secure_browser_required');const b=window.crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function reasonField(form){const reason=N('textarea');reason.required=true;reason.minLength=5;reason.maxLength=1000;reason.rows=3;reason.dataset.changeReason='true';form.append(field(T('سبب التعديل *','Reason for change *'),reason));return reason;}
function reference(root,vehicle,state){
 const box=N('div',undefined,'vw-panel');box.dataset.currentReference='true';box.append(N('strong',T('المرجع الحالي قبل التعديل','Current reference before this change')));
 box.append(N('p',T('السيارة: ','Vehicle: ')+[vehicle.plate,vehicle.description].filter(Boolean).join(' — ')));
 box.append(N('p',T('آخر قراءة مسجلة: ','Latest recorded odometer: ')+(recorded(vehicle.odometer)?vehicle.odometer+' '+T('كم','km'):T('غير مسجلة','Not recorded'))+(vehicle.observed_on?' · '+vehicle.observed_on:'')));
 if(state)box.append(N('p',T('الخدمة الحالية: ','Current service: ')+(state.performed_on||T('تاريخ غير مسجل','Date not recorded'))+' · '+(state.status==='done'?T('منفذة','Performed'):state.status==='never'?T('لم تُنفذ','Never performed'):T('تحتاج استكمال','Needs completion'))));
 root.append(box);
}
function setupSave(form,dialog,api,getCommand,onSaved){
 const error=N('p');error.setAttribute('role','alert');error.hidden=true;form.append(error);
 let busy=false;const commands=new Map();
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;error.hidden=true;
  let command;
  try{command=getCommand();if(!validVersion(command.payload.p_version))throw Error('version_required');if(command.payload.p_reason.length<5||command.payload.p_reason.length>1000)throw Error('invalid_reason');const key=JSON.stringify(command);if(!commands.has(key))commands.set(key,commandId());command.payload.p_command_id=commands.get(key);}
  catch(e){error.textContent=message(e);error.hidden=false;return;}
  const controls=[...form.elements].map(el=>[el,el.disabled]);busy=true;dialog.setBusy?.(true);controls.forEach(([el])=>el.disabled=true);
  let saved=false;
  try{const result=await api(command.name,command.payload);if(!result?.ok)throw Error(result?.error||'operation_failed');saved=true;}
  catch(e){error.textContent=message(e);error.hidden=false;error.scrollIntoView?.({block:'nearest'});}
  finally{busy=false;dialog.setBusy?.(false);controls.forEach(([el,disabled])=>el.disabled=disabled);}
  if(saved){dialog.markClean?.();dialog.close();AdvaconUI.toast(T('تم حفظ التعديل','Change saved'));try{await onSaved?.();}catch(e){AdvaconUI.toast(T('تم الحفظ. أعد تحميل صفحة السيارة لعرض آخر البيانات.','Saved. Reload the vehicle page to see the latest information.'));}}
 };
}
function saveButton(form,text){const b=N('button',text||T('حفظ','Save'),'btn');b.type='submit';form.append(b);return b;}
function editService(c,v,d,api,done){
 if(d.can_correct_services!==true)return;
 const current=d.states.find(s=>s.service===c.key),form=N('form');form.dataset.serviceCorrection=c.key;
 reference(form,d.vehicle,current);
 const mode=opts([['historical',T('إضافة سجل تاريخي فقط — لا يغيّر الحالة الحالية','Add historical record only — keep current state')],['current',T('تصحيح الحالة الحالية صراحةً','Explicitly correct the current state')]]);
 mode.required=true;mode.dataset.correctionMode='true';form.append(field(T('نوع التعديل *','Change type *'),mode));
 const note=N('p'),entries=N('div');form.append(note,entries);let get=null;
 const confirm=N('input');confirm.type='checkbox';confirm.dataset.confirmCurrent='true';
 const confirmLabel=field(T('أؤكد أن هذا تصحيح مقصود للحالة الحالية، مع حفظ الحالة السابقة في السجل.','I confirm this intentionally corrects the current state, while retaining the previous state in history.'),confirm);confirmLabel.hidden=true;form.append(confirmLabel);
 mode.onchange=()=>{entries.replaceChildren();confirm.checked=false;confirm.required=mode.value==='current';confirmLabel.hidden=!confirm.required;
  note.textContent=mode.value==='historical'?T('يُضاف هذا التنفيذ إلى التاريخ فقط؛ لا يغيّر آخر خدمة أو العداد الحالي.','This adds history only; it does not change the latest service or current odometer.'):mode.value==='current'?T('ستصبح البيانات المدخلة هي الحالة الحالية لهذه الخدمة. راجع المرجع أعلاه قبل الحفظ.','These details become the current state for this service. Review the reference above before saving.'):'';
  get=mode.value?formEntries(entries,{single:c.key,partial:true,forceDone:mode.value==='historical',initial:mode.value==='current'?current:null}):null;
 };
 const reason=reasonField(form);saveButton(form,T('حفظ تعديل الخدمة','Save service change'));
 const dialog=AdvaconUI.modal({title:T('تعديل خدمة: ','Service change: ')+T(c.ar,c.en),body:form,wide:true});
 setupSave(form,dialog,api,()=>{if(!get||!mode.value)throw Error('invalid_service_details');return{name:'advacon_vehicle_service_correct',payload:{p_vehicle_id:v.id,p_version:d.vehicle.version,p_entries:get(),p_mode:mode.value,p_reason:reason.value.trim()}};},done);
}
function editRule(c,v,d,api,done){
 if(d.can_manage_rules!==true)return;
 const form=N('form');form.dataset.dueRule=c.key;reference(form,d.vehicle,d.states.find(s=>s.service===c.key));
 form.append(N('p',T('هذا التعديل يغيّر قاعدة الاستحقاق فقط. لا يسجل صيانة ولا يغيّر آخر تنفيذ أو قراءة عداد.','This changes only the due rule. It does not record maintenance or change the last service or odometer.')));
 const rule=d.rules.find(r=>r.service===c.key),kms=N('input'),days=N('input');
 for(const input of[kms,days]){input.type='number';input.min=1;input.max=10000000;input.step=1;}
 days.max=36500;
 kms.value=rule?.interval_km??'';days.value=rule?.interval_days??'';kms.dataset.ruleKm='true';days.dataset.ruleDays='true';
 form.append(field(T('فاصل الاستحقاق بالكيلومترات — اختياري','Due interval (km), optional'),kms),field(T('فاصل الاستحقاق بالأيام — اختياري','Due interval (days), optional'),days));
 const reason=reasonField(form);saveButton(form,T('حفظ قاعدة الاستحقاق','Save due rule'));
 const dialog=AdvaconUI.modal({title:T('قاعدة الاستحقاق: ','Due rule: ')+T(c.ar,c.en),body:form,wide:true});
 setupSave(form,dialog,api,()=>({name:'advacon_vehicle_rules_save',payload:{p_vehicle_id:v.id,p_version:d.vehicle.version,p_rules:[{service:c.key,interval_km:kms.value===''?null:Number(kms.value),interval_days:days.value===''?null:Number(days.value)}],p_reason:reason.value.trim()}}),done);
}
function renderOdometerHistory(root,d,api){
 const rows=Array.isArray(d.odometer_history)?d.odometer_history:[];
 if(!rows.length)return;
 const history=N('details',undefined,'vw-panel');
 history.append(N('summary',T('سجل تصحيحات العداد','Odometer correction history')+' ('+rows.length+')'));
 for(const row of rows){
  const box=N('div',undefined,'vw-panel');
  box.append(N('p',T('القراءة السابقة: ','Previous reading: ')+(recorded(row.previous_odometer)?row.previous_odometer:T('غير مسجلة','Not recorded'))+(row.previous_observed_on?' · '+row.previous_observed_on:'')),
   N('p',T('القراءة المصححة: ','Corrected reading: ')+row.odometer+' · '+row.observed_on),
   N('p',T('السبب: ','Reason: ')+row.reason));
  if(row.has_photo){
   let image=null;
   const error=N('p');error.setAttribute('role','status');
   const show=B(T('عرض صورة التصحيح','View correction photo'),async()=>{
    if(image){image.hidden=!image.hidden;show.textContent=image.hidden?T('عرض صورة التصحيح','View correction photo'):T('إخفاء الصورة','Hide photo');return;}
    show.disabled=true;error.textContent='';
    try{const result=await api('advacon_vehicle_odometer_evidence',{p_correction_id:row.id});if(!box.isConnected)return;
     if(!result?.ok||result.vehicle_id!==d.vehicle.id||String(result.id)!==String(row.id)||typeof result.image!=='string'||result.image.length>2000000||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(result.image))throw Error('invalid_evidence');
     image=N('img');image.src=result.image;image.alt=T('صورة تصحيح قراءة العداد','Odometer correction photo');image.style.maxWidth='100%';image.style.maxHeight='320px';box.append(image);show.textContent=T('إخفاء الصورة','Hide photo');
    }catch(e){error.textContent=T('تعذر تحميل الصورة. أعد المحاولة.','Could not load the photo. Retry.');}
    finally{if(show.isConnected)show.disabled=false;}
   });box.append(show,error);
  }
  history.append(box);
 }
 root.append(history);
}
const odometerLoads=new WeakMap();
async function correctOdometer(container,{vehicle,api,onSaved}){
 if(!container?.isConnected)return;const anchor=container.firstChild,stillHere=()=>container.isConnected&&container.firstChild===anchor;const key={};odometerLoads.set(container,key);
 let d;try{d=await api('advacon_vehicle_services',{p_vehicle_id:vehicle.id});if(odometerLoads.get(container)!==key||!stillHere())return;if(!d?.ok||d.can_correct_odometer!==true||!validVersion(d.vehicle?.version))throw Error(d?.can_correct_odometer===false?'permission_denied':'version_required');}
 catch(e){AdvaconUI.toast(message(e));return;}
 const form=N('form');form.dataset.odometerCorrection='true';reference(form,d.vehicle);
 form.append(N('p',T('هذا تصحيح صريح لقراءة العداد فقط. لن يضيف خدمة أو يغيّر عهدة السيارة.','This explicitly corrects only the odometer. It adds no service and changes no custody.')));
 const km=N('input'),date=N('input'),picture=N('input'),photoStatus=N('p'),preview=N('img'),confirmed=N('input');
 km.type='number';km.min=0;km.max=10000000;km.step='any';km.required=true;km.value=d.vehicle.odometer??'';km.dataset.correctedOdometer='true';
 date.type='date';date.required=true;date.max=today();date.value=d.vehicle.observed_on||today();date.dataset.correctedObservedOn='true';
 picture.type='file';picture.required=true;picture.accept=window.AdvaconImages?.accept||'image/jpeg,image/png';picture.dataset.odometerProof='true';
 photoStatus.setAttribute('role','status');preview.alt=T('صورة العداد بعد التصحيح','Odometer correction evidence');preview.hidden=true;preview.style.maxWidth='100%';preview.style.maxHeight='240px';
 let image=null,sequence=0;
 picture.onchange=async()=>{const own=++sequence;image=null;preview.hidden=true;preview.removeAttribute('src');picture.setCustomValidity('');photoStatus.textContent='';const file=picture.files[0];if(!file)return;picture.setCustomValidity(T('انتظر تجهيز الصورة','Wait for the photo to finish loading'));photoStatus.textContent=T('جارٍ تجهيز الصورة…','Preparing photo…');
  try{const value=await photo(file);if(own!==sequence||!form.isConnected)return;if(typeof value!=='string'||value.length>2000000||!/^data:image\/(jpeg|png);base64,/.test(value))throw Error('odometer_photo_required');image=value;picture.setCustomValidity('');preview.src=value;preview.hidden=false;photoStatus.textContent=T('الصورة جاهزة','Photo ready');}
  catch(e){if(own===sequence){picture.setCustomValidity(T('تعذر تجهيز الصورة. اختر صورة أخرى.','Could not prepare the photo. Choose another.'));photoStatus.textContent=picture.validationMessage;}}
 };
 confirmed.type='checkbox';confirmed.required=true;confirmed.dataset.confirmOdometer='true';
 form.append(field(T('القراءة الصحيحة (كم) *','Correct odometer (km) *'),km),field(T('تاريخ القراءة الصحيحة *','Correct observation date *'),date),field(T('صورة واضحة تؤيد القراءة *','Clear evidence photo *'),picture),photoStatus,preview,field(T('أؤكد استبدال القراءة الحالية بالقيمة والتاريخ المدخلين، مع حفظ سبب التصحيح.','I confirm replacing the current reading with this value and date, with the correction reason recorded.'),confirmed));
 const reason=reasonField(form);saveButton(form,T('حفظ تصحيح العداد','Save odometer correction'));
 const dialog=AdvaconUI.modal({title:T('تصحيح قراءة العداد','Correct odometer'),body:form,wide:true});
 setupSave(form,dialog,api,()=>{if(!image)throw Error('odometer_photo_required');return{name:'advacon_vehicle_odometer_correct',payload:{p_vehicle_id:vehicle.id,p_version:d.vehicle.version,p_expected_odometer:recorded(d.vehicle.odometer)?Number(d.vehicle.odometer):null,p_expected_observed_on:d.vehicle.observed_on||null,p_odometer:Number(km.value),p_observed_on:date.value,p_image:image,p_reason:reason.value.trim()}};},()=>stillHere()?onSaved?.():undefined);
}
window.AdvaconVehicleServices={mount,formEntries,photo,correctOdometer,errorMessage:message};
})();
