/* Shared presentation utilities. Authorization remains in the module RPCs and Backend. */
(function(global){
 'use strict';
 const pending=new Map();let serial=0,legacyTitle='',legacyDirty=false,legacyDismissAllowed=false;
 const ar=()=>document.documentElement.lang==='ar';
 const text=(a,e)=>ar()?a:e;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function singleFlight(key,task){
  if(pending.has(key))return pending.get(key);
  const work=Promise.resolve().then(task);pending.set(key,work);
  work.then(()=>{if(pending.get(key)===work)pending.delete(key);},()=>{if(pending.get(key)===work)pending.delete(key);});
  return work;
 }
 function humanError(error){
  const raw=String(error?.message??error??'');
  if(raw.startsWith('APPROVAL_PENDING: '))return raw.slice(18);
  if(/network|failed to fetch|fetch failed|load failed|فشل الاتصال/i.test(raw))return text('تعذّر الاتصال. إذا كنت تحفظ عملية، حدّث حالتها قبل إعادة الإرسال لتجنب التكرار.','Connection failed. If you were saving an operation, refresh its status before resubmitting to avoid duplicates.');
  if(/session|not_authenticated|http_401/i.test(raw))return text('انتهت الجلسة. سجّل الدخول مجددًا للمتابعة.','Your session expired. Sign in again to continue.');
  if(/permission_denied|not_authorized|not_admin|role_required|access denied|http_403/i.test(raw))return text('لا تسمح صلاحيات حسابك بهذه العملية.','Your account does not have permission for this action.');
  if(/approval_required/i.test(raw))return text('تحتاج هذه العملية موافقة الإدارة. أعد فتحها لإرسال طلب.','This action needs approval. Reopen it to submit a request.');
  if(/not_pending|already_/i.test(raw))return text('تغيرت حالة السجل. حدّث القائمة قبل المتابعة.','This record has changed. Refresh the list before continuing.');
  if(/duplicate|unique_violation/i.test(raw))return text('يوجد سجل بهذه البيانات. راجع الاسم أو الرمز.','A record with these details already exists. Check the name or code.');
  if(/has_dependents/i.test(raw))return text('للسجل بيانات مرتبطة. راجع أثر الحذف قبل المتابعة.','This record has linked data. Review the deletion impact before continuing.');
  if(/^[a-z][a-z0-9_.:-]+$/i.test(raw)||/PGRST|SQLSTATE|column .* does not exist/i.test(raw))return text('تعذّر إكمال العملية. حدّث الحالة قبل إعادة المحاولة، وشارك تفاصيل الخطأ مع المسؤول عند تكراره.','The operation could not be completed. Refresh its status before retrying; contact your administrator if it persists.');
  return raw||text('تعذّر إكمال العملية.','The operation could not be completed.');
 }
 function toast(message,kind='info'){
  if(String(message).startsWith('APPROVAL_PENDING: '))kind='info';
  let mount=document.getElementById('advacon-notices');
  if(!mount){mount=document.createElement('div');mount.id='advacon-notices';mount.className='au-notices';document.body.appendChild(mount);}
  const notice=document.createElement('div');notice.className='au-notice '+kind;
  notice.setAttribute('role',kind==='error'?'alert':'status');
  const body=document.createElement('span');body.textContent=humanError(message);
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label',text('إغلاق التنبيه','Dismiss notification'));close.onclick=()=>notice.remove();
  notice.append(body,close);mount.appendChild(notice);
  if(kind!=='error')setTimeout(()=>notice.remove(),kind==='success'?5000:8000);
  while(mount.children.length>4)mount.firstElementChild.remove();
 }
 const dialogs=[];
 function modal({title='',body,footer,wide=false,narrow=false,onClose,trackChanges=true}={}){
  const opener=document.activeElement,backdrop=document.createElement('div'),box=document.createElement('section');
  backdrop.className='au-modal-backdrop';box.className='au-modal'+(wide?' wide':'')+(narrow?' narrow':'');
  box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.tabIndex=-1;
  const headingId='au-dialog-'+(++serial);box.setAttribute('aria-labelledby',headingId);
  const head=document.createElement('header'),heading=document.createElement('h2'),x=document.createElement('button');
  head.className='au-modal-head';heading.id=headingId;heading.textContent=title;x.type='button';x.textContent='×';x.setAttribute('aria-label',text('إغلاق','Close'));
  head.append(heading,x);
  const bodyEl=document.createElement('div'),footerEl=document.createElement('footer');bodyEl.className='au-modal-body';footerEl.className='au-modal-foot';
  if(typeof body==='string')bodyEl.innerHTML=body;else if(body)bodyEl.appendChild(body);
  if(typeof footer==='string')footerEl.innerHTML=footer;else if(footer)footerEl.appendChild(footer);
  box.append(head,bodyEl);if(footer!==false&&footer!==null)box.appendChild(footerEl);backdrop.appendChild(box);
  let closed=false,dirty=false,asking=false,locked=false;
  const inertState=[...document.body.children].filter(el=>el!==document.getElementById('advacon-notices')).map(el=>[el,el.inert]);
  inertState.forEach(([el])=>el.inert=true);document.body.appendChild(backdrop);dialogs.push(box);
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const close=()=>{if(closed)return;closed=true;dialogs.splice(dialogs.indexOf(box),1);backdrop.remove();document.removeEventListener('keydown',key,true);inertState.forEach(([el,value])=>{if(el.isConnected)el.inert=value;});document.body.style.overflow=previousOverflow;if(opener?.isConnected)opener.focus();onClose?.();};
  async function dismiss(){
   if(asking||locked)return;
   if(trackChanges&&dirty){asking=true;const leave=await confirm({title:text('تغييرات غير محفوظة','Unsaved changes'),message:text('هل تريد إغلاق النموذج وترك التغييرات؟','Close the form and discard your changes?'),danger:true,confirmLabel:text('ترك التغييرات','Discard changes')});asking=false;if(!leave)return;}
   close();
  }
  function key(e){if(dialogs.at(-1)!==box)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dismiss();return;}if(e.key!=='Tab')return;
   const controls=[...box.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(el=>!el.disabled&&!el.hidden&&el.tabIndex>=0&&el.getClientRects().length);
   const first=controls[0],last=controls.at(-1);if(!first){e.preventDefault();box.focus();}else if(e.shiftKey&&(document.activeElement===first||document.activeElement===box)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
  bodyEl.addEventListener('input',()=>dirty=true);bodyEl.addEventListener('change',()=>dirty=true);
  x.onclick=dismiss;backdrop.onclick=e=>{if(e.target===backdrop)dismiss();};document.addEventListener('keydown',key,true);
  enhance(bodyEl);requestAnimationFrame(()=>{if(!closed)(bodyEl.querySelector('[autofocus],input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled])')||x).focus();});
  const api={close,dismiss,modal:box,backdrop,body:bodyEl,bodyEl,footerEl,markClean:()=>dirty=false,setBusy:value=>{locked=!!value;x.disabled=locked;box.setAttribute('aria-busy',String(locked));}};
  box.advaconDialog=api;return api;
 }
 function confirm({title='',message='',danger=false,confirmLabel,cancelLabel}={}){
  return new Promise(resolve=>{
   let settled=false;const settle=value=>{if(!settled){settled=true;resolve(value);}};
   const body=document.createElement('p');body.textContent=message;
   const footer=document.createElement('div');footer.className='au-actions';
   const cancel=document.createElement('button'),ok=document.createElement('button');cancel.type=ok.type='button';cancel.className='btn';ok.className='btn '+(danger?'btn-danger':'btn-primary');
   cancel.textContent=cancelLabel||text('إلغاء','Cancel');ok.textContent=confirmLabel||text('تأكيد','Confirm');footer.append(cancel,ok);
   const m=modal({title,body,footer,narrow:true,trackChanges:false,onClose:()=>settle(false)});
   cancel.onclick=()=>{settle(false);m.close();};ok.onclick=()=>{settle(true);m.close();};
  });
 }
 async function busy(button,task){if(button.disabled)return;const old=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent=text('جارٍ المعالجة…','Working…');try{return await task();}finally{button.disabled=false;button.removeAttribute('aria-busy');button.textContent=old;}}
 function permissionMatrix(root,{items,onSave}){
  root.replaceChildren();root.classList.add('au-permissions');
  if(!items.length){root.textContent=text('لا توجد صلاحيات معرفة لهذا القسم. تواصل مع مسؤول النظام.','No permissions are configured for this module. Contact your administrator.');return;}
  for(const item of items){
   let confirmed=item.effective_mode||'deny';const row=document.createElement('fieldset'),legend=document.createElement('legend'),options=document.createElement('div'),status=document.createElement('span');
   row.className='au-permission-row';legend.textContent=(ar()?item.label_ar:item.label_en)||item.action_key;options.className='au-permission-options';status.className='au-save-status';status.setAttribute('role','status');
   const group='au-perm-'+(++serial);const modes=[['deny',text('ممنوع','Deny')],['direct',text('مباشر','Direct')],...(item.supports_approval?[['approval',text('بموافقة','Approval')]]:[])];
   for(const [value,labelText] of modes){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='radio';input.name=group;input.value=value;input.checked=confirmed===value;span.textContent=labelText;label.append(input,span);options.appendChild(label);
    input.onchange=async()=>{if(!input.checked)return;const controls=[...options.querySelectorAll('input')];controls.forEach(c=>c.disabled=true);status.textContent=text('جارٍ الحفظ…','Saving…');row.setAttribute('aria-busy','true');
     try{await onSave(item.action_key,value);confirmed=value;status.textContent=text('تم الحفظ','Saved');status.className='au-save-status success';}
     catch(error){controls.forEach(c=>c.checked=c.value===confirmed);status.textContent=text('لم يُحفظ التغيير؛ أُعيدت الحالة السابقة.','Not saved; previous state restored.');status.className='au-save-status error';toast(error,'error');}
     finally{controls.forEach(c=>c.disabled=false);row.removeAttribute('aria-busy');}
    };
   }
   row.append(legend,options,status);root.appendChild(row);
  }
 }
 function errorState(root,error,retry){root.replaceChildren();const panel=document.createElement('div');panel.className='au-state error';panel.setAttribute('role','alert');const p=document.createElement('p');p.textContent=humanError(error);panel.append(p);if(retry){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text('إعادة المحاولة','Try again');b.onclick=()=>busy(b,retry);panel.append(b);}root.append(panel);}
 function enhance(root=document){
  root.querySelectorAll('.field').forEach(field=>{const label=field.querySelector('label'),input=field.querySelector('input,select,textarea');if(label&&input&&!label.htmlFor){if(!input.id)input.id='au-field-'+(++serial);label.htmlFor=input.id;}});
  root.querySelectorAll('button').forEach(b=>{if(!b.getAttribute('type'))b.type='button';if(!b.getAttribute('aria-label')&&b.title)b.setAttribute('aria-label',b.title);if(b.textContent.trim()==='×'&&!b.getAttribute('aria-label'))b.setAttribute('aria-label',text('إغلاق','Close'));if(b.textContent.trim()==='↺')b.setAttribute('aria-label',text('مسح الفلاتر','Clear filters'));});
  root.querySelectorAll('a.nav-item').forEach(el=>{if(el.classList.contains('active')||el.classList.contains('on'))el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  root.querySelectorAll('div[onclick],span[onclick],tr[onclick]').forEach(el=>{if(!el.hasAttribute('role'))el.setAttribute('role','button');if(!el.hasAttribute('tabindex'))el.tabIndex=0;});
  root.querySelectorAll('table').forEach(table=>{const wrap=table.parentElement;if(wrap&&wrap.scrollWidth>wrap.clientWidth){wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',text('جدول قابل للتمرير أفقيًا','Horizontally scrollable table'));}});
  root.querySelectorAll('.loading,.empty').forEach(el=>{if(!el.hasAttribute('role'))el.setAttribute('role','status');});
  const legacy=document.querySelector('.mv-modal');
  if(legacy){const title=legacy.querySelector('h2,h3'),key=title?.textContent||'';if(key!==legacyTitle){legacyTitle=key;legacyDirty=false;}legacy.setAttribute('role','dialog');legacy.setAttribute('aria-modal','true');legacy.tabIndex=-1;if(title){if(!title.id)title.id='au-legacy-'+(++serial);legacy.setAttribute('aria-labelledby',title.id);}}
  else{legacyTitle='';legacyDirty=false;}
 }
 function captureFocus(){const el=document.activeElement;if(!el?.matches('input,textarea,select'))return null;return {el,id:el.id,handler:el.getAttribute('oninput')||el.getAttribute('onchange'),start:el.selectionStart,end:el.selectionEnd};}
 function restoreFocus(saved){if(!saved||saved.el.isConnected)return;const el=saved.id?document.getElementById(saved.id):[...document.querySelectorAll('input,textarea,select')].find(x=>saved.handler&&(x.getAttribute('oninput')===saved.handler||x.getAttribute('onchange')===saved.handler));if(el&&!el.disabled){el.focus({preventScroll:true});if(saved.start!=null)try{el.setSelectionRange(saved.start,saved.end);}catch(_){}}}
 function requestLabel(mode,direct){return mode==='approval'?text('إرسال للموافقة','Submit for approval'):direct;}
 function updatedAt(time){return text('آخر تحديث: ','Updated: ')+new Date(time).toLocaleTimeString(ar()?'ar-SA':'en-GB',{hour:'2-digit',minute:'2-digit'});}
 global.AdvaconUI={escape,text,singleFlight,humanError,toast,modal,confirm,busy,permissionMatrix,errorState,enhance,requestLabel,updatedAt,captureFocus,restoreFocus,currentDialog:()=>dialogs.at(-1)?.advaconDialog};
 document.addEventListener('DOMContentLoaded',()=>{
  enhance();
  const skip=document.createElement('a');skip.className='au-skip';skip.href=document.getElementById('content')?'#content':'#view';skip.textContent=text('انتقل إلى المحتوى','Skip to content');document.body.prepend(skip);
  document.addEventListener('click',e=>{if(e.target===skip){const target=document.querySelector(skip.hash);if(target){target.tabIndex=-1;target.focus();}}});
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button][onclick]:not(button)')){e.preventDefault();e.target.click();}});
  document.addEventListener('input',e=>{if(e.target.closest('.mv-modal'))legacyDirty=true;});
  document.addEventListener('change',e=>{if(e.target.closest('.mv-modal'))legacyDirty=true;});
  document.addEventListener('click',async e=>{
   const b=e.target.closest('.mv-modal-x,.mv-modal .rc-cancel');
   if(!b||!legacyDirty||legacyDismissAllowed)return;
   e.preventDefault();e.stopImmediatePropagation();
   if(await confirm({title:text('تغييرات غير محفوظة','Unsaved changes'),message:text('هل تريد ترك مدخلات الحركة وإغلاقها؟','Discard the movement entries and close?'),danger:true})){legacyDirty=false;legacyDismissAllowed=true;b.click();legacyDismissAllowed=false;}
  },true);
  document.addEventListener('keydown',e=>{
   if(dialogs.length)return;const m=document.querySelector('.mv-modal');if(!m)return;
   if(e.key==='Escape'){e.preventDefault();m.querySelector('.mv-modal-x')?.click();return;}
   if(e.key==='Tab'){const controls=[...m.querySelectorAll('button,input,select,textarea,[tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.getClientRects().length),first=controls[0],last=controls.at(-1);if(!m.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first)?.focus();}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
 });
})(window);
