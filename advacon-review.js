(function(){
'use strict';
const tr=(a,b)=>LANG==='ar'?a:b,raw=warehouseRpc;
const writes={create_item_master:'catalog.create',admin_update_item_master:'catalog.edit',admin_set_item_image:'catalog.edit',admin_create_warehouse:'warehouses.create',admin_set_warehouse_open:'warehouses.edit',admin_set_warehouse_active:'warehouses.edit',admin_add_shelf:'shelves.manage',admin_set_item_warehouse_shelf:'shelves.manage'};
let rows=null,loading=false,reviewError='',owner='',labels=new Map();
const msg=()=>tr('تم إرسال الطلب للموافقة. تابعه من قسم الطلبات والموافقات؛ لم يُنفّذ التغيير بعد.','Approval requested. Track it in Requests & Approvals; the change has not been executed.');
warehouseRpc=async function(fn,args={},...rest){
 const action=writes[fn];
 const viewAction=WH_RPC_ACTION[fn];
 if(CTX.mode==='asset'&&viewAction?.endsWith('.view')&&whPermissionMode(viewAction)==='approval'){
 await raw('advacon_warehouse_review_request',{p_action:viewAction,p_function:'view_access',p_args:{}});rows=null;throw Error(msg());
 }
 if(action&&CTX.mode!=='admin'){
 await loadWarehousePermissions();
 if(whPermissionMode(action)==='approval'){
 const payload={...args};if(fn==='create_item_master')payload._tracks_expiry=catNew.tracks_expiry;if(fn==='admin_update_item_master')payload._tracks_expiry=catDetailDraft.tracks_expiry;
 if(['create_item_master','admin_update_item_master'].includes(fn)&&typeof payload._tracks_expiry!=='boolean')throw Error(tr('اختر إعداد الصلاحية للصنف.','Choose the item expiry policy.'));
 const id=await raw('advacon_warehouse_review_request',{p_action:action,p_function:fn,p_args:payload});rows=null;AdvaconExperience.requestReceipt(id,()=>{location.hash='materialreq'});const pending=new Error(msg());pending.reviewPending=true;throw pending;
 }
 }
 return raw(fn,args,...rest);
};
const direct=whDirect;whDirect=function(key){return Object.values(writes).includes(key)||key==='reports.export'?whCan(key):direct(key)};
const names={'dashboard.view':['لوحة التحكم','Dashboard'],'inventory.view':['المخزون','Inventory'],'catalog.view':['دليل الأصناف','Item catalog'],'warehouses.view':['المستودعات','Warehouses'],'movements.view':['الحركات','Movements'],'batches.view':['الدفعات والصلاحية','Batches & Expiry'],'reports.view':['التقارير','Reports']};
function access(action){return `<div class="au-state"><h2>${tr(...(names[action]||[action,action]))}</h2><p>${tr('هذا القسم يحتاج موافقة وصول. بعد الموافقة يبقى متاحًا لك حتى يسحب المسؤول الصلاحية.','Access requires approval. Once approved, it remains available until revoked.')}</p><button class="btn-primary" onclick="warehouseAskAccess('${action}',this)">${tr('طلب الوصول','Request access')}</button> <button class="btn" onclick="warehouseRefreshAccess()">${tr('تحديث حالة الوصول','Refresh access')}</button></div>`;}
window.warehouseAskAccess=async(action,button)=>{await AdvaconUI.busy(button,async()=>{try{await raw('advacon_warehouse_review_request',{p_action:action,p_function:'view_access',p_args:{}});rows=null;toast(msg(),'info')}catch(e){toast(e.message,'error')}})};
window.warehouseRefreshAccess=async()=>{await loadWarehousePermissions();renderSidebar();route()};
for(const [name,key] of Object.entries({viewWhDashboard:'dashboard.view',viewInventory:'inventory.view',viewItemCatalog:'catalog.view',viewWarehouses:'warehouses.view',viewMovements:'movements.view',viewBatches:'batches.view',viewWhReports:'reports.view'})){
 if(typeof window[name]==='function'){const old=window[name];window[name]=function(...a){return whPermissionMode(key)==='approval'?access(key):old(...a)}}
}
async function referenceLabels(){
 const results=await Promise.allSettled([raw('reference_lists',{}),raw('warehouses_list',{}),raw('inventory_list',{})]);labels=new Map();
 const visit=x=>{if(Array.isArray(x)){x.forEach(visit);return}if(!x||typeof x!=='object')return;const name=(LANG==='ar'?x.name_ar:x.name_en)||x.name_ar||x.name_en||x.shelf_name||x.item_code||x.code;
 if(name)for(const k of ['id','item_id','item_warehouse_id'])if(x[k])labels.set(x[k],name);
 if(x.warehouse_id&&(x.warehouse_name_ar||x.warehouse_name_en||x.warehouse_code))labels.set(x.warehouse_id,(LANG==='ar'?x.warehouse_name_ar:x.warehouse_name_en)||x.warehouse_name_ar||x.warehouse_name_en||x.warehouse_code);
 if(x.shelf_id&&x.shelf_name)labels.set(x.shelf_id,x.shelf_name);Object.values(x).forEach(v=>{if(Array.isArray(v))visit(v)})};
 results.forEach(r=>{if(r.status==='fulfilled')visit(r.value)});
}
window.warehouseReviewsLoad=async()=>{if(loading)return;loading=true;reviewError='';try{rows=await raw('advacon_warehouse_review_list',{});if(CTX.mode==='admin')await referenceLabels()}catch(e){reviewError=e.message;rows=[]}finally{loading=false;aprRender()}};
window.warehouseReviewDecide=async(id,approve,button)=>{await AdvaconUI.busy(button,async()=>{try{await raw('advacon_warehouse_review_decide',{p_id:id,p_approve:approve});await warehouseReviewsLoad();toast(tr('تمت معالجة الطلب.','Request processed.'),'success')}catch(e){toast(e.message,'error')}})};
window.warehouseReviewCancel=async(id,button)=>{await AdvaconUI.busy(button,async()=>{try{await raw('advacon_warehouse_review_cancel',{p_id:id});await warehouseReviewsLoad()}catch(e){toast(e.message,'error')}})};
window.warehouseReviewImage=async(id,button)=>{await AdvaconUI.busy(button,async()=>{try{const value=rows?.find(r=>r.id===id)?.args?.p_image_url;if(!value)return;const url=/^https?:\/\//i.test(value)?value:await getWarehouseImageSignedUrl(value);openLightbox(url)}catch(e){toast(e.message,'error')}})};
const fieldNames={p_item_id:['الصنف','Item'],p_warehouse_id:['المستودع','Warehouse'],p_item_warehouse_id:['مخزون الصنف','Item stock'],p_shelf_id:['الرف','Shelf'],p_code:['الرمز','Code'],p_name_ar:['الاسم العربي','Arabic name'],p_name_en:['الاسم الإنجليزي','English name'],p_name:['الاسم','Name'],p_sort_order:['الترتيب','Order'],p_category_id:['التصنيف','Category'],p_item_type_id:['النوع','Type'],p_base_unit_id:['الوحدة','Unit'],p_notes:['الملاحظات','Notes'],p_note:['الملاحظة','Note'],p_is_open:['مفتوح للعمل','Open'],p_is_active:['نشط','Active'],_tracks_expiry:['له صلاحية','Expiry tracked'],p_image_url:['الصورة','Image']};
function details(r){if(r.function_name==='view_access')return tr('وصول مستمر حتى سحب الصلاحية.','Persistent access until revoked.');return Object.entries(r.args).map(([k,v])=>{if(v==null||v==='')return '';const text=typeof v==='boolean'?tr(v?'نعم':'لا',v?'Yes':'No'):labels.get(String(v))||String(v);return `<div><b>${esc(tr(...(fieldNames[k]||[k,k])))}:</b> ${k==='p_image_url'?tr('الصورة المرفقة بطلب الصنف','Image attached to the item request'):esc(text)}</div>`}).join('')}
function reviews(){const key=CTX.mode+':'+CTX.userId;if(owner!==key){owner=key;rows=null;labels.clear();}if(rows===null&&!loading)queueMicrotask(warehouseReviewsLoad);return `<section class="panel" style="margin:18px 0;padding:16px"><h2>${tr('طلبات الوصول والإجراءات','Access & action requests')}</h2><button class="btn" onclick="warehouseReviewsLoad()">${tr('تحديث','Refresh')}</button>${reviewError?`<p role="alert">${esc(reviewError)}</p>`:loading?`<p>${tr('جارٍ التحميل…','Loading…')}</p>`:(rows||[]).filter(r=>aprFilter==='all'||r.status===aprFilter||(aprFilter==='approved'&&r.status==='consumed')).map(r=>`<article style="padding:16px 0;border-bottom:1px solid #dde5ee"><strong>${esc(LANG==='ar'?r.label_ar:r.label_en)}</strong> · ${esc(tr(...({pending:['بانتظار الموافقة','Pending'],approved:['مقبول','Approved'],rejected:['مرفوض','Rejected'],cancelled:['ملغى','Cancelled'],consumed:['تم الاستخدام','Used']}[r.status]||[r.status,r.status])))}<small style="display:block">${esc(r.created_at)} · ${esc(r.requested_by_email||r.requested_by)}</small>${details(r)}${r.args?.p_image_url?`<button class="btn" onclick="warehouseReviewImage('${r.id}',this)">${tr('عرض الصورة','View image')}</button>`:''}${r.status==='pending'?(CTX.mode==='admin'?`<button class="btn-primary" onclick="warehouseReviewDecide('${r.id}',true,this)">${tr('موافقة وتنفيذ','Approve & execute')}</button> <button class="btn" onclick="warehouseReviewDecide('${r.id}',false,this)">${tr('رفض','Reject')}</button>`:`<button class="btn" onclick="warehouseReviewCancel('${r.id}',this)">${tr('إلغاء الطلب','Cancel request')}</button>`):''}</article>`).join('')||`<p>${tr('لا توجد طلبات.','No requests.')}</p>`}</section>`}
// Keep the established movement approval screen and add the new request types there.
const materialView=viewApprovals;
window.viewApprovals=function(...a){return reviews()+materialView(...a)};
window.warehouseReviewSection=reviews;
const printReport=repPrintReport;let printing=false;
repPrintReport=async function(){if(printing||!repState.data)return;printing=true;try{await loadWarehousePermissions();const mode=whPermissionMode('reports.export');if(mode==='deny')throw Error(tr('لا تملك صلاحية التصدير.','Export is not permitted.'));if(mode==='approval'){const range=repPeriodRange();const args={period:repState.period,from:range?.from||repState.from,to:range?.to||repState.to,whMode:repState.whMode,whId:repState.whId,preset:repState.preset,regOpen:repState.regOpen,regType:repState.regType,regOffset:repState.regOffset};const allowed=await raw('advacon_warehouse_export_consume',{p_args:args});if(!allowed){await raw('advacon_warehouse_review_request',{p_action:'reports.export',p_function:'browser_export',p_args:args});rows=null;toast(msg(),'info');return;}}printReport()}catch(e){toast(e.message,'error')}finally{printing=false}};
// One indicator = one status; counts and results use the same predicate and scope.
const predicates={low:r=>r.is_low_stock===true&&Number(r.available)>0,out:r=>Number(r.available)<=0,noshelf:r=>!r.shelf_id};
const scopeRows=()=>{const f=invFilters,q=(f.q||'').trim().toLowerCase();return invData.filter(r=>(!f.warehouse||r.warehouse_id===f.warehouse)&&(!f.category||r.category_id===f.category)&&(!q||`${r.item_code||''} ${r.name_ar||''} ${r.name_en||''}`.toLowerCase().includes(q)))};
invApply=()=>scopeRows().filter(r=>Object.entries(predicates).every(([k,p])=>!invFilters[k]||p(r)));
invToggle=function(key){if(!predicates[key])return;const enabled=!invFilters[key];for(const k of Object.keys(predicates))invFilters[k]=false;invFilters[key]=enabled;invRender()};
dashGoInv=function(key){invFilters={q:'',warehouse:dashWh||'',category:'',low:false,out:false,noshelf:false};if(predicates[key])invFilters[key]=true;if(currentTab()==='inventory')invRender();else location.hash='inventory'};
const inventoryView=viewInventory;viewInventory=function(...a){let html=inventoryView(...a);if(whPermissionMode('inventory.view')!=='direct')return html;const scope=scopeRows();for(const [k,p] of Object.entries(predicates)){const count=scope.filter(p).length;html=html.replace(new RegExp(`(onclick="invToggle\\('${k}'\\)"[^>]*>)([^<]*)`),`$1$2 (${count})`)}return html};
// The old banner was a fixed div, not an input: remove it explicitly.
const panel=aprEditPanel;aprEditPanel=function(...a){return panel(...a).replace(/<div class="apr-locked">(?:دفعة المصدر:|Source batch:)[\s\S]*?<\/div>/g,'')};
const edit=aprStartEdit;aprStartEdit=async function(id){edit(id);const r=(aprList||[]).find(x=>x.id===id);if(r?.movement_type!=='TRANSFER'||aprEdit.dest_shelf)return;try{const inventory=await raw('inventory_list',{});if(aprEditId!==id||aprEdit.dest_shelf)return;const source=inventory.find(x=>x.item_warehouse_id===r.orig_item_warehouse_id);const dest=inventory.find(x=>x.item_id===source?.item_id&&x.warehouse_id===aprEdit.dest_wh);if(dest?.shelf_id){aprEdit.dest_shelf=dest.shelf_id;await aprLoadShelves(aprEdit.dest_wh);if(aprEditId===id)aprRender()}}catch(e){if(aprEditId===id){aprErr=tr('تعذر تحميل الرف المسجل. أعد فتح الطلب للمحاولة.','Could not load the registered shelf. Reopen the request to retry.');aprRender()}}};
const change=aprEditSet;aprEditSet=async function(key,value){change(key,value);if(key!=='dest_wh'||!value)return;const id=aprEditId,r=(aprList||[]).find(x=>x.id===id);try{const inventory=await raw('inventory_list',{});if(aprEditId!==id||aprEdit.dest_wh!==value||aprEdit.dest_shelf)return;const source=inventory.find(x=>x.item_warehouse_id===r?.orig_item_warehouse_id),dest=inventory.find(x=>x.item_id===source?.item_id&&x.warehouse_id===value);if(dest?.shelf_id){aprEdit.dest_shelf=dest.shelf_id;await aprLoadShelves(value);if(aprEditId===id&&aprEdit.dest_wh===value)aprRender()}}catch(e){toast(e.message,'error')}};
const oldRoute=route;route=async function(...a){if(CTX.mode==='asset')await loadWarehousePermissions();return oldRoute(...a)};
const batchesView=viewBatches;viewBatches=function(...a){const html=batchesView(...a);return CTX.mode==='admin'?html:html.replace(/<button\b[^>]*onclick="expiryArrange\([\s\S]*?<\/button>/g,'')};
})();
