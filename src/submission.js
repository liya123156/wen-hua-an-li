import {THEMES,STORES,parsePaste,countWords} from './model.js';
const clean=s=>String(s||'').normalize('NFKC').replace(/\*\*/g,'').replace(/^\s*#{1,6}\s*/,'').replace(/^\s*(?:[-*•]\s*)?/,'').trim();
const linesOf=raw=>String(raw||'').replace(/\r\n?/g,'\n').split('\n');
const storeLabel=/^(?:所属门店|所属店面|门店|店面)\s*[:：]\s*(.*)$/;
const themeLabel=/^(?:推荐主题|文化主题|价值观主题|推荐价值观|价值观|主题)\s*[:：]\s*(.*)$/;
const personLabel=/^(?:被推荐人|主人公|推荐伙伴|标杆人选)\s*[:：]\s*(.*)$/;
function storesIn(text,aliases=false){return STORES.filter(s=>{const v=clean(text).toLowerCase();return v.includes(s.toLowerCase())||(aliases&&s.endsWith('店')&&v.includes(s.slice(0,-1).toLowerCase()))})}
function themesIn(text){return THEMES.filter(t=>clean(text).includes(t.name)).map(t=>t.name)}
const unique=a=>[...new Set(a)];
function dateOrNull(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?value:null}
export function inspectSubmission(raw,cycle){
  const original=String(raw||'').trim(),lines=linesOf(original).map(clean),parsed=parsePaste(original),errors=[];
  const bodyStart=lines.findIndex(s=>/^(?:案例正文|正文|故事正文|事迹内容|案例内容)(?:[（(][^）)]*[）)])?\s*(?:[:：]|$)/.test(s));
  const headers=bodyStart<0?lines:lines.slice(0,bodyStart);
  const explicitStores=headers.map(s=>s.match(storeLabel)?.[1]).filter(v=>v!==undefined);
  const people=headers.map(s=>s.match(personLabel)?.[1]).filter(Boolean);
  let storeCandidates=[];
  if(explicitStores.length){storeCandidates=unique(explicitStores.flatMap(v=>storesIn(v,true)));if(explicitStores.some(v=>storesIn(v,true).length!==1))errors.push('店面未写清楚，请在原文写明一个完整店面名称。')}
  else if(people.length)storeCandidates=unique(people.flatMap(v=>storesIn(v,true)));
  else storeCandidates=unique(storesIn(original));
  if(storeCandidates.length!==1)errors.push(storeCandidates.length?'本篇出现多个店面，请在开头写清“店面：所属门店”。':'请在案例中写清“店面：完整店面名称”。');
  const themeFields=headers.map(s=>s.match(/^(推荐主题|文化主题|价值观主题|推荐价值观|价值观|主题)\s*[:：]\s*(.*)$/)).filter(Boolean);
  const primaryLabel=['推荐主题','文化主题','价值观主题','推荐价值观','价值观','主题'].find(label=>themeFields.some(f=>f[1]===label));
  const explicitThemes=themeFields.filter(f=>f[1]===primaryLabel).map(f=>f[2]);
  let themeCandidates=[];
  if(explicitThemes.length){themeCandidates=unique(explicitThemes.flatMap(themesIn));if(explicitThemes.some(v=>themesIn(v).length!==1))errors.push('推荐主题未写清楚，请从七个主题中写明一个。')}
  else themeCandidates=unique(lines.filter(Boolean).slice(0,2).flatMap(themesIn));
  if(themeCandidates.length!==1)errors.push(themeCandidates.length?'本篇出现多个推荐主题，请明确一个主要主题。':'请在案例中写清“推荐主题：价值观主题”。');
  const narrative=lines.filter(s=>!storeLabel.test(s)&&!themeLabel.test(s)&&! /^(?:被推荐人|主人公|推荐伙伴|标杆人选|对应文化行为点|文化行为点|入职时间|被推荐人入职时间|推荐人|撰写人|提交人|组别|店组|案例标题|标题|事件发生时间|案例发生时间|事件日期|发生日期|发生时间|可核实线索)\s*[:：]/.test(s)).join('\n').trim().replace(/^案例正文[^\n]*[:：]\s*/,'').trim();
  if(!narrative||!narrative.replace(/(?:案例正文|正文|案例[一二三四五六七八九十\d]*|[\s:：—\-【】])/g,''))errors.push('请粘贴案例内容。');
  if(countWords(original)>100000)errors.push('内容过长，请先拆分成多篇案例再逐篇提交。');
  const store=storeCandidates.length===1?storeCandidates[0]:'',theme=themeCandidates.length===1?themeCandidates[0]:'';
  const person=people[0]||'',team=parsed.team||'';
  const nominee=parsed.nominee||person.replace(store,'').replace(team,'').replace(/^[\s·|:：—-]+/,'');
  const payload={cycle,store,theme,title:(parsed.title||`${theme}｜${nominee?nominee+'的文化故事':store+'文化案例'}`).slice(0,160),body:original,nominee:nominee.slice(0,100),team:team.slice(0,100),behavior:(parsed.behavior||'').slice(0,500),joined_on:dateOrNull(parsed.joined_on),event_on:dateOrNull(parsed.event_on),recommender:(parsed.recommender||'').slice(0,100),author:(parsed.author||'').slice(0,100),reference_note:''};
  return {ok:errors.length===0,store,theme,payload,errors:unique(errors),chars:countWords(original)};
}
export function splitSubmissions(raw){
  const text=String(raw||'').replace(/\r\n?/g,'\n').trim();if(!text)return [''];
  // A paste box is one case. Only explicit, increasing case numbers may offer
  // a user-confirmed split; repeated metadata and dividers are never boundaries.
  const lines=linesOf(text),markers=[];
  const ordinal=value=>{if(/^\d+$/.test(value))return Number(value);const digits={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,零:0,〇:0};let total=0,n=0;for(const c of value){if(c==='十'||c==='百'){total+=(n||1)*(c==='十'?10:100);n=0}else n=digits[c]??0}return total+n;};
  for(let i=0;i<lines.length;i++){
    const m=clean(lines[i]).match(/^(?:【\s*)?(?:案例\s*([一二三四五六七八九十百零〇\d]+)|第\s*([一二三四五六七八九十百零〇\d]+)\s*篇(?:案例)?)(?:\s*】)?\s*(?:[：:、.．|｜—-]\s*.*)?$/);
    if(m)markers.push({index:i,number:ordinal(m[1]||m[2])});
  }
  if(markers.length<2||markers.some((m,i)=>m.number<1||(i>0&&m.number<=markers[i-1].number)))return [text];
  const starts=[0,...markers.slice(1).map(m=>m.index)];
  return starts.map((start,i)=>lines.slice(start,starts[i+1]??lines.length).join('\n').trim()).filter(Boolean);
}
export function submissionCounts(cases,cycle){
  const rows=STORES.map(store=>({store,counts:Object.fromEntries(THEMES.map(t=>[t.name,0])),total:0}));
  const byStore=new Map(rows.map(r=>[r.store,r])),totals=Object.fromEntries(THEMES.map(t=>[t.name,0])),seen=new Set();let grandTotal=0;
  for(const c of cases){if(cycle&&c.cycle!==cycle)continue;if(c.id&&seen.has(c.id))continue;if(c.id)seen.add(c.id);const row=byStore.get(c.store);if(!row||!(c.theme in row.counts))continue;row.counts[c.theme]++;row.total++;totals[c.theme]++;grandTotal++}
  return {rows,totals,grandTotal};
}
