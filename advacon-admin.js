/* Admin presentation only. Existing task mutations and permission checks remain authoritative. */
(function(){
'use strict';
const tx=(ar,en)=>L==='ar'?ar:en, e=v=>AdvaconUI.escape(String(v??''));
let search='',detail=null,queue=null;
window.adminHome=function(){
 const rows=state.requests.map(calc),incoming=rows.filter(isIncoming),pending=rows.filter(r=>r.pendingConfirm&&!isArchived(r)),overdue=rows.filter(r=>isOpen(r)&&r.effStatus==='Overdue'),working=rows.filter(isOpen);
 const metric=(title,n,key,kind='')=>`<button class="ad-metric ${kind}" onclick="adminQueue('${key}')"><span>${title}</span><strong>${n}</strong><small>${tx('عرض الطلبات ←','View requests →')}</small></button>`;
 return `<header class="ad-welcome"><div><span class="eyebrow">ADVACON / ${tx('الإدارة','ADMINISTRATION')}</span><h1>${tx('متابعة العمل تبدأ من هنا','Your work, at a glance')}</h1><p>${tx('الطلبات التي تحتاج قرارك، ومتابعة سير العمل.','Review requests that need a decision and follow work in progress.')}</p></div><button class="btn" onclick="openAddTask()">＋ ${tx('إضافة طلب','Add request')}</button></header>
 <div class="ad-metrics">${metric(tx('طلبات جديدة','New requests'),incoming.length,'incoming')}${metric(tx('بانتظار تأكيدك','Awaiting confirmation'),pending.length,'pending')}${metric(tx('مهام متأخرة','Overdue tasks'),overdue.length,'overdue','ad-warn')}${metric(tx('مهام مفتوحة','Open tasks'),working.length,'open')}</div>
 <div class="ad-home-grid"><section class="ad-surface"><div class="ad-section-head"><div><h2>${tx('أولوية المتابعة','Follow up first')}</h2><p>${tx('بانتظار التأكيد، ثم المتأخرة، ثم الجديدة','Awaiting confirmation, then overdue, then new')}</p></div><button class="btn sec" onclick="go('manage')">${tx('كل الطلبات','Manage requests')}</button></div><div id="ad-followup">${homeRows([...new Map([...pending,...overdue,...incoming].map(r=>[r.id,r])).values()].slice(0,8))}</div></section>
 <aside class="ad-surface"><h2>${tx('مساحات العمل','Workspaces')}</h2><p class="ad-muted">${tx('انتقل مباشرة إلى القسم المطلوب','Go directly to your workspace')}</p><div class="ad-links"><a href="/warehouse?from=admin">${tx('المستودعات','Warehouses')} <span>←</span></a><a href="/housing?from=admin">${tx('الإسكان','Housing')} <span>←</span></a><button onclick="go('techtasks')">${tx('متابعة الفريق','Team workload')} <span>←</span></button><button onclick="go('reports')">${tx('التقارير والإحصاءات','Reports & statistics')} <span>←</span></button></div></aside></div><div id="ad-decisions"></div>`;
};
function homeRows(rows){return rows.length?rows.map(r=>`<button class="ad-request" onclick="adminDetail(${Number(r.id)})"><span class="ad-request-id">${e(fmtID(r.id))}</span><span class="ad-request-title"><b>${e(r.title)}</b><small>${e(r.project||'—')} · ${e(r.assignedTo||tx('غير مسند','Unassigned'))}</small></span><span>${r.pendingConfirm?e(tx('بانتظار التأكيد','Awaiting confirmation')):stBadge(r.effStatus)}</span><span aria-hidden="true">←</span></button>`).join(''):`<div class="empty">${tx('لا توجد طلبات تحتاج متابعة عاجلة في البيانات الحالية.','No requests need urgent follow-up in the current data.')}</div>`;}
window.adminQueue=function(key){
 if(state.role!=='admin')return;
 const rows=state.requests.map(calc).filter(r=>key==='incoming'?isIncoming(r):key==='pending'?r.pendingConfirm&&!isArchived(r):key==='overdue'?isOpen(r)&&r.effStatus==='Overdue':isOpen(r));
 const body=document.createElement('div');body.className='ad-queue';body.innerHTML=homeRows(rows);queue=AdvaconUI.modal({title:tx('الطلبات المطابقة','Matching requests'),body,footer:false});
};
window.adminDetail=function(id){
 const r=state.requests.map(calc).find(x=>x.id===id);if(!r||state.role!=='admin')return;
 if(queue){queue.close();queue=null;}
 if(detail)detail.close();
 const body=document.createElement('div');body.className='ad-detail';
 const tabs=document.createElement('div');tabs.className='ad-tabs';tabs.setAttribute('role','tablist');
 const panel=document.createElement('div');panel.className='ad-detail-content';panel.setAttribute('role','tabpanel');
 const actionbar=document.createElement('div');actionbar.className='ad-detail-actions';
 const add=(label,fn)=>{const b=document.createElement('button');b.className='btn sec';b.textContent=label;b.onclick=()=>{detail.close();detail=null;fn();};actionbar.append(b);};
 if(isIncoming(r)){add(tx('قبول الطلب','Accept request'),()=>acceptReq(id));add(tx('رفض الطلب','Decline request'),()=>askReject(id));}
 else if(r.pendingConfirm&&!isArchived(r)){add(tx('تأكيد الإنجاز','Confirm completion'),()=>confirmStaffDone(id));add(tx('إرجاع للفني','Return to technician'),()=>returnStaffTask(id));add(tx('تعديل إثبات الإنجاز','Edit completion evidence'),()=>openCloseoutEdit(id));}
 else if(isOpen(r)){add(tx('تعديل وإسناد','Edit & assign'),()=>openEdit(id));add(tx('إغلاق المهمة','Close task'),()=>askClose(id));}
 const field=(label,v)=>`<div><dt>${e(label)}</dt><dd>${e(v||'—')}</dd></div>`;
 const sections=[
 [tx('التفاصيل','Details'),()=>`<dl class="ad-detail-fields">${field(tx('العنوان','Title'),r.title)}${field(tx('المشروع','Project'),r.project)}${field(tx('الفني','Technician'),r.assignedTo)}${field(tx('مقدم الطلب','Requested by'),r.requestedBy)}${field(tx('الهاتف','Phone'),r.phone)}${field(tx('الأولوية','Priority'),dispPri(r.priority))}${field(tx('موعد الاستحقاق','Due date'),r.due)}${field(tx('ملاحظات','Notes'),r.notes)}</dl>`],
 [tx('الصور والملفات','Images & files'),()=>{const a=weAtt(r);const imgs=(list)=>list.map(url=>{const safe=AdvaconExperience.safeURL(url);return safe?`<a href="${e(safe)}" target="_blank" rel="noopener"><img src="${e(safe)}" alt="${e(tx('مرفق الطلب','Request attachment'))}" loading="lazy"></a>`:'';}).join('');const docs=(list)=>list.map(f=>{const safe=AdvaconExperience.safeURL(f.url);return safe?`<a class="btn sec" href="${e(safe)}" target="_blank" rel="noopener">${e(f.name||tx('مستند','Document'))}</a>`:'';}).join('');return `<h3>${tx('مرفقات البلاغ','Request attachments')}</h3><div class="ad-images">${imgs(a.ci)}</div>${docs(a.cd)}<h3>${tx('إثبات الإنجاز','Completion evidence')}</h3><div class="ad-images">${imgs(a.pi)}</div>${docs(a.pd)}<p>${e(r.closeoutNote||'')}</p>${!a.ci.length&&!a.pi.length&&!a.cd.length&&!a.pd.length?`<p class="empty">${tx('لا توجد مرفقات','No attachments')}</p>`:''}`;}],
 [tx('المواد','Materials'),()=>{const badge=state.mrBadges?.[String(id)];if(!badge)return `<p>${tx('لا يوجد طلب مواد متاح في البيانات الحالية.','No material request is available in the current data.')}</p>`;const status={pending:tx('بانتظار التجهيز','Pending preparation'),allocated:tx('مجهّز للاستلام','Ready for collection'),issued:tx('مصروف','Issued'),rejected:tx('مرفوض','Rejected'),cancelled:tx('ملغى','Cancelled')};return `<dl class="ad-detail-fields">${field(tx('حالة المواد','Material status'),status[badge.status]||badge.status)}${field(tx('عدد الأصناف','Line count'),String(badge.lines_count??'—'))}</dl><div class="btnrow">${mrProcBtn(id)}</div>`;}],
 [tx('سجل الحركة','Timeline'),()=>`<ol class="ad-timeline">${[[tx('استقبال الطلب','Received'),r.receivedAt||r.received],[tx('بدء العمل','Started'),r.startedAt],[tx('أُرسل للتأكيد','Submitted for confirmation'),r.pendingConfirmAt],[tx('اكتمال / إغلاق','Completed / closed'),r.confirmedAt||r.closed],[tx('رفض / إلغاء','Declined / cancelled'),r.rejectedAt]].filter(x=>x[1]).map(x=>`<li><b>${e(x[0])}</b><span>${e(wpDate(x[1]))}</span></li>`).join('')}</ol>`]
 ];
 sections.forEach(([label,content],i)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.setAttribute('role','tab');b.onclick=()=>{[...tabs.children].forEach(x=>x.setAttribute('aria-selected',String(x===b)));panel.innerHTML=content();AdvaconUI.enhance(panel);};tabs.append(b);if(!i)b.click();});
 tabs.addEventListener('keydown',ev=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();const buttons=[...tabs.children],i=buttons.indexOf(document.activeElement),next=ev.key==='Home'?0:ev.key==='End'?buttons.length-1:(i+(ev.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click();});
 panel.addEventListener('click',event=>{if(event.target.closest('button[onclick]')&&detail){detail.close();detail=null;}},true);
 body.append(tabs,panel,actionbar);detail=AdvaconUI.modal({title:fmtID(id)+' · '+r.title,body,footer:false});detail.modal.classList.add('ad-detail-modal');
};
function decorate(){
 const admin=state.role==='admin';document.body.classList.toggle('ad-admin',admin);if(!admin)return;
 const rename=(key,label)=>{const button=document.querySelector(`.side-nav [onclick="go('${key}')"]`);if(button?.children[1])button.children[1].textContent=label;};rename('dashboard',tx('الرئيسية','Home'));rename('reports',tx('التقارير والإحصاءات','Reports & statistics'));
 const statuses={'Overdue':'متأخرة','Not Started':'لم تبدأ','In Progress':'قيد التنفيذ','Complete':'مكتملة','Cancelled':'ملغاة','On Hold':'معلّقة','Needs Review':'بحاجة مراجعة','Needs Update':'بحاجة تحديث'};
 if(L==='ar')document.querySelectorAll('#view .st').forEach(b=>{if(statuses[b.textContent])b.textContent=statuses[b.textContent];});
 const nav=document.querySelector('.side-nav');if(nav){const groups=[['dashboard',tx('مساحة العمل','WORKSPACE')],['techtasks',tx('الفريق والأصول','TEAM & ASSETS')],['reports',tx('السجلات والإعدادات','RECORDS & SETTINGS')]];groups.forEach(([key,label])=>{const b=nav.querySelector(`[onclick="go('${key}')"]`);if(b&&!b.previousElementSibling?.classList.contains('ad-nav-label')){const title=document.createElement('div');title.className='ad-nav-label';title.textContent=label;b.before(title);}});nav.querySelectorAll('button').forEach(b=>{if(b.classList.contains('active'))b.setAttribute('aria-current','page');});}
 if(state.route==='dashboard'){const target=document.getElementById('ad-decisions');if(target)renderDecisionSummary(target);}
 if(state.route==='manage'){
 const board=document.querySelector('.manage-cols');if(board){
 board.querySelectorAll('.mcard').forEach(card=>{const idText=card.querySelector('.mc-id')?.textContent||'',id=Number(idText.replace(/\D/g,''));if(!state.requests.some(r=>r.id===id))return;const title=card.querySelector('.mc-title');if(title){const b=document.createElement('button');b.className='ad-title-button';b.textContent=title.textContent;b.onclick=()=>adminDetail(id);title.replaceChildren(b);}});
 const bar=document.createElement('div');bar.className='ad-search';const input=document.createElement('input');input.type='search';input.placeholder=tx('ابحث برقم الطلب أو العنوان أو الفني…','Search request ID, title or technician…');input.setAttribute('aria-label',input.placeholder);input.value=search;const count=document.createElement('span');count.setAttribute('role','status');const filter=()=>{search=input.value;board.classList.toggle('ad-searching',!!search.trim());let n=0;board.querySelectorAll('.mcard').forEach(card=>{const yes=card.textContent.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());card.hidden=!yes;if(yes)n++;});count.textContent=n+' '+tx('طلب مطابق','matching requests');};input.oninput=filter;bar.append(input,count);board.previousElementSibling?.classList.contains('au-stage-tabs')?board.previousElementSibling.before(bar):board.before(bar);filter();
 }
 }
}
document.addEventListener('DOMContentLoaded',()=>{const original=window.render;window.render=function(...args){const result=original.apply(this,args);decorate();return result;};decorate();});
})();

