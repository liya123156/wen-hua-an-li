import {CONFIG} from './config.js';
import {THEMES,STORES,PUBLIC_FIELDS,SCORE_DIMENSIONS,analyze,recommend,parsePaste,validate,countWords,campaignRange} from './model.js';
import {qrSvg} from './qr.js';
import {inspectSubmission,splitSubmissions,submissionCounts} from './submission.js';
import {buildAdviceCard,adviceCardText,renderAdviceImage} from './advice-image.js';
import {routeFromHash,createRouteFragment} from './routes.js';
import {storeCollection,storeFeedback,renderCollectionImage} from './store-collection.js';
import {parseModificationLink,caseClientInfo} from './edit-access.js';
import {buildReminder,shanghaiDay,renderCountsImage} from './counts-tools.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const nowMonth=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date()).replace('/','-');
const state={cases:[],cycle:nowMonth,view:'submit',theme:'',selectionTheme:'',editing:null,keys:read('culture-edit-keys-v1',{}),busy:false,loading:false,loaded:false,dataRevision:0};
const hash=new URLSearchParams(location.hash.slice(1));
const editRequest=hash.get('edit')&&hash.get('key')?{id:hash.get('edit'),token:hash.get('key')}:null;
const requestedView=routeFromHash(location.hash);
history.replaceState(null,'',location.pathname+createRouteFragment(requestedView));
try{localStorage.removeItem('culture-access-v1')}catch{}
let drafts=[];
let toastTimer,draftTimer;
let adviceSession=null,adviceObjectUrl='',adviceTicket=0;
let collectionSession=null,collectionObjectUrl='',collectionTicket=0,editLinkTarget=null;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500)}
function showDialog(el){if(!el.open)el.showModal()}
function shareLink(){return `${CONFIG.siteUrl}/`}
function editable(c){return !!c&&!!state.keys[c.id]}
function setStatus(text,offline=false){$('#sync-status').textContent=text;$('.status-dot').classList.toggle('offline',offline)}
function themeOf(name){return THEMES.find(t=>t.name===name)}
function button(action,id,text,extra=''){return `<button class="text-button ${extra}" data-action="${action}" data-id="${esc(id)}">${text}</button>`}
function empty(title,description,action=true){return `<div class="empty-state"><span class="empty-symbol">✧</span><h3>${esc(title)}</h3><p>${esc(description)}</p>${action?'<button class="button secondary" data-action="new">记录第一篇故事 ↗</button>':''}</div>`}
async function api(path,{method='GET',body,token=''}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  let response;
  try{response=await fetch(CONFIG.supabaseUrl+'/rest/v1/'+path,{method,headers:{apikey:CONFIG.publishableKey,'Content-Type':'application/json','x-client-info':caseClientInfo(token),...(method==='GET'?{}:{Prefer:'return=representation'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal})}catch(e){throw Error(e.name==='AbortError'?'连接超时，请稍后重试；当前草稿已保留。':'暂时无法连接案例库，请检查网络后重试。')}finally{clearTimeout(timer)}
  if(!response.ok){let data={};try{data=await response.json()}catch{}if(response.status===409)throw Error('本次提交已保存，请刷新案例库查看。');if(response.status===401||response.status===403)throw Error('保存权限验证未通过；修改案例请使用该篇专属修改链接。');if(data.code==='23514')throw Error('请核对店面、推荐主题和案例内容，店总评价不超过5000字。');throw Error('保存未成功，请稍后重试；当前草稿已保留。')}
  if(response.status===204)return [];
  return response.json();
}
async function loadCases({silent=false}={}){
  if(state.loading)return;
  state.loading=true;setStatus('正在同步案例库');$('#refresh').disabled=true;
  try{
    const cycle=state.cycle,revision=state.dataRevision,rows=[];let offset=0;
    for(;;){const page=await api(`culture_cases_v1?select=${PUBLIC_FIELDS}&cycle=eq.${encodeURIComponent(cycle)}&order=created_at.desc,id.asc&limit=1000&offset=${offset}`);rows.push(...page);if(page.length<1000)break;offset+=1000}
    if(cycle!==state.cycle)return;
    state.cases=revision===state.dataRevision?rows:[...new Map([...rows,...state.cases].map(c=>[c.id,c])).values()];state.loaded=true;
    const time=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());setStatus('已同步 · '+time);renderLibrary();renderSelection();renderCounts();
  }catch(e){setStatus('暂未同步 · 点击刷新重试',true);if(!silent)toast(e.message);if(!state.loaded){$('#case-grid').innerHTML=empty('案例库暂未连接成功','请点击右上角刷新重试，已填写的草稿会保留。',false);$('#selection-results').innerHTML=empty('暂时无法读取案例','连接恢复后将按主题重新生成推荐。',false)}}
  finally{state.loading=false;$('#refresh').disabled=false}
}
function changeView(view,scroll=true){state.view=view;$$('.page-view').forEach(x=>x.hidden=x.id!==`view-${view}`);$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('#page-name').textContent={submit:'粘贴案例',library:'案例库',selection:'案例评选',counts:'各店提交数量一览表'}[view];history.replaceState(null,'',location.pathname+createRouteFragment(view));if(scroll)window.scrollTo({top:0,behavior:'instant'})}
function campaign(){$('#campaign-dates').textContent=state.cycle.replace('-','年')+'月征集';}
function freshDraft(raw='',extra={}){return {localId:crypto.randomUUID(),raw,managerReview:'',referenceNote:'',cycle:state.cycle,error:'',savedId:'',pending:null,...extra}}
function saveDrafts(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>write('culture-drafts-v2',drafts.filter(d=>!d.savedId)),250)}
function draftMarkup(d,index){
  const a=inspectSubmission(d.raw,d.cycle),parts=d.savedId?[]:splitSubmissions(d.raw);
  return `<article class="panel submission-card ${d.savedId?'is-saved':''}" data-draft-id="${d.localId}"><div class="submission-card-heading"><h3>案例 ${String(index+1).padStart(2,'0')}</h3><small>${d.savedId?'已入库':d.editId?'正在修改原案例':'粘贴原文即可'}</small></div><div class="submission-tags" data-slot="tags">${draftTags(a)}</div><label class="sr-only" for="input-${d.localId}">第${index+1}篇案例</label><textarea id="input-${d.localId}" data-draft-input="${d.localId}" rows="9" maxlength="120000" ${d.savedId?'readonly':''} placeholder="店面：黄浦滨江店&#10;推荐主题：拥抱变化&#10;&#10;在这里粘贴案例全文……&#10;&#10;本框默认一篇。多篇可新建输入框，或用“案例1 / 案例2”明确编号。">${esc(d.raw)}</textarea><label class="manager-review-label" for="review-${d.localId}">店总评价 <span>选填 · 不填写也可提交</span></label><textarea id="review-${d.localId}" class="manager-review-input" data-manager-review="${d.localId}" rows="3" maxlength="5000" ${d.savedId?'readonly':''} placeholder="可写推荐理由、具体评价或修改建议。店面推荐的2篇可注明：店总推荐1 / 店总推荐2。">${esc(d.managerReview||'')}</textarea><div class="split-hint" data-slot="split" ${parts.length>1?'':'hidden'}><span>找到 ${parts.length} 个明确案例编号</span><button class="text-button" data-split-draft="${d.localId}">拆分为多篇 ↗</button></div><div class="error-box" role="alert" data-slot="error" ${d.error?'':'hidden'}>${esc(d.error)}</div><div class="submission-card-footer"><small data-slot="hint">${d.savedId?'已保存到案例库':d.raw.trim()?`${a.chars}字 · ${a.ok?'店面与主题已明确':a.errors[0]||'请补充原文'}`:'请在原文中写清店面和推荐主题'}</small><div>${d.savedId?`<span class="saved-label">已入库 ✓</span> ${button('detail',d.savedId,'查看案例')} ${button('edit',d.savedId,'修改本篇')} ${state.keys[d.savedId]?button('copy-edit-link',d.savedId,'复制修改链接给BP'):''}`:`<button class="button primary" data-submit-draft="${d.localId}" ${!a.ok||state.busy?'disabled':''}>${d.editId?'保存修改':'提交本篇'} ↗</button>`}</div></div></article>`;
}
function draftTags(a){return `<span class="detected-tag ${a.store?'':'missing'}">${esc(a.store||'需写清店面')}</span><span class="detected-tag ${a.theme?'':'missing'}">${esc(a.theme||'需写清推荐主题')}</span>`}
function renderDrafts(){$('#submission-list').innerHTML=drafts.map(draftMarkup).join('');}
function updateDraftCard(d){const el=$(`[data-draft-id="${d.localId}"]`);if(!el)return;const a=inspectSubmission(d.raw,d.cycle),parts=splitSubmissions(d.raw);el.querySelector('[data-slot="tags"]').innerHTML=draftTags(a);el.querySelector('[data-slot="hint"]').textContent=d.raw.trim()?`${a.chars}字 · ${a.ok?'店面与主题已明确':a.errors[0]||'请补充原文'}`:'请在原文中写清店面和推荐主题';const split=el.querySelector('[data-slot="split"]');split.hidden=parts.length<2;split.querySelector('span').textContent=`找到 ${parts.length} 个明确案例编号`;const submit=el.querySelector('[data-submit-draft]');if(submit)submit.disabled=!a.ok||state.busy;const error=el.querySelector('[data-slot="error"]');error.hidden=!d.error;error.textContent=d.error;}
function addDraft(){const d=freshDraft();drafts.push(d);renderDrafts();saveDrafts();$('#input-'+d.localId).focus();}
function splitDraft(localId){const index=drafts.findIndex(d=>d.localId===localId),d=drafts[index];if(!d||d.savedId||d.editId)return;const parts=splitSubmissions(d.raw);if(parts.length<2)return;drafts.splice(index,1,...parts.map((raw,i)=>freshDraft(raw,{cycle:d.cycle,managerReview:i===0?d.managerReview:''})));renderDrafts();saveDrafts();toast(`已拆成${parts.length}篇，请分别提交；如有店总评价，请核对对应案例。`);}
async function digest(token){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(n=>n.toString(16).padStart(2,'0')).join('')}
function randomToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('')}
function modificationLink(id,token){return `${CONFIG.siteUrl}/#edit=${encodeURIComponent(id)}&key=${encodeURIComponent(token)}`}
async function submitDraft(localId){
 const d=drafts.find(x=>x.localId===localId);if(!d||d.savedId||state.busy)return;const a=inspectSubmission(d.raw,d.cycle);if(!a.ok){d.error=a.errors.join(' ');updateDraftCard(d);return}
 if(String(d.managerReview||'').length>5000){d.error='店总评价请控制在5000字以内。';updateDraftCard(d);return}
 const data={...a.payload,reference_note:d.referenceNote||'',manager_review:String(d.managerReview||'').trim()};state.busy=true;d.error='';$$('[data-submit-draft]').forEach(b=>b.disabled=true);const current=$(`[data-submit-draft="${d.localId}"]`);if(current)current.textContent='正在保存…';
 try{
  let id,token,saved;
  if(d.editId){id=d.editId;token=d.token;const update={...data};delete update.cycle;saved=await api(`culture_cases_v1?id=eq.${id}&select=${PUBLIC_FIELDS}`,{method:'PATCH',body:update,token});if(!saved.length)throw Error('没有此案例的修改权限，请使用该篇案例的专属修改链接。');}
  else{
   if(!d.pending){d.pending={id:crypto.randomUUID(),token:randomToken()};write('culture-drafts-v2',drafts.filter(x=>!x.savedId));}({id,token}=d.pending);
   const existing=await api(`culture_cases_v1?id=eq.${id}&select=${PUBLIC_FIELDS}`);
   if(existing.length){const update={...data};delete update.cycle;saved=await api(`culture_cases_v1?id=eq.${id}&select=${PUBLIC_FIELDS}`,{method:'PATCH',body:update,token});if(!saved.length)throw Error('请使用这篇案例原有的专属修改链接重试。');}
   else saved=await api(`culture_cases_v1?select=${PUBLIC_FIELDS}`,{method:'POST',body:{...data,id,edit_hash:await digest(token)},token});
  }
  if(!saved?.[0])throw Error('未收到保存结果，草稿已保留，请重试。');
  if(token){state.keys[id]=token;write('culture-edit-keys-v1',state.keys);}d.savedId=id;d.savedRecord=saved[0];d.pending=null;d.editId='';state.dataRevision++;
  if(saved[0].cycle===state.cycle){state.cases=[saved[0],...state.cases.filter(c=>c.id!==id)];state.loaded=true;renderLibrary();renderSelection();renderCounts();}
  if(!drafts.some(x=>!x.savedId&&!x.raw.trim()))drafts.push(freshDraft());
  saveDrafts();toast(d.wasEdit?'原案例已更新，评分和门店集锦已同步，提交篇数不变。':'本篇已入库，可以继续提交下一篇。');void loadCases({silent:true});
 }catch(e){d.error=e.message;saveDrafts();}
 finally{state.busy=false;renderDrafts();}
}
function filteredCases(){const q=$('#search').value.trim().toLowerCase(),store=$('#store-filter').value;return state.cases.filter(c=>(!state.theme||c.theme===state.theme)&&(!store||c.store===store)&&(!q||`${c.title} ${c.body} ${c.nominee} ${c.author} ${c.store}`.toLowerCase().includes(q))).sort((a,b)=>$('#sort').value==='quality'?analyze(b).total-analyze(a).total:(b.created_at||'').localeCompare(a.created_at||''))}
function card(c){const t=themeOf(c.theme),a=analyze(c),date=(c.event_on||c.created_at?.slice(0,10)||'').replaceAll('-','.');return `<article class="panel case-card"><div class="case-card-top"><span class="theme-badge">${esc(t?.mark)} ${esc(c.theme)}</span><small>${esc(date)}</small></div><h3>${esc(c.title)}</h3><div class="case-meta"><span>${esc(c.nominee)}</span><span>·</span><span>${esc(c.store)}</span>${c.team?`<span>· ${esc(c.team)}</span>`:''}</div><p class="case-excerpt">${esc(c.body)}</p><div class="card-bottom"><span class="score-mini">文字初筛 <b>${a.total}/100</b> 分</span>${button('detail',c.id,'查看故事 ↗')}</div></article>`}
function renderThemeFilter(selector,selection=false){const active=selection?state.selectionTheme:state.theme;$(selector).innerHTML=[{name:'',mark:'全部主题'},...THEMES].map(t=>`<button class="filter-chip ${active===t.name?'active':''}" data-theme="${esc(t.name)}" data-selection="${selection}">${t.name?`${t.mark} ${t.name}`:t.mark}</button>`).join('')}
function currentStoreCollection(){return storeCollection(state.cases,$('#store-filter').value,state.cycle)}
function fullCaseCard(c){const a=analyze(c),t=themeOf(c.theme);return `<article class="panel collection-case"><div class="collection-case-heading"><div><span class="theme-badge">${esc(t?.mark)} ${esc(c.theme)}</span><h3>${esc(c.title)}</h3><p class="case-meta">${esc(c.nominee||'主人公待补充')} · ${esc(c.store)}${c.team?' · '+esc(c.team):''}</p></div>${scoreSummary(a)}</div>${scoreExplanation(a)}<h4 class="full-body-label">案例完整原文</h4><div class="full-case-body">${esc(c.body)}</div>${managerBlock(c)}<div class="collection-case-actions">${button('detail',c.id,'查看评分依据与修改建议')}${button('advice-image',c.id,'给撰写人 / BP · 修改建议图')}${button('edit',c.id,editable(c)?'修改本篇案例':'BP修改本篇案例','edit-case-button')}${editable(c)?button('copy-edit-link',c.id,'复制本篇修改链接给BP'):''}</div></article>`}
function renderLibrary(){
 const store=$('#store-filter').value,report=store?currentStoreCollection():null,total=state.cases.length,covered=new Set(state.cases.map(c=>c.store)).size,qualified=state.cases.filter(c=>analyze(c).eligible).length;
 const metrics=report?[['本店已收集',report.total,'篇'],['覆盖文化主题',report.themes.length,'/ 7个'],['文字初筛可复核',report.qualified,'篇'],['待补充完善',report.pending,'篇']]:[['已收集案例',total,'篇'],['已覆盖门店',covered,'/ 21店'],['进入初筛推荐池',qualified,'篇'],['待完善案例',total-qualified,'篇']];
 $('#stats').innerHTML=metrics.map(([label,n,unit])=>`<article class="stat-card"><span>${label}</span><strong>${state.loaded?n:'—'}<small>${unit}</small></strong></article>`).join('');
 const rows=filteredCases();$('#list-count').textContent=store?`${state.cycle.replace('-','年')}月 · ${store} · 当前显示${rows.length}篇，本月共${report.total}篇`:`${state.cycle.replace('-','年')}月 · 共${rows.length}篇案例`;
 $('#case-grid').classList.toggle('full-library',!!store);
 $('#case-grid').innerHTML=rows.length?rows.map(store?fullCaseCard:card).join(''):empty(store?'当前没有符合条件的案例':'故事从你的发现开始',store?'可以调整主题或搜索关键词；门店月度结论以本店全部当月案例为准。':'本月暂未收到案例。推荐身边的优秀伙伴，让好行为被更多人看见。',!store);
 $('#store-collection-panel').hidden=!store;
 if(store){
  $('#store-collection-title').textContent=store+' · 本月文化案例集锦';
  $('#store-collection-scope').textContent=state.loaded?`集锦范围：${state.cycle.replace('-','年')}月 · 本店全部${report.total}篇 · 包含完整原文、评分和店总评价`:'正在读取本店当月案例…';
  $('#collection-feedback').value=state.loaded?storeFeedback(report):'';
  $('#collection-feedback').placeholder='同步数据后生成本月收集结论。';
  $('#open-store-collection').disabled=!state.loaded;$('#copy-store-feedback').disabled=!state.loaded;
 }
 renderThemeFilter('#theme-filter');
}
async function openCollectionImages(){
 if(!state.loaded||!$('#store-filter').value)return;
 const ticket=++collectionTicket,report=currentStoreCollection();
 if(collectionObjectUrl){URL.revokeObjectURL(collectionObjectUrl);collectionObjectUrl=''}
 const session={report,image:null};collectionSession=session;
 $('#collection-dialog-title').textContent=report.store+' · 本月案例集锦';$('#collection-dialog-scope').textContent=report.cycle.replace('-','年')+'月 · 本店全部'+report.total+'篇合在一张长图 · 完整原文、评分与店总评价';
 $('#collection-preview').hidden=true;$('#collection-preview').removeAttribute('src');$('#collection-loading').hidden=false;$('#collection-loading').textContent='正在将本店全部案例合成一张完整长图…';$('#copy-collection-image').disabled=true;$('#download-collection-image').disabled=true;
 showDialog($('#collection-dialog'));
 session.image=renderCollectionImage(report);
 try{const blob=await session.image;if(ticket!==collectionTicket||!$('#collection-dialog').open)return;collectionObjectUrl=URL.createObjectURL(blob);$('#collection-preview').src=collectionObjectUrl;$('#collection-preview').alt=report.store+' '+report.cycle+'全部'+report.total+'篇案例合成一张完整长图';$('#collection-preview').hidden=false;$('#collection-loading').hidden=true;$('#copy-collection-image').disabled=false;$('#download-collection-image').disabled=false;}
 catch(e){if(ticket===collectionTicket)$('#collection-loading').textContent=e.message||'长图生成失败，请重试。'}
}
async function shareCollectionImage(copyImage=true){
 const session=collectionSession;if(!session?.image)return;
 const image=session.image,name='文化案例完整集锦_'+session.report.store+'_'+session.report.cycle+'.png';
 try{
  if(copyImage&&navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
   try{await navigator.clipboard.write([new ClipboardItem({'image/png':image})]);toast('本店全部案例长图已复制，可直接粘贴给店总。');return}catch{}
  }
  downloadBlob(name,await image);toast(copyImage?'浏览器未允许复制图片，完整长图已下载，可直接转发。':'本店全部案例长图已下载。');
 }catch(e){toast(e.message||'长图导出失败，请重试。')}
}
async function requestEdit(c){
 if(editable(c)){await editCase(c,state.keys[c.id]);return;}
 editLinkTarget=c;$('#case-edit-case-name').textContent=c.title+' · '+c.store;$('#case-edit-link').value='';$('#case-edit-error').textContent='';showDialog($('#case-edit-dialog'));
}
function reminderDeadline(){const saved=read('culture-reminder-deadlines-v1',{});return saved[state.cycle]??(state.cycle===nowMonth?shanghaiDay():'')}
function renderReminder(){
 const deadline=$('#reminder-deadline').value;
 const text=state.loaded?buildReminder({counts:submissionCounts(state.cases,state.cycle),deadline,link:shareLink()}):'';
 $('#reminder-message').value=text;
 $('#reminder-message').placeholder=state.loaded?'请先设置截止日期，自动生成提交提醒。':'正在读取实际提交数量…';
 $('#copy-reminder').disabled=!state.loaded||!text;
}
function renderCounts(){
 const counts=submissionCounts(state.cases,state.cycle),{rows,totals,grandTotal}=counts,ready=state.loaded;
 const completed=rows.filter(r=>r.total>=3).length;
 $('#counts-caption').innerHTML=`<span>${esc(state.cycle.replace('-','年'))}月 · 21家门店 · 7大文化主题</span><strong>${ready?'合计 '+grandTotal+' 篇 · 达到3篇 '+completed+' / 21店':'正在读取实际提交数量…'}</strong>`;
 $('#counts-table thead').innerHTML='<tr><th scope="col">店面</th>'+THEMES.map(t=>`<th scope="col">${t.name}</th>`).join('')+'<th scope="col">合计</th></tr>';
 $('#counts-table tbody').innerHTML=rows.map(r=>'<tr><th scope="row">'+esc(r.store)+'</th>'+THEMES.map(t=>`<td class="${r.counts[t.name]?'has-count':'zero'}">${ready?r.counts[t.name]:'—'}</td>`).join('')+`<td class="store-total ${ready&&r.total<3?'below-target':'target-met'}">${ready?r.total:'—'}</td></tr>`).join('');
 $('#counts-table tfoot').innerHTML='<tr><th scope="row">合计</th>'+THEMES.map(t=>`<td>${ready?totals[t.name]:'—'}</td>`).join('')+`<td>${ready?grandTotal:'—'}</td></tr>`;
 ['#copy-counts','#copy-counts-image','#download-counts-image'].forEach(id=>$(id).disabled=!ready);
 $('#reminder-deadline').value=reminderDeadline();renderReminder();
}
function downloadBlob(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
async function countsImage(copyImage=true){
 if(!state.loaded)return;
 const counts=submissionCounts(state.cases,state.cycle),cycle=state.cycle;
 const image=renderCountsImage({counts,cycle,deadline:$('#reminder-deadline').value});
 const name=`文化案例提交一览_${cycle}.png`;
 try{
  if(copyImage&&navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
   try{await navigator.clipboard.write([new ClipboardItem({'image/png':image})]);toast('表格图片已复制，可直接粘贴到微信。');return}catch{}
  }
  downloadBlob(name,await image);toast(copyImage?'当前浏览器未允许复制图片，已为你下载PNG。':'完整表格图片已下载，包含全部21家门店。');
 }catch(e){toast(e.message||'图片生成失败，请重试。')}
}
function countsText(){const {rows,totals,grandTotal}=submissionCounts(state.cases,state.cycle);return [[state.cycle+' 文化案例提交数量一览表'],['店面',...THEMES.map(t=>t.name),'合计'],...rows.map(r=>[r.store,...THEMES.map(t=>r.counts[t.name]),r.total]),['合计',...THEMES.map(t=>totals[t.name]),grandTotal]].map(row=>row.join('\t')).join('\n');}
function standards(t){return `<details class="panel standard-details"><summary>${esc(t.name)} · 查看正式标准提要及正负向行为</summary><div class="standard-content"><p><b>价值观解读：</b>${esc(t.meaning)}</p><p><b>为什么：</b>${esc(t.value)}</p><div class="standard-columns"><div><h4>正向行为 · 寻找具体行动</h4><ul>${t.yes.map(([v])=>`<li>${esc(v)}</li>`).join('')}</ul></div><div><h4>负向行为 · 核实冲突线索</h4><ul>${t.no.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div></div><p>以上为依据上传文件整理的标准提要。完整表述以<a href="./value-standard.png" target="_blank" rel="noopener">价值观解读与行为准则原图</a>为准。</p></div></details>`}
function managerBlock(c){return c.manager_review?.trim()?`<div class="manager-review-display"><span class="manager-badge">♡ ${esc(analyze(c).manager.label)}</span><p>${esc(c.manager_review)}</p></div>`:''}
function scoreSummary(a){return `<div class="recommend-score" aria-label="文字初筛参考分${a.total}分，满分100分"><span class="score-label">文字初筛参考分</span><span class="score-value"><b>${a.total}</b><small>分 / 100</small></span></div>`}
function scoreExplanation(a){return `<div class="score-explanation"><dl class="score-dimensions">${SCORE_DIMENSIONS.map(d=>`<div><dt>${d.label}</dt><dd><b>${a.scores[d.key]}</b><span> / ${d.max}</span></dd></div>`).join('')}</dl><p>系统按现有文字的四项呈现情况计算，供内容初筛参考。最终入选由负责人核实确认。${a.repetitive?'重复表达较多，参考总分已下调。':''}${a.manager.present?'店总评价另作推荐参考，不计入100分。':''}</p></div>`}
function recommendationCard(c){const a=c.assessment;return `<article class="panel recommend-card"><p class="rank-label">月会视频候选 · 建议优先复核</p><div class="recommend-head"><h3>${esc(c.title)}</h3>${scoreSummary(a)}</div><div class="case-meta">${esc(c.nominee)} · ${esc(c.store)}</div>${scoreExplanation(a)}${managerBlock(c)}<div class="review-block"><h4>为什么推荐</h4><ul>${a.reasons.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div><div class="review-block"><h4>月会视频 · 下一步怎么完善</h4><ul>${a.suggestions.slice(0,3).map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div><div class="card-bottom">${button('detail',c.id,'查看完整案例')}${button('advice-image',c.id,'给撰写人 / BP · 修改建议图','advice-image-button')}</div></article>`}
function renderSelection(){
  renderThemeFilter('#selection-theme-filter',true);const limit=+$('#recommend-limit').value;
  $('#selection-results').innerHTML=THEMES.filter(t=>!state.selectionTheme||t.name===state.selectionTheme).map(t=>{
    const all=state.cases.filter(c=>c.theme===t.name),selected=recommend(state.cases,t.name,limit),selectedIds=new Set(selected.map(c=>c.id)),pending=all.filter(c=>!selectedIds.has(c.id));
    return `<section class="selection-group"><div class="selection-group-heading"><h2><span>${t.mark}</span>${t.name}</h2><div><p>收到${all.length}篇 · 视频候选${selected.length}篇</p>${selected.length?`<button class="text-button copy-theme-advice" data-advice-theme="${t.name}">本主题修改建议图</button>`:''}</div></div>${standards(t)}<div class="selection-cards">${selected.length?selected.map(recommendationCard).join(''):empty(all.length?'本主题暂未推荐候选':'等待这一主题的好故事',all.length?'现有案例还需补充关键行动或实际结果，完善后会重新参与初筛。':'提交真实、具体的文化故事后，这里会生成推荐依据与完善建议。',!all.length)}</div>${pending.length?`<details class="panel pending-list"><summary>其他${pending.length}篇案例 · 查看完善建议</summary>${pending.map(c=>{const a=analyze(c);return `<div class="pending-row"><strong>${esc(c.nominee)} · ${esc(c.store)} · 初筛参考 ${a.total}/100分</strong><p>${esc(a.eligible?'已达到初筛条件，因当前推荐名额暂未列入；仍可由负责人复核比较。':a.suggestions.slice(0,2).join(' '))}</p>${button('detail',c.id,'查看原文与完整建议 ↗')}</div>`}).join('')}</details>`:''}</section>`;
  }).join('');
}
async function showAdvice(cases,index=0){
 if(!cases?.length)return;
 const ticket=++adviceTicket,c=cases[index],card=buildAdviceCard(c),image=renderAdviceImage(card);
 adviceSession={cases,index,card,image,name:`文化案例修改建议_${card.person}_${card.theme}.png`.replace(/[\\/:*?"<>|]/g,'_')};
 if(adviceObjectUrl){URL.revokeObjectURL(adviceObjectUrl);adviceObjectUrl=''}
 $('#advice-preview').hidden=true;$('#advice-preview').removeAttribute('src');$('#advice-loading').hidden=false;$('#advice-loading').textContent='正在生成修改建议图片…';
 $('#copy-advice-image').disabled=true;$('#download-advice-image').disabled=true;
 $('#advice-pager').hidden=cases.length<2;$('#advice-page').textContent=`${index+1} / ${cases.length}`;$('#advice-prev').disabled=index===0;$('#advice-next').disabled=index===cases.length-1;
 showDialog($('#advice-dialog'));
 try{const blob=await image;if(ticket!==adviceTicket||!$('#advice-dialog').open)return;adviceObjectUrl=URL.createObjectURL(blob);$('#advice-preview').src=adviceObjectUrl;$('#advice-preview').alt=`${card.person} · ${card.store} · ${card.theme}的修改建议图片`;$('#advice-preview').hidden=false;$('#advice-loading').hidden=true;$('#copy-advice-image').disabled=false;$('#download-advice-image').disabled=false;}
 catch(e){if(ticket!==adviceTicket)return;$('#advice-loading').textContent=e.message||'图片生成失败，请重试。'}
}
async function shareAdviceImage(copyImage=true){
 const current=adviceSession;if(!current)return;
 try{
  if(copyImage&&navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
   try{await navigator.clipboard.write([new ClipboardItem({'image/png':current.image})]);toast('修改建议图片已复制，可直接粘贴给撰写人或BP。');return}catch{}
  }
  downloadBlob(current.name,await current.image);toast(copyImage?'当前浏览器未允许复制图片，已下载PNG，可直接转发。':'修改建议图片已下载。');
 }catch(e){toast(e.message||'图片导出失败，请重试。')}
}
function caseText(c){if(inspectSubmission(c.body,c.cycle).ok)return c.body;return [`店面：${c.store}`,`推荐主题：${c.theme}`,c.nominee?`被推荐人：${c.nominee}`:'',c.behavior?`对应文化行为点：${c.behavior}`:'',c.joined_on?`被推荐人入职时间：${c.joined_on}`:'',c.recommender?`推荐人：${c.recommender}`:'',c.author?`撰写人：${c.author}`:'',c.event_on?`事件发生日期：${c.event_on}`:'',`案例标题：${c.title}`,'',c.body].filter(v=>v!==null).join('\n');}
function showDetail(c){
  if(!c)return;const a=analyze(c),t=themeOf(c.theme),info=[['被推荐人',c.nominee],['门店',c.store],['组别',c.team],['入职时间',c.joined_on],['发生日期',c.event_on],['推荐人',c.recommender],['撰写人',c.author]].filter(([,v])=>v);
  $('#detail-content').innerHTML=`<span class="theme-badge">${esc(t?.mark)} ${esc(c.theme)}</span><h2>${esc(c.title)}</h2><div class="detail-info">${info.map(([label,value])=>`<span>${label}：${esc(value)}</span>`).join('')}</div>${c.behavior?`<p class="muted">文化行为点：${esc(c.behavior)}</p>`:''}<div class="detail-body">${esc(c.body)}</div>${managerBlock(c)}${c.reference_note?`<p class="muted" style="margin-top:18px">可核实线索：${esc(c.reference_note)}</p>`:''}<section class="detail-score"><h3>文字初筛评分说明</h3>${scoreSummary(a)}${scoreExplanation(a)}</section><div class="review-block"><h4>对应正向准则与原文依据</h4>${a.standardEvidence.length?a.standardEvidence.map(x=>`<p>${esc(x.label)}</p><blockquote class="evidence-quote">${esc(x.evidence)}</blockquote>`).join(''):'<p>原文尚未找到足够具体的正向行动依据。</p>'}</div>${a.conflicts.length?`<div class="error-box">以下语句存在需核实的负向行为线索，暂不作事实认定：${a.conflicts.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}<div class="review-block"><h4>下一步修改建议</h4><ul>${a.suggestions.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div><div class="detail-actions">${button('copy-case',c.id,'复制完整案例')}${button('advice-image',c.id,'给撰写人 / BP · 修改建议图')}${button('edit',c.id,editable(c)?'修改本篇案例':'BP修改本篇案例')}${state.keys[c.id]?button('copy-edit-link',c.id,'复制修改链接给BP'):''}</div><p class="muted" style="font-size:10px;margin-top:17px">评选以价值观解读、正向行为和实际价值为依据。文本辅助初筛不代替事实核实与最终定奖。</p>`;
  showDialog($('#detail-dialog'));
}
async function editCase(c,token){if(!c)return;let d=drafts.find(x=>x.editId===c.id||x.savedId===c.id);if(!d){d=freshDraft();drafts.unshift(d)}Object.assign(d,{raw:caseText(c),managerReview:c.manager_review||'',referenceNote:c.reference_note||'',wasEdit:true,cycle:c.cycle,editId:c.id,token,savedId:'',error:''});state.cycle=c.cycle;$('#cycle').value=state.cycle;campaign();renderDrafts();$('#detail-dialog').close();changeView('submit');saveDrafts();$('#input-'+d.localId).focus();}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制，可直接粘贴分享。')}catch{const a=document.createElement('textarea');a.value=text;a.style.position='fixed';a.style.opacity='0';document.body.append(a);a.select();const ok=document.execCommand('copy');a.remove();toast(ok?'已复制，可直接粘贴分享。':'复制未成功，请重试。')}}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportCases(selection=false){const data=selection?THEMES.flatMap(t=>recommend(state.cases,t.name,+$('#recommend-limit').value)).map(c=>({...c,assessment:analyze(c)})):filteredCases().map(c=>({...c,assessment:analyze(c)}));if(!data.length){toast('当前没有可导出的案例。');return}download(`文化案例_${state.cycle}_${selection?'评选参考':'案例库'}.json`,JSON.stringify({month:state.cycle,standard:'用户提供的价值观解读与行为准则',cases:data},null,2),'application/json;charset=utf-8')}
function share(){$('#qr-code').innerHTML=qrSvg(shareLink());showDialog($('#share-dialog'))}
async function init(){
 $('#cycle').value=state.cycle;campaign();$('#store-filter').insertAdjacentHTML('beforeend',STORES.map(store=>`<option>${store}</option>`).join(''));
 const stored=read('culture-drafts-v2',null);drafts=Array.isArray(stored)?stored.filter(d=>!d.savedId).map(d=>freshDraft(d.raw,{...d,error:''})):[];
 if(!drafts.length){const old=read('culture-draft-v1',null);if(old?.body?.trim()||old?.data?.body?.trim()){const c=old.data||{};const raw=[c.store?`店面：${c.store}`:'',c.theme?`推荐主题：${c.theme}`:'',c.nominee?`被推荐人：${c.nominee}`:'',old.body||c.body||''].filter(Boolean).join('\n');drafts=[freshDraft(raw,{...(old.editing?{editId:old.editing.id,token:old.editing.token,cycle:old.editing.cycle}:{}),pending:read('culture-pending-v1',null)})]}}
 if(!drafts.length)drafts=[freshDraft()];renderDrafts();renderLibrary();renderSelection();renderCounts();changeView(requestedView,false);
 await loadCases();
 if(editRequest){try{const rows=await api(`culture_cases_v1?id=eq.${encodeURIComponent(editRequest.id)}&select=${PUBLIC_FIELDS}`);if(rows[0]){state.keys[editRequest.id]=editRequest.token;write('culture-edit-keys-v1',state.keys);await editCase(rows[0],editRequest.token)}else toast('未找到这篇案例，请确认修改链接。')}catch(e){toast(e.message)}}
}
document.addEventListener('click',async event=>{
  const nav=event.target.closest('[data-view]');if(nav){changeView(nav.dataset.view);return}
  const theme=event.target.closest('[data-theme]');if(theme){if(theme.dataset.selection==='true'){state.selectionTheme=theme.dataset.theme;renderSelection()}else{state.theme=theme.dataset.theme;renderLibrary()}return}
  const submit=event.target.closest('[data-submit-draft]');if(submit){await submitDraft(submit.dataset.submitDraft);return}
  const split=event.target.closest('[data-split-draft]');if(split){splitDraft(split.dataset.splitDraft);return}
  const topic=event.target.closest('[data-advice-theme]');if(topic){await showAdvice(recommend(state.cases,topic.dataset.adviceTheme,+$('#recommend-limit').value));return}
  const action=event.target.closest('[data-action]');if(!action)return;const c=state.cases.find(c=>c.id===action.dataset.id)||drafts.find(d=>d.savedId===action.dataset.id)?.savedRecord;switch(action.dataset.action){case'new':changeView('submit');break;case'detail':showDetail(c);break;case'edit':if(c)await requestEdit(c);break;case'advice-image':if(c)await showAdvice([c]);break;case'copy-case':if(c)await copy(caseText(c)+(c.manager_review?.trim()?'\n\n店总评价：\n'+c.manager_review:''));break;case'copy-edit-link':if(c)await copy(modificationLink(c.id,state.keys[c.id]));break}
});
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
$('#submission-list').addEventListener('input',event=>{
 const review=event.target.closest('[data-manager-review]'),input=event.target.closest('[data-draft-input]');if(!review&&!input)return;
 const id=review?.dataset.managerReview||input.dataset.draftInput,d=drafts.find(d=>d.localId===id);if(!d||d.savedId)return;
 if(review)d.managerReview=review.value;else d.raw=input.value;
 d.error='';updateDraftCard(d);saveDrafts();
});
$('#open-store-collection').addEventListener('click',openCollectionImages);
$('#copy-store-feedback').addEventListener('click',()=>copy($('#collection-feedback').value));
$('#copy-collection-image').addEventListener('click',()=>shareCollectionImage(true));
$('#download-collection-image').addEventListener('click',()=>shareCollectionImage(false));
$('#collection-dialog').addEventListener('close',()=>{if($('#collection-dialog').open)return;collectionTicket++;collectionSession=null;if(collectionObjectUrl){URL.revokeObjectURL(collectionObjectUrl);collectionObjectUrl=''}$('#collection-preview').removeAttribute('src')});
$('#case-edit-form').addEventListener('submit',async event=>{
 event.preventDefault();const parsed=parseModificationLink($('#case-edit-link').value);
 if(!parsed){$('#case-edit-error').textContent='请粘贴完整的本篇修改链接。';return;}
 if(parsed.id!==editLinkTarget?.id){$('#case-edit-error').textContent='这条链接对应其他案例，请向提交人核对本篇修改链接。';return;}
 $('#case-edit-dialog').close();await editCase(editLinkTarget,parsed.token);
});
$('#copy-advice-image').addEventListener('click',()=>shareAdviceImage(true));
$('#download-advice-image').addEventListener('click',()=>shareAdviceImage(false));
$('#copy-advice-short').addEventListener('click',()=>{if(adviceSession)void copy(adviceCardText(adviceSession.card))});
$('#advice-prev').addEventListener('click',()=>{if(adviceSession?.index>0)void showAdvice(adviceSession.cases,adviceSession.index-1)});
$('#advice-next').addEventListener('click',()=>{if(adviceSession&&adviceSession.index<adviceSession.cases.length-1)void showAdvice(adviceSession.cases,adviceSession.index+1)});
$('#advice-dialog').addEventListener('close',()=>{if($('#advice-dialog').open)return;adviceTicket++;adviceSession=null;if(adviceObjectUrl){URL.revokeObjectURL(adviceObjectUrl);adviceObjectUrl=''}$('#advice-preview').removeAttribute('src')});
$('#reminder-deadline').addEventListener('change',()=>{const saved=read('culture-reminder-deadlines-v1',{});saved[state.cycle]=$('#reminder-deadline').value;write('culture-reminder-deadlines-v1',saved);renderReminder()});
$('#copy-reminder').addEventListener('click',()=>copy($('#reminder-message').value));
$('#copy-counts-image').addEventListener('click',()=>countsImage(true));
$('#download-counts-image').addEventListener('click',()=>countsImage(false));
$('#add-case').addEventListener('click',addDraft);$('#add-case-bottom').addEventListener('click',addDraft);$('#copy-counts').addEventListener('click',()=>copy(countsText()));
$('#cycle').addEventListener('change',async()=>{if(!$('#cycle').value){$('#cycle').value=state.cycle;return}state.cycle=$('#cycle').value;state.cases=[];state.loaded=false;state.dataRevision++;drafts.filter(d=>!d.savedId&&!d.editId).forEach(d=>d.cycle=state.cycle);campaign();renderLibrary();renderSelection();renderCounts();await loadCases();saveDrafts();});
$('#search').addEventListener('input',renderLibrary);$('#store-filter').addEventListener('change',()=>{state.theme='';$('#search').value='';renderLibrary()});$('#sort').addEventListener('change',renderLibrary);$('#recommend-limit').addEventListener('change',renderSelection);$('#refresh').addEventListener('click',()=>loadCases());$('#share').addEventListener('click',share);$('#copy-link').addEventListener('click',()=>copy(shareLink()));$('#download-qr').addEventListener('click',()=>download('文化案例工作台_二维码.svg',qrSvg(shareLink()),'image/svg+xml'));$('#export').addEventListener('click',()=>exportCases());$('#selection-export').addEventListener('click',()=>exportCases(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadCases({silent:true})});setInterval(()=>{if(!document.hidden&&!state.busy)loadCases({silent:true})},45000);
init();
