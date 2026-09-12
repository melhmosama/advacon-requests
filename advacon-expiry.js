(function(){
'use strict';
const tr=(a,b)=>LANG==='ar'?a:b, raw=warehouseRpc;
if(typeof T!=='undefined'){T.ar.repNoExpiry='كميات تحتاج ترتيب الصلاحية';T.en.repNoExpiry='Stock awaiting expiry setup';}
let data=null,loading=false,error='',filter='all',query='',busy=false;
const errors={expiry_setup_required:['يلزم ترتيب الكميات الحالية حسب الصلاحية من قسم الدفعات والصلاحية أولًا.','Arrange existing stock in Batches & Expiry first.'],expiry_date_required:['تاريخ الصلاحية مطلوب لهذا الصنف.','An expiry date is required.'],expired_stock_cannot_issue:['لا يمكن صرف كمية منتهية الصلاحية للاستخدام.','Expired stock cannot be issued.'],expiry_stock_changed_refresh:['تغيّر الرصيد؛ حدّث الصفحة ثم أعد الترتيب.','Stock changed. Refresh and try again.'],expiry_quantity_mismatch:['مجموع الكميات يجب أن يساوي الرصيد المطلوب ترتيبه.','Quantities must match the stock being arranged.'],expiry_policy_has_history:['لا يمكن إلغاء متابعة الصلاحية بعد تسجيل دفعات مؤرخة.','Expiry tracking cannot be removed after dated batches exist.'],expiry_stock_mismatch:['الرصيد يحتاج مطابقة قبل تقسيمه.','Stock must be reconciled before arranging it.']};
function friendly(e){let s=String(e.message||e);for(const [k,v] of Object.entries(errors))if(s.includes(k))return tr(...v);return s;}
async function read(){data=await raw('advacon_expiry_workspace',{});return data;}
function itemFor(args){return(data||[]).find(i=>i.id===args.p_item_id||i.locations.some(l=>l.id===(args.p_source_iw_id||args.p_item_warehouse_id)));}
function dialog(title,body,submit){return new Promise(resolve=>{let done=false,working=false;const footer=document.createElement('div'),cancel=document.createElement('button'),ok=document.createElement('button'),err=document.createElement('p');cancel.className='btn';ok.className='btn-primary';cancel.textContent=tr('إلغاء','Cancel');ok.textContent=tr('تأكيد','Confirm');err.setAttribute('role','alert');footer.append(cancel,ok);body.append(err);const modal=AdvaconUI.modal({title,body,footer,onClose:()=>{if(!done)resolve(null)}});cancel.onclick=()=>{if(!working)modal.close()};ok.onclick=async()=>{if(working)return;working=true;ok.disabled=cancel.disabled=true;try{const v=await submit(body);done=true;resolve(v);modal.close()}catch(e){err.textContent=friendly(e)}finally{working=false;ok.disabled=cancel.disabled=false}};});}
async function datePrompt(){const body=document.createElement('div');body.innerHTML=`<label>${tr('تاريخ صلاحية الكمية المستلمة','Expiry date of the received quantity')}<input class="rc-in" type="date" required></label>`;return dialog(tr('صلاحية الكمية','Stock expiry'),body,b=>{const el=b.querySelector('input');if(!el.reportValidity())throw Error(tr('اختر تاريخ الصلاحية','Choose the expiry date'));return el.value;});}
async function allocate(item,args,kind){
 const loc=item.locations.find(l=>l.id===(args.p_source_iw_id||args.p_item_warehouse_id));
 let rows=(loc?.batches||[]).filter(b=>b.active&&(Number(b.qty)>0||['adjustment','return'].includes(kind)));
 const today=new Date().toLocaleDateString('en-CA');
 if(kind==='issue'&&item.tracks_expiry)rows=rows.filter(b=>b.expiry&&b.expiry>=today);
 if(!rows.length)throw Error(tr('لا توجد كمية متاحة لهذه العملية.','No stock is available for this operation.'));
 if(!item.tracks_expiry&&rows.length===1)return[{qty:Number(args.p_qty),batch_no:rows[0].default?null:rows[0].batch_no}];
 const body=document.createElement('div');body.innerHTML=`<p>${tr('راجع التوزيع ليطابق الكمية التي تتعامل معها فعليًا. الأقرب انتهاءً مقترح أولًا.','Confirm the allocation matches the actual stock. Earliest expiry is suggested first.')}</p>`;
 let remaining=Number(args.p_qty);
 rows.forEach(b=>{const qty=Math.min(remaining,Math.max(0,Number(b.qty)));remaining-=qty;const label=document.createElement('label');label.textContent=(b.expiry||tr('بلا صلاحية','No expiry'))+' · '+tr('الرصيد: ','Stock: ')+b.qty;const input=document.createElement('input');input.type='number';input.min='0';input.step='any';input.className='rc-in';input.value=qty;label.append(input);body.append(label)});
 return dialog(tr('توزيع الكمية','Quantity allocation'),body,b=>{const values=[...b.querySelectorAll('input')].map((e,i)=>({qty:Number(e.value),batch_no:rows[i].default?null:rows[i].batch_no}));if(values.some(x=>!Number.isFinite(x.qty)||x.qty<0)||Math.abs(values.reduce((s,x)=>s+x.qty,0)-Number(args.p_qty))>1e-8)throw Error('expiry_quantity_mismatch');return values.filter(x=>x.qty>0)});
}
warehouseRpc=async function(fn,args={}){
 const move=/^(?:admin_(issue|receive_stock|return|transfer_stock|adjustment|disposal)|request_(issue|receipt|return|transfer|adjustment|disposal)_approval)$/.exec(fn);
 const master=['create_item_master','admin_update_item_master'].includes(fn),approval=/^approve_(issue|receipt|transfer|return|adjustment|disposal)_movement$/.exec(fn);
 if(!move&&!master&&!approval)return raw(fn,args);
 if(busy)throw Error(tr('انتظر اكتمال العملية الحالية.','Wait for the current operation.'));
 busy=true;
 try{
 let tracks=null,allocations=null;await read();
 if(approval){
 const r=(aprList||[]).find(r=>r.id===args.p_approval_id);if(!r)throw Error(tr('حدّث قائمة الموافقات.','Refresh approvals.'));
 const item=itemFor({p_item_id:r.orig_item_id,p_item_warehouse_id:r.orig_item_warehouse_id});
 if(item?.pending)throw Error('expiry_setup_required');
 if(item?.tracks_expiry){
 if(approval[1]==='receipt'){const date=r.orig_expiry_date||await datePrompt();if(!date)throw Error(tr('أُلغيت العملية.','Operation cancelled.'));args={...args,p_final_expiry_date:date,p_final_batch_no:null};}
 else{const selected=await allocate(item,{p_item_warehouse_id:r.orig_item_warehouse_id,p_qty:args.p_final_qty||r.orig_qty},approval[1]);if(!selected||selected.length!==1)throw Error(tr('هذه الموافقة تخص كمية بتاريخ واحد. عدّل كميتها أو قدّم طلبات منفصلة للتواريخ الأخرى.','This approval covers one expiry date. Adjust its quantity or submit separate requests for other dates.'));args={...args,p_expiry_batch:selected[0].batch_no};}
 }
 else if(item&&approval[1]!=='receipt'){
 const loc=item.locations.find(l=>l.id===r.orig_item_warehouse_id),requested=r.orig_batch_no||null;
 if(!loc?.batches.some(b=>b.active&&(b.default?null:b.batch_no)===requested)){
 const selected=await allocate(item,{p_item_warehouse_id:r.orig_item_warehouse_id,p_qty:args.p_final_qty||r.orig_qty},approval[1]);if(!selected||selected.length!==1)throw Error(tr('راجع كمية الموافقة لتطابق المخزون المختار.','Review the approval quantity against selected stock.'));args={...args,p_expiry_batch:selected[0].batch_no};
 }
 }
 }
 else if(master){tracks=fn==='create_item_master'?catNew.tracks_expiry:catDetailDraft.tracks_expiry;if(typeof tracks!=='boolean')throw Error(tr('اختر هل الصنف له صلاحية أم لا.','Choose whether the item has expiry.'));}
 else{
 const item=itemFor(args);if(!item)throw Error(tr('تعذر العثور على الصنف؛ حدّث القائمة.','Item not found. Refresh the list.'));
 if(item.pending)throw Error('expiry_setup_required');
 let kind=move[1]||move[2];kind=kind.replace('_stock','');if(kind==='receive')kind='receipt';
 if(kind==='receipt'){
 args={...args,p_batch_no:null,p_expiry_date:null};
 if(item.tracks_expiry){const date=await datePrompt();if(!date)throw Error(tr('أُلغيت العملية.','Operation cancelled.'));args.p_expiry_date=date;}
 }else if(kind==='return'&&args.p_ref_issue_movement_id){
 const h=await raw('advacon_expiry_history',{p_item:item.id,p_issue:args.p_ref_issue_movement_id});
 if(item.tracks_expiry&&!h.movements?.[0]?.expiry_date){const date=await datePrompt();if(!date)throw Error(tr('أُلغيت العملية.','Operation cancelled.'));args={...args,p_expiry_date:date};}
 }
 else if(kind==='return'&&item.tracks_expiry){const date=await datePrompt();if(!date)throw Error(tr('أُلغيت العملية.','Operation cancelled.'));args={...args,p_expiry_date:date};}
 else{allocations=await allocate(item,args,kind);if(!allocations)throw Error(tr('أُلغيت العملية.','Operation cancelled.'));if(kind==='return'){if(allocations.length!==1)throw Error(tr('أرجع كل تاريخ صلاحية بعملية مستقلة.','Return each expiry date separately.'));args={...args,p_batch_no:allocations[0].batch_no};allocations=null;}}
 }
 const result=await raw('advacon_expiry_execute',{p_function:fn,p_args:args,p_allocations:allocations,p_tracks:tracks});data=null;return result;
 }catch(e){throw Error(friendly(e));}finally{busy=false;}
};
function policy(value,handler){return `<label>${tr('هل للصنف صلاحية؟','Does this item have expiry?')} *<select class="rc-in" onchange="${handler}(this.value)"><option value="">${tr('اختر','Choose')}</option><option value="no" ${value===false?'selected':''}>${tr('لا','No')}</option><option value="yes" ${value===true?'selected':''}>${tr('نعم','Yes')}</option></select></label>`;}
window.expiryNewPolicy=v=>{catNew.tracks_expiry=v===''?null:v==='yes'};
window.expiryEditPolicy=v=>{catDetailDraft.tracks_expiry=v===''?null:v==='yes'};
const newPanel=catNewPanel;catNewPanel=function(){return newPanel().replace('<div class="imd-form">','<div class="imd-form">'+policy(catNew.tracks_expiry,'expiryNewPolicy'));};
const detail=catDetailDrawer;catDetailDrawer=function(){let html=detail();if(catDetailEdit)html=html.replace('<div class="imd-form">','<div class="imd-form">'+policy(catDetailDraft.tracks_expiry,'expiryEditPolicy'));return html;};
const startEdit=catStartEdit;catStartEdit=async function(){try{await read();startEdit();const item=(data||[]).find(i=>i.id===catDetailId);catDetailDraft.tracks_expiry=item?.tracks_expiry;catRender()}catch(e){toast(friendly(e),'error')}};
// Remove legacy manual batch/date fields from every movement renderer. The shared workflow asks only what is needed.
function clean(html){return html.replace(/<label[^>]*>[^<]*<\/label><input[^>]*(?:oninput|onchange)="[^"]*(?:'batch_no'|'expiry'|'expiry_date')[^"]*"[^>]*\/?\s*>/g,'').replace(/<label class="apr-l">[^<]*<input[^>]*oninput="[^"]*(?:'batch_no'|'expiry'|'expiry_date')[^"]*"[^>]*\/?\s*><\/label>/g,'');}
for(const key of ['mvIssueModal','mvReturnModal','mvTransferModal','aprReqModal','mvReceiptModal','whmReceiveModal','aprEditPanel']){if(typeof window[key]==='function'){const old=window[key];window[key]=function(...a){return clean(old(...a)).replace(/<label class="apr-l">[^<]*(?:دفعة|batch)[^<]*<input[^>]*readonly[^>]*><\/label>/gi,'')}}}
window.expiryHistory=async id=>{try{const h=await raw('advacon_expiry_history',{p_item:id,p_issue:null}),body=document.createElement('div');body.className='expiry-table';body.innerHTML=`<p>${tr('آخر 500 حركة، مع سجل ترتيب الرصيد.','Latest 500 movements, with stock setup history.')}</p><table><tbody>${h.movements.map(m=>`<tr><td>${esc(m.created_at)}</td><td>${esc(m.movement_type)}</td><td>${m.qty}</td><td>${esc(m.expiry_date||'—')}</td><td>${esc(m.warehouse||'')}</td></tr>`).join('')}</tbody></table><h3>${tr('سجل الترتيب','Setup history')}</h3>${h.setup.map(s=>`<p>${esc(s.at)}: ${Array.isArray(s.distribution)?s.distribution.map(r=>`${Number(r.qty)} · ${esc(r.expiry)}`).join(' / '):tr('تعديل إعداد الصلاحية','Expiry policy updated')}</p>`).join('')}`;await dialog(tr('الحركات المرتبطة','Related movements'),body,()=>true)}catch(e){toast(friendly(e),'error')}};
if(typeof aprLoad==='function'){const old=aprLoad;aprLoad=async function(...a){try{await read()}catch(e){toast(friendly(e),'error')}return old(...a)}}
if(typeof aprSummaryOrig==='function'){const old=aprSummaryOrig;aprSummaryOrig=function(r){const item=itemFor({p_item_id:r.orig_item_id,p_item_warehouse_id:r.orig_item_warehouse_id});const date=r.orig_expiry_date||item?.locations.flatMap(l=>l.batches).find(b=>b.batch_no===r.orig_batch_no)?.expiry;return (r.orig_batch_no?old(r).split(esc(r.orig_batch_no)).join(esc(date||'—')):old(r))+(item?.tracks_expiry?`<div>${tr('الصلاحية','Expiry')}: ${esc(date||tr('يلزم تحديد التاريخ','Date needs review'))}${item.pending?' · '+tr('موقوف حتى ترتيب الرصيد','Blocked until stock is arranged'):''}</div>`:'')}}
window.expiryRefresh=async()=>{if(loading)return;loading=true;error='';batRender();try{await read()}catch(e){error=friendly(e)}finally{loading=false;batRender()}};
window.expiryFilter=v=>{filter=v;batRender()};
window.expirySearch=v=>{query=v;batRender();const el=document.getElementById('expiry-search');el?.focus();el?.setSelectionRange(v.length,v.length)};
window.expiryArrange=async(iid,lid)=>{
 try{await read();const item=data.find(i=>i.id===iid),loc=item.locations.find(l=>l.id===lid),unknown=loc.batches.filter(b=>!b.expiry).reduce((s,b)=>s+Number(b.qty),0);
 const body=document.createElement('div');body.innerHTML=`<p>${esc(item.name_ar||item.name_en)} — ${esc(loc.warehouse)}<br>${tr('الكمية المطلوب ترتيبها','Quantity to arrange')}: <strong>${unknown}</strong></p><div class="expiry-lines"></div><button class="btn" type="button">${tr('إضافة تاريخ آخر','Add another date')}</button>`;
 const lines=body.querySelector('.expiry-lines'),addButton=body.querySelector('button');const add=()=>{const row=document.createElement('div');row.className='expiry-line';row.innerHTML=`<label>${tr('الكمية','Quantity')}<input class="rc-in" type="number" min="0.000001" step="any" required></label><label>${tr('تاريخ الصلاحية','Expiry date')}<input class="rc-in" type="date" required></label><button type="button" class="btn" aria-label="${tr('حذف السطر','Remove row')}">×</button>`;row.querySelector('button').onclick=()=>row.remove();lines.append(row)};add();lines.querySelector('input').value=unknown;addButton.onclick=add;
 const before=loc.batches.map(b=>({id:b.id,qty:b.qty,expiry:b.expiry})).sort((a,b)=>a.id.localeCompare(b.id));
 const result=await dialog(tr('ترتيب الكميات والصلاحية','Arrange stock expiry'),body,async()=>{const rows=[...lines.children].map(r=>{const inputs=r.querySelectorAll('input');if(![...inputs].every(e=>e.reportValidity()))throw Error(tr('أكمل الكمية والتاريخ','Complete quantity and date'));return {qty:Number(inputs[0].value),expiry:inputs[1].value}});return raw('advacon_expiry_arrange',{p_iw:lid,p_before:before,p_rows:rows})});
 if(result){await expiryRefresh();toast(result.pending?tr('حُفظ الترتيب؛ أكمل بقية مواقع الصنف.','Saved. Complete the remaining locations.'):tr('اكتمل الترتيب وفُتحت حركات الصنف.','Setup complete. Item movements are unlocked.'),'success');}
 }catch(e){toast(friendly(e),'error')}
};
viewBatches=function(){
 if(!data&&!loading&&!error)setTimeout(expiryRefresh,0);
 const today=new Date(),soon=new Date();soon.setDate(today.getDate()+60);const iso=d=>d.toLocaleDateString('en-CA');
 const rows=[];for(const item of data||[]){if(!item.tracks_expiry)continue;for(const loc of item.locations){if(batWhFilter&&loc.warehouse_id!==batWhFilter)continue;for(const b of loc.batches){if(Number(b.qty)<=0)continue;const status=!b.expiry?'pending':b.expiry<iso(today)?'expired':b.expiry<=iso(soon)?'soon':'ok';if(filter!=='all'&&!(filter==='pending'?item.pending:status===filter))continue;if(query&&!`${item.code} ${item.name_ar} ${item.name_en} ${loc.warehouse}`.toLowerCase().includes(query.toLowerCase()))continue;rows.push(`<tr><td><button class="btn" onclick="expiryHistory('${item.id}')">${esc(item.code)}</button><br>${esc(LANG==='ar'?item.name_ar:item.name_en||item.name_ar)}</td><td>${esc(loc.warehouse)}</td><td>${Number(b.qty)}</td><td>${esc(b.expiry||tr('يلزم الترتيب','Setup required'))}</td><td>${item.pending?tr('موقوف حتى اكتمال الترتيب','Blocked until setup is complete'):(status==='expired'?tr('منتهية','Expired'):status==='soon'?tr('قريبة الانتهاء','Expiring soon'):tr('مرتب','Organized'))}</td><td>${!b.expiry&&Number(b.qty)>0&&catIsAdmin()?`<button class="btn-primary" onclick="expiryArrange('${item.id}','${loc.id}')">${tr('ترتيب الكميات','Arrange stock')}</button>`:''}</td></tr>`);}}}
 return `<div class="phead"><h1>${tr('الدفعات والصلاحية','Batches & Expiry')}</h1><p>${tr('نفس كميات المستودعات، مرتبة حسب تواريخ الصلاحية.','Warehouse quantities organized by expiry date.')}</p></div><div class="expiry-controls"><input id="expiry-search" class="rc-in" placeholder="${tr('ابحث بالصنف أو المستودع','Search item or warehouse')}" value="${esc(query)}" oninput="expirySearch(this.value)"><select class="rc-in" onchange="expiryFilter(this.value)">${[['all','الكل','All'],['pending','تحتاج ترتيبًا','Setup required'],['expired','منتهية','Expired'],['soon','خلال 60 يومًا','Within 60 days'],['ok','لاحقًا','Later']].map(([k,a,b])=>`<option value="${k}" ${filter===k?'selected':''}>${tr(a,b)}</option>`).join('')}</select><button class="btn" onclick="expiryRefresh()">${tr('تحديث','Refresh')}</button></div>${error?`<p role="alert">${esc(error)}</p>`:loading?`<p>${tr('جارٍ التحميل…','Loading…')}</p>`:`<div class="expiry-table"><table><thead><tr>${['الصنف|Item','المستودع|Warehouse','الكمية|Quantity','الصلاحية|Expiry','الحالة|Status','الإجراء|Action'].map(s=>`<th>${tr(...s.split('|'))}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="6">${tr('لا توجد كميات مطابقة.','No matching stock.')}</td></tr>`}</tbody></table></div>`}`;
};
const style=document.createElement('style');style.textContent='.expiry-controls,.expiry-line{display:flex;gap:12px;align-items:end;margin:14px 0}.expiry-controls input{flex:1}.expiry-controls select{max-width:220px}.expiry-table{overflow:auto;background:white;border:1px solid #dce5ef;border-radius:12px}.expiry-table table{width:100%;border-collapse:collapse}.expiry-table th,.expiry-table td{padding:14px;text-align:start;border-bottom:1px solid #e8edf4}.expiry-line label{flex:1}@media(max-width:600px){.expiry-controls{flex-wrap:wrap}.expiry-controls input{flex-basis:100%}.expiry-table table{min-width:650px}}';document.head.append(style);
})();
