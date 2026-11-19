import {STANDARDS} from './standards.js';
export const THEMES = [
  {name:'感恩利他',mark:'♡',hint:'主动帮助、真诚感谢、经验分享',words:['帮助','感谢','分享','利他','感恩','主动承担','无偿','回馈','支持','付出'],actions:['帮助','分享','感谢','承担','回馈','支持']},
  {name:'诚信求真',mark:'◇',hint:'诚实守信、尊重事实、主动纠偏',words:['诚信','事实','核实','纠正','如实','承诺','隐瞒','真实','错误','坦诚','告知','求证'],actions:['核实','纠正','告知','承认','求证','如实','兑现']},
  {name:'顾客至上',mark:'◎',hint:'理解需求、快速响应、专业解决问题',words:['顾客','客户','业主','需求','服务','看房','反馈','响应','解决','信任'],actions:['沟通','联系','协调','整理','解决','安排','核实','陪同','对接','确认','跟进']},
  {name:'尊重伙伴',mark:'⌘',hint:'真诚沟通、认可进步、帮助成长',words:['伙伴','倾听','尊重','成长','认可','沟通','同事','新人','鼓励','辅导'],actions:['倾听','辅导','鼓励','沟通','询问','认可','陪伴','支持','帮助']},
  {name:'协作共创',mark:'✧',hint:'主动补位、跨组协作、共同解决问题',words:['协作','共创','跨店','跨组','共同','配合','补位','团队','合作','分工'],actions:['协调','配合','补位','分工','协作','对接','共同','整理','组织']},
  {name:'拥抱变化',mark:'↗',hint:'积极适应、主动学习、创新实践',words:['变化','学习','尝试','创新','调整','新方法','工具','流程','优化','AI','复盘'],actions:['学习','尝试','调整','优化','实践','搭建','改进','验证','试用']},
  {name:'专业卓越',mark:'✦',hint:'高标准做事、专业精进、持续突破',words:['专业','标准','研究','精进','复盘','细节','反复','突破','方案','核对','测算'],actions:['核对','研究','测算','复盘','验证','梳理','整理','分析','检查','培训']}
].map(t=>({...t,...STANDARDS[t.name]}));
export const STORES = [
  '仁恒河滨城店','碧云店','御翠园店','浦东别墅旗舰店','星河湾店','陆家嘴金融中心店','陆家嘴旗舰店','陆家嘴滨江店','顶级豪宅部',
  '嘉御庭公馆店','尚海湾店','徐汇滨江店','徐汇一店','融创滨江壹号院店','长宁古北店','Hmall中心店','Hmall旗舰店','黄浦滨江店','新天地一店','新天地二店','复兴香园店'
];
export const PUBLIC_FIELDS = 'id,cycle,title,theme,behavior,store,team,nominee,joined_on,recommender,author,event_on,body,reference_note,manager_review,created_at,updated_at';
export const SCORE_DIMENSIONS = [
  {key:'match',label:'文化对应',max:25},
  {key:'action',label:'具体行动',max:30},
  {key:'result',label:'实际价值',max:25},
  {key:'learning',label:'可学习性',max:20}
];
export const countWords = text => [...String(text||'').replace(/\s/g,'')].length;
export const sentences = text => String(text||'').split(/(?<=[。！？；!?\n])/).map(s=>s.trim()).filter(Boolean);
export function campaignRange(cycle){
  const [y,m]=String(cycle).split('-').map(Number);
  if(!y||m<1||m>12) return {start:'',end:''};
  const prev=m===1?[y-1,12]:[y,m-1];
  return {start:`${prev[0]}-${String(prev[1]).padStart(2,'0')}-20`,end:`${y}-${String(m).padStart(2,'0')}-20`};
}
const has = (text,words) => words.some(w=>text.includes(w));
const uniqueHits = (text,words) => words.filter(w=>text.includes(w));
export function managerReference(value){
  const text=String(value||'').trim();
  const needsVerification=/真实性存疑|事实尚未核实|事实未核实|贡献归属存疑/.test(text);
  const negative=/暂不推荐|不予推荐|不推荐|不建议入选|暂缓推荐|待核实/.test(text)||needsVerification;
  const match=text.match(/店总推荐\s*[:：]?\s*([12一二])|本店推荐第\s*([12一二])\s*篇/);
  const rank=negative?0:match?(/[1一]/.test(match[1]||match[2])?1:2):0;
  const priority=negative?0:rank===1?6:rank===2?4:/推荐入选|重点推荐|建议入选|建议优先推荐/.test(text)?2:0;
  return {present:!!text,rank,priority,needsVerification,label:needsVerification?'店总提示需核实':rank?`店总推荐${rank}`:priority?'店总推荐':'店总评价'};
}
export function analyze(c){
  const body=parsePaste(c.body).body||String(c.body||'').trim(), chars=countWords(body), ss=sentences(body), theme=THEMES.find(t=>t.name===c.theme);
  const range=campaignRange(c.cycle);
  const inRange=!!c.event_on&&c.event_on>=range.start&&c.event_on<=range.end;
  const context=ss.find(s=>has(s,['当时','当天','因为','由于','遇到','面对','原本','背景','问题','困难','需求','发现','担心','时间紧','临时','希望']));
  const actionWords=theme?.actions||[];
  const actionEvidence=ss.filter(s=>uniqueHits(s,actionWords).length>0&&countWords(s)>=14);
  const resultEvidence=ss.filter(s=>countWords(s)>=14&&!/[？?]/.test(s)&&has(s,['最终','结果','反馈','因此','成功','解决了','完成了','得以','避免了','提升了','减少了','认可','感谢','顺利','采纳','学会','满意','恢复','节省','获得']));
  const themeHits=uniqueHits(body,theme?.words||[]);
  const standardEvidence=(theme?.yes||[]).map(([label,words])=>({label,evidence:ss.find(s=>countWords(s)>=14&&has(s,words)&&has(s,actionWords))||''})).filter(x=>x.evidence);
  const conflicts=ss.filter(s=>(theme?.flags||[]).some(w=>s.includes(w))&&!has(s,['没有','并未','不再','避免','拒绝这种','纠正','反对','发现','曾经','过去','之前']));
  const specifics=uniqueHits(body,['首先','随后','第二天','当天','逐一','再次','反复','核对','主动','协调','联系','整理','确认','安排','记录','跟进','询问','调整','验证','检查']);
  const diversity=new Set([...body.replace(/[\s\p{P}\p{S}]/gu,'')]).size;
  const repetitive=chars>0 && diversity/Math.min(chars,600)<0.13;
  const scores={
    match:Math.min(25,standardEvidence.length*5+(c.behavior?.trim()?3:0)),
    action:Math.min(30,actionEvidence.length*6+specifics.length*2),
    result:Math.min(25,resultEvidence.length*7+(has(body,['反馈','感谢','采纳','满意'])?4:0)),
    learning:Math.min(20,(context?5:0)+(specifics.length>=3?5:0)+(actionEvidence.length>=2?5:0)+(has(body,['方法','经验','分享','复盘','标准','机制','流程','借鉴','值得学习','推荐'])?5:0))
  };
  let total=Object.values(scores).reduce((a,b)=>a+b,0);
  if(repetitive) total=Math.min(total,35);
  const suggestions=[];
  if(!c.nominee?.trim()) suggestions.push('请在原文补充主人公姓名及其在事件中的具体职责，方便月会视频呈现。');
  if(!context) suggestions.push('补充事件背景：当时遇到了什么具体问题，涉及谁，为什么需要主人公作出这个选择？');
  if(actionEvidence.length<2) suggestions.push(`补充关键行动：围绕“${c.behavior||theme?.hint||c.theme||'文化行为'}”，按发生顺序写出主人公具体怎么做、怎么沟通。`);
  if(!resultEvidence.length) suggestions.push('补充实际结果：问题最后如何处理？请写出顾客或伙伴的真实反馈；没有数字也可写具体变化。');
  if(themeHits.length<2) suggestions.push(`说明“${c.theme||'所选主题'}”的行为依据，结合原事件补充行动和选择；不要只增加价值观词语。`);
  if(!c.behavior?.trim()&&!standardEvidence.length) suggestions.push('结合正向准则，在原文讲清最值得学习的文化行为。');
  if(!c.event_on) suggestions.push('补充事件发生时间，方便核实背景与准备月会采访。');
  else if(!inRange) suggestions.push(`核对事件所属征集月份与发生日期，本期周期为${range.start}至${range.end}。`);
  if(repetitive) suggestions.push('正文存在较多重复表达，请保留真实事件，补足不同的行动细节与结果。');
  if(standardEvidence.length===0) suggestions.push(`请围绕正式准则“${theme?.yes?.[0]?.[0]||'正向文化行为'}”，补充主人公的具体行动与当时选择。`);
  if(conflicts.length) suggestions.push('原文出现与负向行为相关的线索。请核实行为主体、实际经过和后续处理；核实前暂不进入自动推荐。');
  const choice=actionEvidence.find(s=>has(s,['主动','坚持','提出','选择','决定','额外','仍然','没有','并未','即使','为此','放弃']))||'';
  const video={person:!!c.nominee?.trim(),context:context||'',choice,actions:actionEvidence.slice(0,3),outcome:resultEvidence[0]||''};
  video.ready=!!(video.person&&video.context&&video.choice&&video.actions.length>=2&&video.outcome);
  if(!choice) suggestions.push('补充主人公的关键选择与动机：为什么主动这样做、承担了什么，体现哪一条文化准则？');
  const manager=managerReference(c.manager_review);
  if(manager.needsVerification)suggestions.push('店总评价提示事实或贡献归属仍需核实，请先与店总、当事人补清事实，再参与视频候选推荐。');
  const eligible=(!c.event_on||inRange)&&themeHits.length>=2&&standardEvidence.length>=1&&video.ready&&!repetitive&&conflicts.length===0&&!manager.needsVerification&&total>=80;
  if(eligible){
    suggestions.push('向当事人或见证人核实原文所述关键行动、人物贡献和结果反馈，再确认是否进入最终名单。');
    if(!c.reference_note?.trim()) suggestions.push('补充一项可核实线索，例如见证人、反馈来源或业务记录位置。');
    if(scores.learning<15) suggestions.push('精修时提炼一个其他伙伴可以照着实践的方法，说明可借鉴的做法。');
  }
  const action=actionEvidence[0]||'';
  const result=resultEvidence[0]||'';
  const reasons=[];
  if(standardEvidence.length) reasons.push(`对应正向准则：${standardEvidence.map(x=>x.label).slice(0,2).join('；')}`);
  if(action) reasons.push(`行动依据：${action.slice(0,110)}`);
  if(result) reasons.push(`结果依据：${result.slice(0,110)}`);
  if(manager.priority)reasons.push(`店面参考：${manager.label}。在达到内容质量要求的基础上优先复核。`);
  const summary=[context,action,result].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(' ').slice(0,210)||body.slice(0,150);
  return {chars,inRange,scores,total,eligible,repetitive,summary,reasons,suggestions,actionEvidence,resultEvidence,standardEvidence,conflicts,video,manager};
}
export function recommend(cases,theme,limit=3){
  const seen=new Set();
  return cases.filter(c=>c.theme===theme).map(c=>({...c,assessment:analyze(c)}))
    .filter(c=>c.assessment.eligible)
    .sort((a,b)=>(b.assessment.total+b.assessment.manager.priority)-(a.assessment.total+a.assessment.manager.priority)||(a.created_at||'').localeCompare(b.created_at||''))
    .filter(c=>{const k=`${c.store}|${c.nominee}|${c.event_on}|${c.body.replace(/\s/g,'')}`;if(seen.has(k))return false;seen.add(k);return true;})
    .slice(0,Math.min(3,Math.max(1,limit)));
}
export function parsePaste(raw){
  const text=String(raw||'').replace(/\r\n/g,'\n').replace(/\*\*/g,'').trim();
  const pick=labels=>{const re=new RegExp(`^(?:${labels})[：:]\\s*(.+)$`,'m');return text.match(re)?.[1]?.trim()||'';};
  const person=pick('被推荐人|主人公'), theme=pick('推荐主题|文化主题|价值观主题|推荐价值观|价值观|主题');
  const store=STORES.find(s=>(pick('所属门店|所属店面|门店|店面')||person).toLowerCase().includes(s.toLowerCase()))||'';
  const cleanedPerson=person.replace(store,'').replace(/^[\s·：:|—-]+/,'');
  const team=pick('组别|店组')||cleanedPerson.match(/^([A-DＡ-Ｄ]组|[^\s]{1,5}组)/)?.[0]||'';
  const nominee=cleanedPerson.replace(team,'').replace(/^[\s·：:|—-]+/,'');
  const normalizeDate=t=>{const m=t.match(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';};
  const joined_on=normalizeDate(pick('被推荐人入职时间|入职日期|入职时间'));
  const event_on=normalizeDate(pick('事件发生时间|案例发生时间|事件日期|发生日期|发生时间'));
  let body=text;
  const bodyMark=/^案例正文(?:[（(][^\n）)]*[）)])?\s*[：:]?\s*/m;
  if(bodyMark.test(text)) body=text.slice(text.search(bodyMark)).replace(bodyMark,'').trim();
  else body=text.split('\n').filter(line=>! /^(推荐主题|文化主题|价值观主题|推荐价值观|价值观|主题|所属门店|所属店面|对应文化行为点|文化行为点|被推荐人|被推荐人入职时间|入职日期|入职时间|推荐人|撰写人|门店|店面|组别|店组|案例标题|标题|事件发生时间|案例发生时间|事件日期|发生日期|发生时间)[：:]/.test(line)).join('\n').trim();
  return {theme:THEMES.some(t=>t.name===theme)?theme:'',store,team,nominee,joined_on,event_on,behavior:pick('对应文化行为点|文化行为点'),recommender:pick('推荐人'),author:pick('撰写人|提交人'),title:pick('案例标题|标题'),body};
}
export function validate(c){
  const errors=[];
  if(!STORES.includes(c.store))errors.push('请写清一个所属店面');
  if(!THEMES.some(t=>t.name===c.theme))errors.push('请写清一个推荐主题');
  if(!String(c.body||'').trim())errors.push('请粘贴案例内容');
  if(countWords(c.body)>100000)errors.push('请先拆分为多篇案例');
  return errors;
}
