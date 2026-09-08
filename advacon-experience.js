/* View preferences only: never store credentials, form drafts or permission decisions. */
(function(){
 'use strict';
 const views=new Map(),pages=new Map();
 function readHistory(){const value=history.state?.advaconView;return value&&typeof value==='object'?value:{};}
 function writeHistory(key,value){try{const entries=Object.entries({...readHistory(),[key]:value}).slice(-20);history.replaceState({...history.state,advaconView:Object.fromEntries(entries)},'');}catch{/* Private/restricted browsing: in-memory navigation still works. */}}
 function page(key,value){key=key.split('?')[0];if(value!==undefined){pages.set(key,Math.max(0,Number(value)||0));writeHistory('page:'+key,pages.get(key));}return pages.get(key)||Number(readHistory()['page:'+key])||0;}
 function rememberFilters(root,key){
  key=key.split('?')[0];
  const selector='.filters input:not([type=password]),.filters select,.au-toolbar input[type=search]';
  const fields=[...root.querySelectorAll(selector)].filter(x=>x.id);
  const saved=views.get(key)||readHistory()['filters:'+key];
  if(saved)fields.forEach(x=>{if(Object.hasOwn(saved,x.id))x.value=saved[x.id];});
  const shareable=fields.filter(x=>x.matches('select,input[type=date]'));
  const incoming=new URLSearchParams(location.hash.split('?')[1]||'');shareable.forEach(x=>{if(incoming.has(x.id))x.value=incoming.get(x.id);});
  const save=()=>{views.set(key,Object.fromEntries(fields.map(x=>[x.id,x.value])));writeHistory('filters:'+key,Object.fromEntries(shareable.map(x=>[x.id,x.value])));if(root.isConnected&&shareable.length){const params=new URLSearchParams(location.hash.split('?')[1]||'');shareable.forEach(x=>{if(x.value)params.set(x.id,x.value);else params.delete(x.id);});const hash=location.hash.split('?')[0];history.replaceState(history.state,'',location.pathname+location.search+hash+(params.size?'?'+params:'') );}};
  fields.forEach(x=>{x.addEventListener('input',save);x.addEventListener('change',save);});
  root.addEventListener('click',()=>queueMicrotask(save));
 }
 function dataStatus(root,time,error,retry){
  root.querySelector(':scope > .au-data-status')?.remove();
  const panel=document.createElement('div');panel.className='au-data-status'+(error?' error':'');
  panel.setAttribute('role','status');
  const label=document.createElement('span');
  label.textContent=(time?AdvaconUI.updatedAt(time):'')+(error?' — '+AdvaconUI.text('تعذر التحديث؛ قد تكون البيانات المعروضة قديمة. ','Refresh failed; displayed data may be out of date. ')+AdvaconUI.humanError(error):'');
  panel.append(label);
  if(error&&retry){const button=document.createElement('button');button.className='btn';button.textContent=AdvaconUI.text('إعادة المحاولة','Try again');button.onclick=()=>AdvaconUI.busy(button,retry);panel.append(button);}
  root.prepend(panel);
 }
 function safeURL(value){try{const url=new URL(String(value),location.href);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}}
 function jsArg(value){return AdvaconUI.escape(JSON.stringify(String(value??'')).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/'/g,'\\u0027'));}
 function jsSingle(value){return AdvaconUI.escape(String(value??'').replace(/\\/g,'\\\\').replace(/'/g,'\\u0027').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'));}
 function requestReceipt(result,open){
  const id=result?.request_id??result?.id;
  const panel=document.createElement('aside');panel.className='au-request-receipt';panel.setAttribute('role','status');
  const text=document.createElement('span');text.textContent=AdvaconUI.text('أُرسل للموافقة؛ لم يُنفذ بعد','Submitted for approval; not executed')+(id!=null?' #'+String(id):'');
  const link=document.createElement('button');link.className='btn';link.textContent=AdvaconUI.text('متابعة الطلب','Track request');link.onclick=()=>{open(id);panel.remove();};
  const close=document.createElement('button');close.className='btn';close.textContent='×';close.setAttribute('aria-label',AdvaconUI.text('إغلاق','Close'));close.onclick=()=>panel.remove();
  panel.append(text,link,close);document.querySelector('.au-request-receipt')?.remove();document.body.append(panel);
 }
 let boardStage=0;
 function groupForm(form,groups){
  for(const [title,names] of groups){const section=document.createElement('fieldset');section.className='au-form-section';const legend=document.createElement('legend');legend.textContent=title;section.append(legend);for(const name of names){const control=[...form.querySelectorAll('[data-field]')].find(x=>x.dataset.field===name);const field=control?.closest('.field');if(field)section.append(field);}if(section.children.length>1)form.append(section);}
 }
 function enhancePresentation(root){
  root.querySelectorAll('table').forEach(table=>{const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());table.querySelectorAll('tbody tr').forEach(row=>[...row.cells].forEach((cell,i)=>{if(cell.colSpan===1&&headers[i])cell.dataset.label=headers[i];}));});
  const board=root.querySelector('.manage-cols');
  if(board&&!board.previousElementSibling?.classList.contains('au-stage-tabs')){
   const bar=document.createElement('div');bar.className='au-stage-tabs';bar.setAttribute('role','group');bar.setAttribute('aria-label',AdvaconUI.text('مرحلة العمل','Work stage'));
   const columns=[...board.querySelectorAll(':scope > .mcol')];
   columns.forEach((column,i)=>{const button=document.createElement('button');button.type='button';button.textContent=column.querySelector('.mcol-head')?.textContent.trim()||String(i+1);button.onclick=()=>{boardStage=i;columns.forEach((x,j)=>x.dataset.mobileActive=String(i===j));[...bar.children].forEach((x,j)=>x.setAttribute('aria-pressed',String(i===j)));};bar.append(button);column.dataset.mobileActive=String(i===boardStage);button.setAttribute('aria-pressed',String(i===boardStage));});board.before(bar);
  }
  const icons={'📦':'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10','🏠':'M3 11l9-8 9 8M5 10v11h14V10M9 21v-7h6v7','📊':'M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7','⚙️':'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2'};
  const shapes={home:icons['🏠'],box:icons['📦'],chart:icons['📊'],settings:icons['⚙️'],file:'M6 3h8l4 4v14H6V3zm8 0v5h4M9 12h6M9 16h6',people:'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a4 4 0 0 1 4 4v3',check:'M4 3h16v18H4V3M8 12l3 3 5-6',move:'M3 7h17l-4-4M21 17H4l4 4',grid:'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l4 2'};
  const routes={dashboard:'home',properties:'home',landlords:'people',contracts:'file',meters:'clock',bills:'file',residents:'people',expenses:'file',reports:'chart',approvals:'check',permissions:'check',activity:'clock','attachment-health':'check',settings:'settings',inventory:'box',catalog:'grid',movements:'move',materialreq:'check',shelves:'box',batches:'clock',manage:'grid',archive:'file',techtasks:'check',staffdir:'people',assets:'box',media:'grid',all:'file'};
  root.querySelectorAll('.nav-icon,.nav-ic,.nav-item .ic,.nav-item .icon,.side-nav .ic,.icon-badge,.asset-card .icon').forEach(el=>{const owner=el.closest('a,button');const key=owner?.dataset.tab||owner?.getAttribute('href')?.replace(/^#/,'').split('?')[0]||owner?.getAttribute('onclick')?.match(/go\('([^']+)'\)/)?.[1];const shape=shapes[routes[key]]||icons[el.textContent.trim()];if(!shape)return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',shape);svg.append(path);el.replaceChildren(svg);});
 }
 window.AdvaconExperience={rememberFilters,dataStatus,safeURL,jsArg,jsSingle,page,requestReceipt,enhancePresentation,groupForm};
 document.addEventListener('DOMContentLoaded',()=>{
  if(typeof state!=='undefined'&&typeof weF!=='undefined'){
   const saved=readHistory().adminLists;
   if(saved){for(const key of ['from','to','cat','stat','src','kind'])if(typeof saved.filters?.[key]==='string')weF[key]=saved.filters[key].slice(0,200);if(Number.isInteger(saved.evidencePage)&&saved.evidencePage>0)wePg=saved.evidencePage;}
   const original=window.render;
   if(typeof original==='function')window.render=function(...args){const result=original.apply(this,args);if(state.role==='admin')writeHistory('adminLists',{filters:Object.fromEntries(['from','to','cat','stat','src','kind'].map(k=>[k,weF[k]])),evidencePage:wePg});return result;};
  }
  if(typeof warehouseMovementRpc==='function'&&typeof invFilters!=='undefined'){
   const saved=readHistory().warehouse;
   if(saved){
    for(const key of ['warehouse','category'])if(typeof saved.inventory?.[key]==='string')invFilters[key]=saved.inventory[key].slice(0,200);
    for(const key of ['low','out','noshelf'])if(typeof saved.inventory?.[key]==='boolean')invFilters[key]=saved.inventory[key];
    for(const key of ['type','warehouse','item_id','date_from','date_to'])if(typeof saved.movements?.[key]==='string')mvFilters[key]=saved.movements[key].slice(0,200);
    if(Number.isInteger(saved.movementPage)&&saved.movementPage>=0)mvPage=saved.movementPage;
    if(['all','active','inactive'].includes(saved.catalogStatus))catStatusFilter=saved.catalogStatus;
   }
   const saveWarehouse=()=>writeHistory('warehouse',{inventory:Object.fromEntries(['warehouse','category','low','out','noshelf'].map(k=>[k,invFilters[k]])),movements:Object.fromEntries(['type','warehouse','item_id','date_from','date_to'].map(k=>[k,mvFilters[k]])),movementPage:mvPage,catalogStatus:catStatusFilter});
   for(const name of ['invSet','invToggle','catSetStatus','mvSetType','mvSetWh','mvSetDateFrom','mvSetDateTo','mvPrev','mvNext','mvPickItem','mvClearItem']){const original=window[name];if(typeof original!=='function')continue;window[name]=function(...args){const result=original.apply(this,args);saveWarehouse();return result;};}
  }
  document.addEventListener('click',event=>{const image=event.target.closest('[data-preview-url]');if(!image)return;event.stopPropagation();const url=safeURL(image.dataset.previewUrl);if(url&&typeof openLightbox==='function')openLightbox(url);});
 });
})();
