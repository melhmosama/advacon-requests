(function(){
'use strict';
const ar=()=>document.documentElement.dir==='rtl',tr=(a,b)=>ar()?a:b;
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,action){const b=node('button',text,'btn sec');b.type='button';b.onclick=action;return b;}
function fail(root,e,retry){if(root.isConnected)AdvaconUI.errorState(root,e,retry);}
async function detail(root,id,api,back){
 root.replaceChildren(node('p',tr('جارٍ التحميل…','Loading…')));
 try{const data=await api('advacon_vehicle_history',{p_vehicle_id:id});if(!root.isConnected)return;const v=data.vehicles[0];if(!v)throw Error(tr('السيارة غير موجودة','Vehicle not found'));
 root.replaceChildren(button(tr('رجوع','Back'),back||(()=>mount(root,api))),node('h2',(v.plate||v.code)+' — '+v.description),node('p',tr('مع الموظف حاليًا: ','Current holder: ')+(v.holder||tr('غير مسندة','Unassigned'))));
 root.append(node('h3',tr('سجل السيارة','Vehicle history')));
 if(!data.history.length)root.append(node('p',tr('لا توجد حركات مسجلة لهذه السيارة بعد.','No history recorded for this vehicle yet.')));
 for(const h of data.history){const row=node('article',undefined,'org-asset-record');row.append(node('strong',h.date),node('p',h.description),node('small',h.execution_confirmed?tr('تنفيذ مؤكد','Confirmed execution'):tr('سجل سابق — التنفيذ غير مؤكد','Historical record — execution not confirmed')));if(h.request_id)row.append(node('strong','TSK-'+h.request_id));root.append(row);}
 }catch(e){fail(root,e,()=>detail(root,id,api,back));}
}
async function mount(root,api){
 root.replaceChildren(node('p',tr('جارٍ تحميل السيارات…','Loading vehicles…')));
 try{const data=await api('advacon_vehicle_history');if(!root.isConnected)return;
 root.replaceChildren(node('h1',tr('السيارات','Vehicles')),node('p',tr('ملف واحد لكل سيارة، مرتبط بعهدتها الحالية وسجلها السابق.','One file per vehicle, linked to current custody and history.')));
 const search=node('input');search.type='search';search.placeholder=tr('ابحث باللوحة أو الموظف أو السيارة','Search plate, employee or vehicle');search.className='org-search';root.append(search);const list=node('div');root.append(list);
 function draw(){list.replaceChildren();const q=search.value.trim().toLowerCase();for(const v of data.vehicles.filter(v=>[v.plate,v.code,v.description,v.holder].join(' ').toLowerCase().includes(q))){const row=node('article',undefined,'org-asset-record');row.append(button((v.plate||v.code)+' — '+v.description,()=>detail(root,v.id,api)),node('p',(v.holder||tr('غير مسندة','Unassigned'))+' · '+v.history_count+' '+tr('سجل','records')));list.append(row);}}search.oninput=draw;draw();
 if(data.pending.length){const section=node('details');section.append(node('summary',tr('سجلات تحتاج تأكيد السيارة','Records awaiting vehicle confirmation')+' ('+data.pending.length+')'));root.append(section);
 for(const g of data.pending){const row=node('article',undefined,'org-asset-record');row.append(node('strong',[g.plate,g.person,g.description].filter(Boolean).join(' — ')));section.append(row);
 if(!g.single_vehicle){row.append(node('p',tr('هذه المجموعة تشمل سيارتين؛ يلزم فصل الوقائع قبل ربطها.','This group contains two vehicles. Resolve individual events before linking.')));continue;}
 const select=node('select');select.append(new Option(tr('اختر السيارة المسجلة المطابقة','Select the matching registered vehicle'),''));data.vehicles.forEach(v=>select.append(new Option((v.plate||v.code)+' — '+v.description,v.id)));row.append(select);
 const save=button(tr('تأكيد الربط','Confirm link'),()=>AdvaconUI.busy(save,async()=>{if(!select.value)return;try{await api('advacon_vehicle_history_link',{p_group_id:g.id,p_vehicle_id:select.value});await mount(root,api);}catch(e){AdvaconUI.toast(e.message,'error');}}));save.disabled=true;select.onchange=()=>save.disabled=!select.value;row.append(save);}
 }
 }catch(e){fail(root,e,()=>mount(root,api));}
}
window.AdvaconVehicles={mount,detail};
})();
