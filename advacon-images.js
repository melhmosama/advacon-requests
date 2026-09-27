/* Shared raster-image validation and conversion. Originals already stored are never overwritten. */
(function(){
'use strict';
const MAX_BYTES=20*1024*1024,MAX_PIXELS=60000000;
const accept='image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,image/heif,.jpg,.jpeg,.jpe,.jfif,.png,.webp,.gif,.bmp,.avif,.heic,.heif';
const ext=value=>String(value||'').split(/[?#]/)[0].split('.').pop().toLowerCase();
const supported=new Set(['jpg','jpeg','jpe','jfif','png','webp','gif','bmp','avif','heic','heif']);
const ar=()=>document.documentElement.lang==='ar';
const messages={size:['الصورة أكبر من 20 ميجابايت. اختر صورة أصغر.','Image exceeds 20 MB. Choose a smaller image.'],format:['صيغة الصورة غير مدعومة. اختر JPG أو PNG أو WebP أو GIF أو BMP أو AVIF أو HEIC.','Unsupported image. Choose JPG, PNG, WebP, GIF, BMP, AVIF or HEIC.'],decode:['تعذّر قراءة الصورة. أعد تصديرها كـ JPG أو PNG ثم ارفعها.','Cannot read this image. Export it as JPG or PNG and upload again.'],dimensions:['أبعاد الصورة كبيرة جدًا. اختر صورة أصغر.','Image dimensions are too large. Choose a smaller image.'],converter:['تعذّر تجهيز صورة الآيفون. تحقق من الاتصال وأعد المحاولة.','Cannot prepare the iPhone photo. Check your connection and retry.']};
function error(code){const e=new Error(messages[code][ar()?0:1]);e.code='image_'+code;return e;}
function isImage(file){return supported.has(ext(file?.name))||/^image\/(jpeg|jpg|pjpeg|png|x-png|webp|gif|bmp|x-ms-bmp|avif|heic|heif)(;|$)/i.test(file?.type||'');}
function uploadError(e,fallback){return String(e?.code||'').startsWith('image_')?e.message:fallback;}
async function kind(blob){
 const b=new Uint8Array(await blob.slice(0,256).arrayBuffer()),s=String.fromCharCode(...b);
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'jpeg';
 if(s.startsWith('\x89PNG\r\n\x1a\n'))return 'png';
 if(s.startsWith('GIF87a')||s.startsWith('GIF89a'))return 'gif';
 if(s.startsWith('BM'))return 'bmp';
 if(s.startsWith('RIFF')&&s.slice(8,12)==='WEBP')return 'webp';
 if(s.slice(4,8)==='ftyp'){
  const brands=[];for(let i=8;i<Math.min(b.length,new DataView(b.buffer).getUint32(0));i+=4)if(i!==12)brands.push(s.slice(i,i+4));
  if(brands.some(x=>['avif','avis'].includes(x)))return 'avif';
  if(brands.some(x=>['heic','heix','hevc','hevx','heim','heis','mif1','msf1'].includes(x)))return 'heic';
 }
 throw error('format');
}
let decoder=null,queue=Promise.resolve();
function serialized(job){const result=queue.then(job,job);queue=result.catch(()=>{});return result;}
async function decode(blob){
 const image=new Image(),url=URL.createObjectURL(blob);
 try{image.src=url;await Promise.race([image.decode(),new Promise((_,reject)=>{image._timeout=setTimeout(()=>reject(error('decode')),20000);})]);return image;}
 finally{clearTimeout(image._timeout);URL.revokeObjectURL(url);}
}
async function convert(file,{maxEdge=3200,forceJpeg=false,quality=.92}={}){
 if(!file?.size)throw error('decode');if(file.size>MAX_BYTES)throw error('size');
 const type=await kind(file);let source=new Blob([file],{type:'image/'+(type==='heic'?'heic':type)}),image;
 try{image=await decode(source);}catch(e){
  if(type!=='heic')throw error('decode');
  try{decoder=decoder||import('/advacon-heic-1.5.2.mjs');const lib=await decoder;source=await lib.heicTo({blob:source,type:'image/jpeg',quality});image=await decode(source);}catch(e){decoder=null;throw error('converter');}
 }
 const w=image.naturalWidth,h=image.naturalHeight;
 if(!w||!h)throw error('decode');if(w*h>MAX_PIXELS)throw error('dimensions');
 const name=String(file.name||'image').replace(/\.[^.]+$/,'').replace(/[\u0000-\u001f]/g,'')||'image';
 if(!forceJpeg&&['jpeg','png'].includes(type)&&Math.max(w,h)<=maxEdge)return new File([source],name+(type==='jpeg'?'.jpg':'.png'),{type:'image/'+type});
 const ratio=Math.min(1,maxEdge/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));
 const ctx=canvas.getContext('2d'),mime=forceJpeg||['jpeg','heic','bmp'].includes(type)?'image/jpeg':'image/png';
 if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.drawImage(image,0,0,canvas.width,canvas.height);
 try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,quality));if(!blob)throw error('decode');if(blob.size>MAX_BYTES)throw error('size');return new File([blob],name+(mime==='image/jpeg'?'.jpg':'.png'),{type:mime});}
 finally{canvas.width=canvas.height=1;}
}
function prepare(file,options){return serialized(()=>convert(file,options));}
function dataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(error('decode'));r.readAsDataURL(blob);});}
const cache=new Map(),repairs=new WeakMap();
function allowedURL(raw){try{const u=new URL(raw,location.href);return u.origin==='https://abnfwabpqnwnscwyfqbm.supabase.co'&&/^\/storage\/v1\/object\/(public|sign|authenticated)\/(request-images|warehouse-images)\//.test(u.pathname)?u.href:'';}catch{return '';}}
async function preview(raw){
 const url=allowedURL(raw);if(!url)throw error('decode');
 if(cache.has(url))return cache.get(url);
 const work=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(url,{signal:controller.signal,credentials:'omit'});if(!response.ok)throw error('decode');if(Number(response.headers.get('content-length'))>MAX_BYTES)throw error('size');return await dataURL(await prepare(await response.blob()));}finally{clearTimeout(timer);}})();
 cache.set(url,work);if(cache.size>30)cache.delete(cache.keys().next().value);
 try{return await work;}catch(e){cache.delete(url);throw e;}
}
function repair(img){
 const src=img.getAttribute('src');const old=repairs.get(img);if(old?.src===src)return old.work;
 if(!allowedURL(src))return Promise.reject(error('decode'));
 const entry={src,failed:false,work:null};repairs.set(img,entry);
 entry.work=preview(src).then(async url=>{if(img.getAttribute('src')!==src)return;img.src=url;await img.decode();img.dataset.imageOriginal=src;img.hidden=false;img.style.removeProperty('display');img.parentElement?.querySelector('.we-fb')?.remove();}).catch(e=>{entry.failed=true;throw e;});return entry.work;
}
document.addEventListener('error',event=>{
 const img=event.target;if(img?.tagName!=='IMG'||!allowedURL(img.getAttribute('src')))return;
 const old=repairs.get(img);if(old?.src===img.getAttribute('src')&&old.failed)return;
 event.stopImmediatePropagation();void repair(img).catch(()=>{if(img.isConnected){img.alt=ar()?'تعذّر عرض الصورة؛ افتح المرفق الأصلي.':'Image unavailable; open the original attachment.';img.dispatchEvent(new Event('error'));}});
},true);
async function ready(img){try{await img.decode();}catch{await (repairs.get(img)?.work||repair(img));}return img.naturalWidth>0;}
window.AdvaconImages={accept,maxBytes:MAX_BYTES,isImage,kind,prepare,dataURL,uploadError,repair,ready};
})();
