(function(){
'use strict';
window.AdvaconReviewedImport=async function({api,people,reload,loadSheetJS,ar}){
 const tr=(a,b)=>ar()?a:b,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const input=document.createElement('input');input.type='file';input.accept='.xlsx';
 input.onchange=async()=>{try{
  if(!input.files[0])return;
  const XLSX=await loadSheetJS(),book=XLSX.read(await input.files[0].arrayBuffer(),{type:'array'}),sheet=book.Sheets.Employees;
  if(!sheet)throw Error(tr('ورقة Employees غير موجودة','Employees sheet is missing'));
  const sheetRows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
  // A row serial is not an employee number. Only use an explicitly named column.
  const numberHeaders=new Set(['employeeno','employeenumber','رقمالموظف','الرقمالوظيفي']),numberColumns=new Set();
  sheetRows.slice(0,3).forEach(row=>row.forEach((value,index)=>{if(numberHeaders.has(String(value??'').toLowerCase().replace(/[\s_.:#-]/g,'')))numberColumns.add(index);}));
  const numberColumn=numberColumns.size===1?[...numberColumns][0]:-1;
  const rows=sheetRows.slice(3).map((r,i)=>({row:i+4,employee_no:numberColumn<0?null:String(r[numberColumn]??'').trim()||null,position:String(r[1]||''),name_en:String(r[2]||''),name_ar:String(r[3]||''),project:String(r[5]||''),nationality:String(r[6]||''),iqama:String(r[7]||'').trim(),grade:String(r[8]||''),phone:String(r[10]||''),vehicle:String(r[11]||'').trim(),plate:String(r[12]||'').trim(),card:String(r[13]||'').trim(),balance:r[14]})).filter(r=>r.name_ar||r.name_en);
  let fleet={vehicles:[],cards:[]},fleetAllowed=true;try{fleet=await api('advacon_fleet_list');}catch{fleetAllowed=false;}
  const counts=key=>{const map=new Map();for(const row of rows)if(row[key])map.set(row[key],(map.get(row[key])||0)+1);return map;};
  const identities=counts('iqama'),numbers=counts('employee_no'),plates=counts('plate'),cards=counts('card'),existingIqamas=new Set(people.map(x=>String(x.iqama||''))),existingNumbers=new Set(people.map(x=>String(x.employee_no||''))),existingPlates=new Set((fleet.vehicles||[]).map(x=>x.plate)),existingCards=new Set((fleet.cards||[]).map(x=>x.card_number));
  for(const r of rows){
   r.identityConflict=!!r.iqama&&(!/^\d{10}$/.test(r.iqama)||identities.get(r.iqama)>1||existingIqamas.has(r.iqama))||!!r.employee_no&&(numbers.get(r.employee_no)>1||existingNumbers.has(r.employee_no));
   r.assetConflict=!fleetAllowed||(r.plate&&(plates.get(r.plate)>1||existingPlates.has(r.plate)))||(r.card&&(cards.get(r.card)>1||existingCards.has(r.card)));
   r.key=crypto.randomUUID();
  }
  const body=document.createElement('form');body.innerHTML=`<p>${tr('اختر الموظفين بعد مراجعتهم، واختر المشروع والعهد لكل صف بصورة مستقلة. لا دمج تلقائي مع سجلات موجودة. تاريخ بدء العلاقة أدناه هو تاريخ تؤكده أنت، وليس تاريخًا مستنتجًا من الملف.','Review employees, then choose project and assets separately per row. Existing records are never merged automatically. You confirm the relationship start time below; it is not inferred from the workbook.')}</p><div class="org-form"><label>${tr('وقت سريان العلاقات المؤكد (بتوقيت الجهاز)','Confirmed relationship effective time (device timezone)')}<input name="effective" type="datetime-local"></label><label>${tr('وقت قياس أرصدة البطاقات إن عُرف؛ اتركه فارغًا إن لم يُعرف','Card balance observation time, if known; otherwise leave empty')}<input name="observed" type="datetime-local"></label></div><p>${tr('عمود Fuel Allowance سيُسجّل كرصيد بطاقة مبلغ عنه. أسماء المدراء لا تُستنتج من المسميات الوظيفية.','Fuel Allowance is treated as a reported card balance. Manager names are not inferred from job titles.')}</p><div class="tbl-wrap"><table class="tbl"><thead><tr>${[tr('استيراد','Import'),tr('الموظف','Employee'),tr('ربط المشروع','Assign project'),tr('العهد والرصيد','Assets & balance'),tr('المراجعة','Review')].map(x=>'<th>'+x+'</th>').join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr data-row="${i}"><td><input type="checkbox" name="employee" aria-label="${esc(tr('استيراد ','Import ')+(r.name_ar||r.name_en))}" ${r.identityConflict?'disabled':''}> ${r.row}</td><td>${esc(r.name_ar||r.name_en)}<small>${esc(r.iqama||tr('بلا هوية','No identity'))}</small>${r.employee_no?'<small>'+esc(tr('الرقم الوظيفي: ','Employee number: ')+r.employee_no)+'</small>':''}</td><td><label><input type="checkbox" name="project" ${!r.project?'disabled':''}>${esc(r.project||'—')}</label></td><td><label><input type="checkbox" name="assets" ${r.assetConflict||(!r.vehicle&&!r.card)?'disabled':''}>${esc([r.vehicle,r.plate,r.card].filter(Boolean).join(' · ')||'—')}</label><small>${r.balance!==''&&r.balance!==undefined?esc(r.balance)+' SAR':''}</small></td><td class="import-state">${r.identityConflict?tr('إقامة أو رقم وظيفي متعارض؛ صحح الملف أو راجع الدليل.','Iqama or employee number conflict; correct file or review directory.'):r.assetConflict?tr('العهد تحتاج مراجعة منفصلة بسبب تعارض أو صلاحية.','Assets need separate conflict or permission review.'):tr('راجع ثم اختر','Review before selecting')}${r.balance!==''&&r.balance!==undefined&&!r.card?' · '+tr('الرصيد بلا رقم بطاقة ولن يُستورد.','Balance has no card number and will not be imported.'):''}</td></tr>`).join('')}</tbody></table></div>`;
  const footer=document.createElement('div'),save=document.createElement('button');save.type='button';save.className='btn';save.textContent=tr('استيراد المحدد بعد المراجعة','Import reviewed selections');footer.append(save);
  const dialog=AdvaconUI.modal({title:tr('استيراد الموظفين والعلاقات','Import employees & relationships'),body,footer,wide:true});
  save.onclick=async()=>{if(save.disabled)return;const selected=[...body.querySelectorAll('tbody tr')].filter(el=>el.querySelector('[name="employee"]').checked);if(!selected.length)return;
   const controls=[...body.elements].map(el=>[el,el.disabled]),successful=new Set();
   save.disabled=true;dialog.setBusy(true);let completed=0;try{
    const effective=body.elements.effective.value,observed=body.elements.observed.value;
    const prepared=selected.map(el=>{const r=rows[Number(el.dataset.row)],project=el.querySelector('[name="project"]').checked,assets=el.querySelector('[name="assets"]').checked;
     if((project||(assets&&(r.vehicle||r.card)))&&!effective)throw Error(tr('أدخل وقت سريان العلاقات المؤكد.','Enter the confirmed relationship effective time.'));
     const payload={employee:{employee_no:r.employee_no,name_ar:r.name_ar||r.name_en,name_en:r.name_en,iqama:r.iqama,phone:r.phone,nationality:r.nationality,position:r.position,grade:r.grade}};
     if(effective)payload.effective_at=new Date(effective).toISOString();
     if(project)payload.project_ref=r.project;
     if(assets&&r.vehicle)payload.vehicle={code:'CAR-'+r.key.slice(0,8).toUpperCase(),description:r.vehicle,plate:r.plate};
     if(assets&&r.card){payload.card={card_number:r.card};if(r.balance!==''&&r.balance!==undefined){if(!Number.isFinite(Number(r.balance))||Number(r.balance)<0)throw Error(tr('رصيد غير صالح في صف ','Invalid balance on row ')+r.row);payload.balance=Number(r.balance);if(observed)payload.observed_at=new Date(observed).toISOString();}}
     // Freeze the row once sent: a lost response can be retried safely with the same payload.
     if(r.sent&&JSON.stringify(r.sent)!==JSON.stringify(payload))throw Error(tr('أعد محاولة الصف دون تغيير خياراته أولًا؛ قد تكون المحاولة السابقة حُفظت.','Retry this row with unchanged options first; the previous attempt may have saved.'));
     return {el,r,payload};
    });
    controls.forEach(([el])=>el.disabled=true);
    for(const {el,r,payload} of prepared){
     r.sent=payload;await api('advacon_import_person',{p_command_id:r.key,p_payload:payload});
     el.querySelectorAll('input').forEach(i=>{i.checked=false;i.disabled=true;successful.add(i);});el.querySelector('.import-state').textContent=tr('تم الاستيراد','Imported');completed++;
    }
    await reload();AdvaconUI.toast(tr('تم استيراد ','Imported ')+completed+tr(' سجل. راجع النتائج قبل إغلاق المعاينة.',' records. Review results before closing the preview.'));
   }catch(e){AdvaconUI.toast(e.message);}finally{controls.forEach(([el,disabled])=>el.disabled=successful.has(el)||disabled);save.disabled=false;dialog.setBusy(false);}
  };
 }catch(e){AdvaconUI.toast(e.message);}};input.click();
};
})();
