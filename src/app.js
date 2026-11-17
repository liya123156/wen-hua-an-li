import {CONFIG} from './config.js';
import {THEMES,STORES,PUBLIC_FIELDS,analyze,recommend,parsePaste,validate,countWords,campaignRange} from './model.js';
import {qrSvg} from './qr.js';
import {inspectSubmission,splitSubmissions,submissionCounts} from './submission.js';
import {reviewMessage} from './review.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const nowMonth=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date()).replace('/','-');
const state={cases:[],cycle:nowMonth,view:'submit',theme:'',selectionTheme:'',access:read('culture-access-v1',''),editing:null,keys:read('culture-edit-keys-v1',{}),busy:false,loading:false,loaded:false,dataRevision:0};
const hash=new URLSearchParams(location.hash.slice(1));
if(hash.get('access'))state.access=hash.get('access');
const editRequest=hash.get('edit')&&hash.get('key')?{id:hash.get('edit'),token:hash.get('key')}:null;
const requestedView=['submit','library','selection','counts'].includes(location.hash.slice(1))?location.hash.slice(1):'submit';
history.replaceState(null,'',location.pathname+'#'+requestedView);
let drafts=[];
let toastTimer,draftTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500)}
function showDialog(el){if(!el.open)el.showModal()}
function shareLink(){return `${CONFIG.siteUrl}/#access=${encodeURIComponent(state.access)}`}
function setStatus(text,offline=false){$('#sync-status').textContent=text;$('.status-dot').classList.toggle('offline',offline)}
function themeOf(name){return THEMES.find(t=>t.name===name)}
function button(action,id,text,extra=''){return `<button class="text-button ${extra}" data-action="${action}" data-id="${esc(id)}">${text}</button>`}
function empty(title,description,action=true){return `<div class="empty-state"><span class="empty-symbol">✧</span><h3>${esc(title)}</h3><p>${esc(description)}</p>${action?'<button class="button secondary" data-action="new">记录第一篇故事 ↗</button>':''}</div>`}
async function api(path,{method='GET',body,token='',access=state.access}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  let response;
  try{response=await fetch(CONFIG.supabaseUrl+'/rest/v1/'+path,{method,headers:{apikey:CONFIG.publishableKey,'Content-Type':'application/json','x-client-info':`${access}.${token}`,...(method==='GET'?{}:{Prefer:'return=representation'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal})}catch(e){throw Error(e.name==='AbortError'?'连接超时，请稍后重试；当前草稿已保留。':'暂时无法连接案例库，请检查网络后重试。')}finally{clearTimeout(timer)}
  if(!response.ok){let data={};try{data=await response.json()}catch{}if(response.status===409)throw Error('相同案例已经提交，请到案例库查看。');if(response.status===401||response.status===403)throw Error('访问或修改凭据无效，请使用负责人分享的专用入口。');if(data.code==='23514')throw Error('请核对必填项、店面、推荐主题和案例内容。');throw Error('保存未成功，请稍后重试；当前草稿已保留。')}
  if(response.status===204)return [];
  return response.json();
}
async function checkAccess(access){return await api('rpc/culture_access_valid_v1',{method:'POST',body:{},access})===true}
async function loadCases({silent=false}={}){
  if(state.loading||!state.access)return;
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
function changeView(view,scroll=true){state.view=view;$$('.page-view').forEach(x=>x.hidden=x.id!==`view-${view}`);$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('#page-name').textContent={submit:'粘贴案例',library:'案例库',selection:'案例评选',counts:'各店提交数量一览表'}[view];history.replaceState(null,'',location.pathname+'#'+view);if(scroll)window.scrollTo({top:0,behavior:'instant'})}
function campaign(){$('#campaign-dates').textContent=state.cycle.replace('-','年')+'月征集';}
function freshDraft(raw='',extra={}){return {localId:crypto.randomUUID(),raw,cycle:state.cycle,error:'',savedId:'',pending:null,...extra}}
function saveDrafts(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>write('culture-drafts-v2',drafts.filter(d=>!d.savedId)),250)}
function draftMarkup(d,index){
  const a=inspectSubmission(d.raw,d.cycle),parts=d.savedId?[]:splitSubmissions(d.raw);
  return `<article class="panel submission-card ${d.savedId?'is-saved':''}" data-draft-id="${d.localId}"><div class="submission-card-heading"><h3>案例 ${String(index+1).padStart(2,'0')}</h3><small>${d.savedId?'已入库':'粘贴原文即可'}</small></div><div class="submission-tags" data-slot="tags">${draftTags(a)}</div><label class="sr-only" for="input-${d.localId}">第${index+1}篇案例</label><textarea id="input-${d.localId}" data-draft-input="${d.localId}" rows="9" maxlength="120000" ${d.savedId?'readonly':''} placeholder="店面：黄浦滨江店&#10;推荐主题：拥抱变化&#10;&#10;在这里粘贴案例全文……&#10;&#10;也可一次粘贴多篇，按提示拆开后逐篇提交。">${esc(d.raw)}</textarea><div class="split-hint" data-slot="split" ${parts.length>1?'':'hidden'}><span>检测到 ${parts.length} 篇案例</span><button class="text-button" data-split-draft="${d.localId}">拆分为多篇 ↗</button></div><div class="error-box" role="alert" data-slot="error" ${d.error?'':'hidden'}>${esc(d.error)}</div><div class="submission-card-footer"><small data-slot="hint">${d.savedId?'已保存到案例库':d.raw.trim()?`${a.chars}字 · ${a.ok?'店面与主题已明确':a.errors[0]||'请补充原文'}`:'请在原文中写清店面和推荐主题'}</small><div>${d.savedId?`<span class="saved-label">已入库 ✓</span> ${button('detail',d.savedId,'查看案例 ↗')}`:`<button class="button primary" data-submit-draft="${d.localId}" ${!a.ok||state.busy?'disabled':''}>${d.editId?'保存修改':'提交本篇'} ↗</button>`}</div></div></article>`;
}
function draftTags(a){return `<span class="detected-tag ${a.store?'':'missing'}">${esc(a.store||'需写清店面')}</span><span class="detected-tag ${a.theme?'':'missing'}">${esc(a.theme||'需写清推荐主题')}</span>`}
function renderDrafts(){$('#submission-list').innerHTML=drafts.map(draftMarkup).join('');}
function updateDraftCard(d){const el=$(`[data-draft-id="${d.localId}"]`);if(!el)return;const a=inspectSubmission(d.raw,d.cycle),parts=splitSubmissions(d.raw);el.querySelector('[data-slot="tags"]').innerHTML=draftTags(a);el.querySelector('[data-slot="hint"]').textContent=d.raw.trim()?`${a.chars}字 · ${a.ok?'店面与主题已明确':a.errors[0]||'请补充原文'}`:'请在原文中写清店面和推荐主题';const split=el.querySelector('[data-slot="split"]');split.hidden=parts.length<2;split.querySelector('span').textContent=`检测到 ${parts.length} 篇案例`;const submit=el.querySelector('[data-submit-draft]');if(submit)submit.disabled=!a.ok||state.busy;const error=el.querySelector('[data-slot="error"]');error.hidden=!d.error;error.textContent=d.error;}
function addDraft(){const d=freshDraft();drafts.push(d);renderDrafts();saveDrafts();$('#input-'+d.localId).focus();}
function splitDraft(localId){const index=drafts.findIndex(d=>d.localId===localId),d=drafts[index];if(!d||d.savedId||d.editId)return;const parts=splitSubmissions(d.raw);if(parts.length<2)return;drafts.splice(index,1,...parts.map(raw=>freshDraft(raw,{cycle:d.cycle})));renderDrafts();saveDrafts();toast(`已拆成${parts.length}篇，请分别点击“提交本篇”。`);}
async function digest(token){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(n=>n.toString(16).padStart(2,'0')).join('')}
function randomToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('')}
function modificationLink(id,token){return `${CONFIG.siteUrl}/#access=${encodeURIComponent(state.access)}&edit=${encodeURIComponent(id)}&key=${encodeURIComponent(token)}`}
async function submitDraft(localId){
 const d=drafts.find(x=>x.localId===localId);if(!d||d.savedId||state.busy)return;const a=inspectSubmission(d.raw,d.cycle);if(!a.ok){d.error=a.errors.join(' ');updateDraftCard(d);return}if(!state.access){showDialog($('#access-dialog'));return}
 const data=a.payload;state.busy=true;d.error='';$$('[data-submit-draft]').forEach(b=>b.disabled=true);const current=$(`[data-submit-draft="${d.localId}"]`);if(current)current.textContent='正在保存…';
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
  state.keys[id]=token;write('culture-edit-keys-v1',state.keys);d.savedId=id;d.savedRecord=saved[0];d.pending=null;d.editId='';state.dataRevision++;
  if(saved[0].cycle===state.cycle){state.cases=[saved[0],...state.cases.filter(c=>c.id!==id)];state.loaded=true;renderLibrary();renderSelection();renderCounts();}
  if(!drafts.some(x=>!x.savedId&&!x.raw.trim()))drafts.push(freshDraft());
  saveDrafts();toast('本篇已入库，可以继续提交下一篇。');void loadCases({silent:true});
 }catch(e){d.error=e.message;saveDrafts();}
 finally{state.busy=false;renderDrafts();}
}
function filteredCases(){const q=$('#search').value.trim().toLowerCase(),store=$('#store-filter').value;return state.cases.filter(c=>(!state.theme||c.theme===state.theme)&&(!store||c.store===store)&&(!q||`${c.title} ${c.body} ${c.nominee} ${c.author} ${c.store}`.toLowerCase().includes(q))).sort((a,b)=>$('#sort').value==='quality'?analyze(b).total-analyze(a).total:(b.created_at||'').localeCompare(a.created_at||''))}
function card(c){const t=themeOf(c.theme),a=analyze(c),date=(c.event_on||c.created_at?.slice(0,10)||'').replaceAll('-','.');return `<article class="panel case-card"><div class="case-card-top"><span class="theme-badge">${esc(t?.mark)} ${esc(c.theme)}</span><small>${esc(date)}</small></div><h3>${esc(c.title)}</h3><div class="case-meta"><span>${esc(c.nominee)}</span><span>·</span><span>${esc(c.store)}</span>${c.team?`<span>· ${esc(c.team)}</span>`:''}</div><p class="case-excerpt">${esc(c.body)}</p><div class="card-bottom"><span class="score-mini"><b>${a.total}</b> 文本参考分</span>${button('detail',c.id,'查看故事 ↗')}</div></article>`}
function renderThemeFilter(selector,selection=false){const active=selection?state.selectionTheme:state.theme;$(selector).innerHTML=[{name:'',mark:'全部主题'},...THEMES].map(t=>`<button class="filter-chip ${active===t.name?'active':''}" data-theme="${esc(t.name)}" data-selection="${selection}">${t.name?`${t.mark} ${t.name}`:t.mark}</button>`).join('')}
function renderLibrary(){
  const total=state.cases.length,covered=new Set(state.cases.map(c=>c.store)).size,qualified=state.cases.filter(c=>analyze(c).eligible).length;
  $('#stats').innerHTML=[['已收集案例',total,'篇'],['已覆盖门店',covered,'/ 21店'],['进入初筛推荐池',qualified,'篇'],['待完善案例',total-qualified,'篇']].map(([label,n,unit])=>`<article class="stat-card"><span>${label}</span><strong>${n}<small>${unit}</small></strong></article>`).join('');
  const rows=filteredCases();$('#list-count').textContent=`${state.cycle.replace('-','年')}月 · 共${rows.length}篇案例`;
  $('#case-grid').innerHTML=rows.length?rows.map(card).join(''):state.cases.length?empty('还没有符合筛选条件的案例','调整价值观、门店或搜索关键词，再看看其他故事。',false):empty('故事从你的发现开始','本月暂未收到案例。推荐身边的优秀伙伴，让好行为被更多人看见。');renderThemeFilter('#theme-filter');

}
function renderCounts(){
 const {rows,totals,grandTotal}=submissionCounts(state.cases,state.cycle),ready=state.loaded;
 $('#counts-caption').innerHTML=`<span>${esc(state.cycle.replace('-','年'))}月 · 21家门店 · 7个主题</span><span>${ready?'合计 '+grandTotal+' 篇':'请使用专用入口读取提交数量'}</span>`;
 $('#counts-table thead').innerHTML='<tr><th scope="col">店面</th>'+THEMES.map(t=>`<th scope="col">${t.name}</th>`).join('')+'<th scope="col">合计</th></tr>';
 $('#counts-table tbody').innerHTML=rows.map(r=>'<tr><td>'+esc(r.store)+'</td>'+THEMES.map(t=>`<td class="${r.counts[t.name]?'':'zero'}">${ready?r.counts[t.name]:'—'}</td>`).join('')+`<td>${ready?r.total:'—'}</td></tr>`).join('');
 $('#counts-table tfoot').innerHTML='<tr><td>合计</td>'+THEMES.map(t=>`<td>${ready?totals[t.name]:'—'}</td>`).join('')+`<td>${ready?grandTotal:'—'}</td></tr>`;
 $('#copy-counts').disabled=!ready;
}
function countsText(){const {rows,totals,grandTotal}=submissionCounts(state.cases,state.cycle);return [[state.cycle+' 文化案例提交数量一览表'],['店面',...THEMES.map(t=>t.name),'合计'],...rows.map(r=>[r.store,...THEMES.map(t=>r.counts[t.name]),r.total]),['合计',...THEMES.map(t=>totals[t.name]),grandTotal]].map(row=>row.join('\t')).join('\n');}
function standards(t){return `<details class="panel standard-details"><summary>${esc(t.name)} · 查看正式标准提要及正负向行为</summary><div class="standard-content"><p><b>价值观解读：</b>${esc(t.meaning)}</p><p><b>为什么：</b>${esc(t.value)}</p><div class="standard-columns"><div><h4>正向行为 · 寻找具体行动</h4><ul>${t.yes.map(([v])=>`<li>${esc(v)}</li>`).join('')}</ul></div><div><h4>负向行为 · 核实冲突线索</h4><ul>${t.no.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div></div><p>以上为依据上传文件整理的标准提要。完整表述以<a href="./value-standard.png" target="_blank" rel="noopener">价值观解读与行为准则原图</a>为准。</p></div></details>`}
function recommendationCard(c,i){const a=c.assessment;return `<article class="panel recommend-card"><p class="rank-label">CANDIDATE 0${i+1} · 建议优先复核</p><div class="recommend-head"><h3>${esc(c.title)}</h3><span class="recommend-score">${a.total}<small> / 100</small></span></div><div class="case-meta">${esc(c.nominee)} · ${esc(c.store)}</div><div class="review-block"><h4>为什么推荐</h4><ul>${a.reasons.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div><div class="review-block"><h4>月会视频 · 下一步怎么完善</h4><ul>${a.suggestions.slice(0,3).map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div><div class="card-bottom">${button('detail',c.id,'查看完整案例 ↗')}${button('copy-advice',c.id,'复制给撰写人 / BP')}</div></article>`}
function renderSelection(){
  renderThemeFilter('#selection-theme-filter',true);const limit=+$('#recommend-limit').value;
  $('#selection-results').innerHTML=THEMES.filter(t=>!state.selectionTheme||t.name===state.selectionTheme).map(t=>{
    const all=state.cases.filter(c=>c.theme===t.name),selected=recommend(state.cases,t.name,limit),selectedIds=new Set(selected.map(c=>c.id)),pending=all.filter(c=>!selectedIds.has(c.id));
    return `<section class="selection-group"><div class="selection-group-heading"><h2><span>${t.mark}</span>${t.name}</h2><div><p>收到${all.length}篇 · 视频候选${selected.length}篇</p>${selected.length?`<button class="text-button copy-theme-advice" data-copy-theme="${t.name}">复制本主题修改清单</button>`:''}</div></div>${standards(t)}<div class="selection-cards">${selected.length?selected.map(recommendationCard).join(''):empty(all.length?'本主题暂未推荐候选':'等待这一主题的好故事',all.length?'现有案例还需补充关键行动或实际结果，完善后会重新参与初筛。':'提交真实、具体的文化故事后，这里会生成推荐依据与完善建议。',!all.length)}</div>${pending.length?`<details class="panel pending-list"><summary>其他${pending.length}篇案例 · 查看完善建议</summary>${pending.map(c=>{const a=analyze(c);return `<div class="pending-row"><strong>${esc(c.nominee)} · ${esc(c.store)} · ${a.total}分</strong><p>${esc(a.eligible?'已达到初筛条件，因当前推荐名额暂未列入；仍可由负责人复核比较。':a.suggestions.slice(0,2).join(' '))}</p>${button('detail',c.id,'查看原文与完整建议 ↗')}</div>`}).join('')}</details>`:''}</section>`;
  }).join('');
}
function adviceText(c){return reviewMessage(c)}
function caseText(c){if(inspectSubmission(c.body,c.cycle).ok)return c.body;return [`店面：${c.store}`,`推荐主题：${c.theme}`,c.nominee?`被推荐人：${c.nominee}`:'',c.behavior?`对应文化行为点：${c.behavior}`:'',c.joined_on?`被推荐人入职时间：${c.joined_on}`:'',c.recommender?`推荐人：${c.recommender}`:'',c.author?`撰写人：${c.author}`:'',c.event_on?`事件发生日期：${c.event_on}`:'',`案例标题：${c.title}`,'',c.body].filter(v=>v!==null).join('\n');}
function showDetail(c){
  if(!c)return;const a=analyze(c),t=themeOf(c.theme),info=[['被推荐人',c.nominee],['门店',c.store],['组别',c.team],['入职时间',c.joined_on],['发生日期',c.event_on],['推荐人',c.recommender],['撰写人',c.author]].filter(([,v])=>v);
  $('#detail-content').innerHTML=`<span class="theme-badge">${esc(t?.mark)} ${esc(c.theme)}</span><h2>${esc(c.title)}</h2><div class="detail-info">${info.map(([label,value])=>`<span>${label}：${esc(value)}</span>`).join('')}</div>${c.behavior?`<p class="muted">文化行为点：${esc(c.behavior)}</p>`:''}<div class="detail-body">${esc(c.body)}</div>${c.reference_note?`<p class="muted" style="margin-top:18px">可核实线索：${esc(c.reference_note)}</p>`:''}<div class="score-breakdown">${[['match','文化准则对应',25],['action','具体行动',30],['result','实际价值',25],['learning','可学习性',20]].map(([k,label,max])=>`<div>${label}<b>${a.scores[k]}<small> / ${max}</small></b></div>`).join('')}</div><p class="muted">文本参考分 ${a.total}/100 · ${a.eligible?'达到初筛条件，建议人工复核':'建议补充后再参与推荐'} · 事实待核实</p><div class="review-block"><h4>对应正向准则与原文依据</h4>${a.standardEvidence.length?a.standardEvidence.map(x=>`<p>${esc(x.label)}</p><blockquote class="evidence-quote">${esc(x.evidence)}</blockquote>`).join(''):'<p>原文尚未找到足够具体的正向行动依据。</p>'}</div>${a.conflicts.length?`<div class="error-box">以下语句存在需核实的负向行为线索，暂不作事实认定：${a.conflicts.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}<div class="review-block"><h4>下一步修改建议</h4><ul>${a.suggestions.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div><div class="detail-actions">${button('copy-case',c.id,'复制完整案例')}${button('copy-advice',c.id,'复制给撰写人 / BP')}${state.keys[c.id]?button('edit',c.id,'编辑我的案例 ↗')+button('copy-edit-link',c.id,'保存专属修改链接'):''}</div><p class="muted" style="font-size:10px;margin-top:17px">评选以价值观解读、正向行为和实际价值为依据。文本辅助初筛不代替事实核实与最终定奖。</p>`;
  showDialog($('#detail-dialog'));
}
async function editCase(c,token){if(!c)return;let d=drafts.find(x=>x.editId===c.id||x.savedId===c.id);if(!d){d=freshDraft();drafts.unshift(d)}Object.assign(d,{raw:caseText(c),cycle:c.cycle,editId:c.id,token,savedId:'',error:''});state.cycle=c.cycle;$('#cycle').value=state.cycle;campaign();renderDrafts();$('#detail-dialog').close();changeView('submit');saveDrafts();$('#input-'+d.localId).focus();}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制，可直接粘贴分享。')}catch{const a=document.createElement('textarea');a.value=text;a.style.position='fixed';a.style.opacity='0';document.body.append(a);a.select();const ok=document.execCommand('copy');a.remove();toast(ok?'已复制，可直接粘贴分享。':'复制未成功，请重试。')}}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportCases(selection=false){const data=selection?THEMES.flatMap(t=>recommend(state.cases,t.name,+$('#recommend-limit').value)).map(c=>({...c,assessment:analyze(c)})):filteredCases().map(c=>({...c,assessment:analyze(c)}));if(!data.length){toast('当前没有可导出的案例。');return}download(`文化案例_${state.cycle}_${selection?'评选参考':'案例库'}.json`,JSON.stringify({month:state.cycle,standard:'用户提供的价值观解读与行为准则',cases:data},null,2),'application/json;charset=utf-8')}
function share(){if(!state.access){showDialog($('#access-dialog'));return}$('#qr-code').innerHTML=qrSvg(shareLink());showDialog($('#share-dialog'))}
async function unlock(access){if(!access)throw Error('请粘贴专用链接或访问码。');if(access.includes('#')){try{access=new URLSearchParams(new URL(access).hash.slice(1)).get('access')||''}catch{}}if(!await checkAccess(access))throw Error('访问码无效，请使用负责人分享的内部专用链接。');state.access=access;write('culture-access-v1',access);$('#access-dialog').close();await loadCases();}
async function init(){
 $('#cycle').value=state.cycle;campaign();$('#store-filter').insertAdjacentHTML('beforeend',STORES.map(store=>`<option>${store}</option>`).join(''));
 const stored=read('culture-drafts-v2',null);drafts=Array.isArray(stored)?stored.filter(d=>!d.savedId).map(d=>freshDraft(d.raw,{...d,error:''})):[];
 if(!drafts.length){const old=read('culture-draft-v1',null);if(old?.body?.trim()||old?.data?.body?.trim()){const c=old.data||{};const raw=[c.store?`店面：${c.store}`:'',c.theme?`推荐主题：${c.theme}`:'',c.nominee?`被推荐人：${c.nominee}`:'',old.body||c.body||''].filter(Boolean).join('\n');drafts=[freshDraft(raw,{...(old.editing?{editId:old.editing.id,token:old.editing.token,cycle:old.editing.cycle}:{}),pending:read('culture-pending-v1',null)})]}}
 if(!drafts.length)drafts=[freshDraft()];renderDrafts();renderLibrary();renderSelection();renderCounts();changeView(requestedView,false);
 if(state.access){try{await unlock(state.access)}catch(e){setStatus('请使用内部专用入口',true);$('#access-error').textContent=e.message;showDialog($('#access-dialog'))}}else setStatus('案例内容仅内部专用入口可见',true);
 if(editRequest&&state.access){try{const rows=await api(`culture_cases_v1?id=eq.${encodeURIComponent(editRequest.id)}&select=${PUBLIC_FIELDS}`);if(rows[0]){state.keys[editRequest.id]=editRequest.token;write('culture-edit-keys-v1',state.keys);await editCase(rows[0],editRequest.token)}else toast('未找到这篇案例，请确认修改链接。')}catch(e){toast(e.message)}}
}
document.addEventListener('click',async event=>{
  const nav=event.target.closest('[data-view]');if(nav){changeView(nav.dataset.view);return}
  const theme=event.target.closest('[data-theme]');if(theme){if(theme.dataset.selection==='true'){state.selectionTheme=theme.dataset.theme;renderSelection()}else{state.theme=theme.dataset.theme;renderLibrary()}return}
  const submit=event.target.closest('[data-submit-draft]');if(submit){await submitDraft(submit.dataset.submitDraft);return}
  const split=event.target.closest('[data-split-draft]');if(split){splitDraft(split.dataset.splitDraft);return}
  const topic=event.target.closest('[data-copy-theme]');if(topic){const selected=recommend(state.cases,topic.dataset.copyTheme,+$('#recommend-limit').value);await copy(selected.map((c,i)=>`【候选${i+1}】\n`+reviewMessage(c)).join('\n\n'));return}
  const action=event.target.closest('[data-action]');if(!action)return;const c=state.cases.find(c=>c.id===action.dataset.id)||drafts.find(d=>d.savedId===action.dataset.id)?.savedRecord;switch(action.dataset.action){case'new':changeView('submit');break;case'detail':showDetail(c);break;case'edit':await editCase(c,state.keys[c.id]);break;case'copy-advice':if(c)await copy(adviceText(c));break;case'copy-case':if(c)await copy(caseText(c));break;case'copy-edit-link':if(c)await copy(modificationLink(c.id,state.keys[c.id]));break}
});
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog:not(#access-dialog)').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
$('#access-dialog').addEventListener('cancel',e=>e.preventDefault());
$('#access-back').addEventListener('click',()=>$('#access-dialog').close());
$('#access-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;$('#access-error').textContent='';try{await unlock($('#access-input').value.trim())}catch(err){$('#access-error').textContent=err.message}finally{b.disabled=false}});
$('#submission-list').addEventListener('input',event=>{const input=event.target.closest('[data-draft-input]');if(!input)return;const d=drafts.find(d=>d.localId===input.dataset.draftInput);if(!d||d.savedId)return;d.raw=input.value;d.error='';updateDraftCard(d);saveDrafts();});
$('#add-case').addEventListener('click',addDraft);$('#add-case-bottom').addEventListener('click',addDraft);$('#copy-counts').addEventListener('click',()=>copy(countsText()));
$('#cycle').addEventListener('change',async()=>{if(!$('#cycle').value){$('#cycle').value=state.cycle;return}state.cycle=$('#cycle').value;state.cases=[];state.loaded=false;state.dataRevision++;drafts.filter(d=>!d.savedId&&!d.editId).forEach(d=>d.cycle=state.cycle);campaign();renderLibrary();renderSelection();renderCounts();await loadCases();saveDrafts();});
$('#search').addEventListener('input',renderLibrary);$('#store-filter').addEventListener('change',renderLibrary);$('#sort').addEventListener('change',renderLibrary);$('#recommend-limit').addEventListener('change',renderSelection);$('#refresh').addEventListener('click',()=>loadCases());$('#share').addEventListener('click',share);$('#copy-link').addEventListener('click',()=>copy(shareLink()));$('#download-qr').addEventListener('click',()=>download('文化案例工作台_内部专用二维码.svg',qrSvg(shareLink()),'image/svg+xml'));$('#export').addEventListener('click',()=>exportCases());$('#selection-export').addEventListener('click',()=>exportCases(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.access)loadCases({silent:true})});setInterval(()=>{if(!document.hidden&&state.access&&!state.busy)loadCases({silent:true})},45000);
init();
