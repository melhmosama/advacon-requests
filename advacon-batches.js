(function(){
'use strict';
const tr=(a,b)=>LANG==='ar'?a:b;
const original=warehouseRpc;
const actions={issue:'issue',transfer:'transfer',return:'return',adjustment:'adjust',disposal:'dispose'};
let choosing=false;
async function choose(rows,requested){
 const match=rows.find(b=>(b.is_default?'':b.batch_no)===(requested||''));
 if(rows.length===1&&match)return match;
 return new Promise(resolve=>{
  let done=false;const body=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select');
  label.textContent=tr('اختر دفعة المخزون الفعلية','Select the actual stock batch');select.className='rc-in';select.setAttribute('aria-label',label.textContent);select.add(new Option(tr('اختر الدفعة','Choose batch'),''));
  rows.forEach((b,i)=>select.add(new Option((b.is_default?tr('الافتراضية (بلا رقم)','Default (no number)'):b.batch_no)+' · '+tr('الكمية: ','Quantity: ')+b.qty+(b.expiry?' · '+b.expiry:''),String(i))));
  if(match)select.value=String(rows.indexOf(match));label.append(select);body.append(label);
  const footer=document.createElement('div'),cancel=document.createElement('button'),ok=document.createElement('button');cancel.className='btn';ok.className='btn-primary';cancel.textContent=tr('إلغاء','Cancel');ok.textContent=tr('استخدام هذه الدفعة','Use this batch');footer.append(cancel,ok);
  const dialog=AdvaconUI.modal({title:tr('دفعة المصدر','Source batch'),body,footer,onClose:()=>{if(!done)resolve(null)}});
  cancel.onclick=()=>dialog.close();ok.onclick=()=>{if(select.value===''){select.required=true;select.reportValidity();return}done=true;resolve(rows[Number(select.value)]);dialog.close()};
 });
}
warehouseRpc=async function(fn,args={}){
 const match=/^(?:request_(issue|transfer|return|adjustment|disposal)_approval|admin_(issue|transfer|return|adjustment|disposal)(?:_stock)?)$/.exec(fn);
 if(!match)return original(fn,args);
 const kind=match[1]||match[2],iw=args.p_source_iw_id||args.p_item_warehouse_id;
 if(!iw||kind==='return'&&args.p_ref_issue_movement_id)return original(fn,args);
 if(choosing)throw Error(tr('أكمل اختيار الدفعة الحالية أولًا.','Finish the current batch selection first.'));
 choosing=true;
 try{
  const rows=await original('advacon_warehouse_batch_options',{p_item_warehouse_id:iw,p_action:'movements.'+actions[kind]});
  if(!Array.isArray(rows)||!rows.length)throw Error(tr('لا توجد دفعة نشطة لهذا الصنف في المستودع المحدد.','No active batch exists for this item in the selected warehouse.'));
  const selected=await choose(rows,args.p_batch_no);
  if(!selected)throw Error(tr('لم تُرسل العملية. يمكنك مراجعة الاختيارات والمحاولة مجددًا.','Nothing was submitted. Review your choices and try again.'));
  return await original(fn,{...args,p_batch_no:selected.is_default?null:selected.batch_no});
 }finally{choosing=false;}
};
})();
