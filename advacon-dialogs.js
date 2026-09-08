/* Adapt existing form renderers to one modal shell while retaining their form fields and handlers. */
(function(){
 'use strict';
 function install(name,selector,closeFunction){
  const original=window[name];if(typeof original!=='function')return;
  let active=null,lastTitle='',bypass=false,revision=0;
  if(closeFunction&&typeof window[closeFunction]==='function'){
   const closeOriginal=window[closeFunction];window[closeFunction]=function(...args){revision++;active?.close();active=null;return closeOriginal.apply(this,args);};
  }
  window[name]=function(...args){
   revision++;
   const ui=window.AdvaconUI,focus=ui.captureFocus(),dirty=active?.isDirty()||false;
   active?.close();active=null;
   const result=original.apply(this,args);
   const node=document.querySelector(selector);if(!node)return result;
   const overlay=node.closest('.modal-bg')||node.previousElementSibling?.matches('.mv-scrim,.imd-scrim')&&node.previousElementSibling;
   const titleNode=node.querySelector('h2,h3'),title=titleNode?.textContent||ui.text('تفاصيل','Details');
   const same=title===lastTitle;lastTitle=title;
   const buttons=[...node.querySelectorAll('button')];
   const cancel=buttons.find(b=>/^(إلغاء|اغلاق|إغلاق|cancel|close)$/i.test(b.textContent.trim()));
   const closeControl=node.querySelector('.mv-modal-x,.modal-close,.imd-x')||cancel;
   const head=node.querySelector('.mv-modal-head,.imd-head');
   if(head)head.remove();else titleNode?.remove();
   let body=node.querySelector(':scope > .mv-modal-body,:scope > .imd-body')||node;
   let footer=node.querySelector(':scope > .mv-modal-foot,:scope > .btnrow:last-child');
   if(footer){footer.classList.add('au-actions');footer.classList.add('au-adopted-footer');}
   if(body===node){node.classList.remove('modal','mv-modal');node.classList.add('au-adopted-content');node.style.maxWidth='none';node.style.width='100%';node.removeAttribute('role');node.removeAttribute('aria-modal');}
   const api=ui.modal({title,body,footer:footer||null,wide:!head,initialDirty:same&&dirty,initialFocus:!focus,
    onDismiss:async()=>{
     if(closeControl?.disabled)return false;
     bypass=true;const before=revision;
     try{
      // The shared shell has already confirmed discarding changes.
      if(name==='renderModal'&&typeof window.clearDirty==='function')window.clearDirty();
      if(name==='catRender')return await window.catClose(true)!==false;
      if(closeControl)closeControl.click();else if(overlay&&typeof overlay.onclick==='function')overlay.click();else return false;
     }finally{bypass=false;}
     // A legacy busy guard can refuse closing; keep the shell open in that case.
     return revision!==before;
    }
   });
   active=api;
   api.modal.dataset.renderer=name;
   api.backdrop.addEventListener('click',event=>{
    if(bypass)return;const button=event.target.closest('button');
    if(button&&button===cancel){event.preventDefault();event.stopImmediatePropagation();api.dismiss();}
   },true);
   if(body!==node)node.remove();
   if(overlay)overlay.remove();
   ui.enhance(api.modal);ui.restoreFocus(focus);
   return result;
  };
 }
 document.addEventListener('DOMContentLoaded',()=>{
  install('renderModal','#modal .modal');
  install('staffMarkDone','#staff-modal-host .modal','closeStaffConfirm');
  install('catRender','#content > .imd');
  for(const name of ['mvRender','aprRender','whmRender'])install(name,'#content > .mv-modal');
 });
})();
