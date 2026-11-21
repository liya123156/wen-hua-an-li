import {THEMES,SCORE_DIMENSIONS,analyze} from './model.js';
import {wrapText} from './advice-image.js';

export function storeCollection(cases,store,cycle){
  const seen=new Set();
  const entries=cases.filter(c=>c.store===store&&c.cycle===cycle).filter(c=>{if(c.id&&seen.has(c.id))return false;if(c.id)seen.add(c.id);return true;})
    .map(c=>({...c,assessment:analyze(c)})).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')||String(a.id||'').localeCompare(String(b.id||'')));
  const themes=THEMES.map(t=>({name:t.name,count:entries.filter(c=>c.theme===t.name).length})).filter(t=>t.count);
  const qualified=entries.filter(c=>c.assessment.eligible);
  const recommended=[...qualified].sort((a,b)=>(b.assessment.total+b.assessment.manager.priority)-(a.assessment.total+a.assessment.manager.priority)).slice(0,2);
  const checks=[
    {label:'主人公与个人贡献',test:c=>!c.nominee?.trim()},
    {label:'事件时间与背景',test:c=>!c.event_on||!c.assessment.video.context},
    {label:'关键行动与选择',test:c=>c.assessment.actionEvidence.length<2||!c.assessment.video.choice},
    {label:'实际结果与反馈',test:c=>!c.assessment.resultEvidence.length},
    {label:'事实或贡献归属核实',test:c=>!!c.assessment.conflicts.length||c.assessment.manager.needsVerification}
  ];
  const focus=checks.map(item=>({label:item.label,count:entries.filter(item.test).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,3);
  return {store,cycle,entries,themes,total:entries.length,qualified:qualified.length,pending:entries.length-qualified.length,shortfall:Math.max(0,3-entries.length),recommended,focus};
}
export function storeFeedback(report){
  const month=report.cycle.replace('-','年')+'月';
  const themes=report.themes.map(t=>t.name+t.count+'篇').join('、');
  if(!report.total)return `店总好～🌱\n\n同步${month}【${report.store}】文化案例收集情况：目前工作台暂未收到本店案例，距离每店3篇的征集目标还差3篇。\n\n辛苦您和经理一起回顾本月顾客服务、伙伴成长及团队协作中的真实行动，确定值得推荐的伙伴，邀请知情伙伴补充场景、具体行动和结果反馈，再由撰写人完成记录。BP也会协助梳理素材。\n\n希望把伙伴的认真付出记录下来，让值得学习的好行为被更多人看见💜`;
  const candidates=report.recommended.length
    ?'建议您优先复核：'+report.recommended.map(c=>`${c.nominee||c.title}（${c.theme}，文字初筛${c.assessment.total}/100分）`).join('、')+'。'
    :'目前暂无达到文字初筛条件的视频候选，建议先补实故事内容，再重新比较推荐。';
  const focus=report.focus.length?'接下来建议重点完善'+report.focus.map(x=>x.label).join('、')+'。':'接下来建议核实关键行动、人物贡献及反馈来源，完善月会视频的采访与素材准备。';
  return `店总好～🌱\n\n同步${month}【${report.store}】文化案例收集结论：\n\n本月共收集${report.total}篇，覆盖${report.themes.length}个文化主题，${report.shortfall?'距离每店3篇目标还差'+report.shortfall+'篇':'已达到每店至少3篇的征集目标'}。\n主题分布：${themes}。\n\n从现有文字看，${report.qualified}篇可进入优先复核，${report.pending}篇还需进一步补充后再比较。\n${candidates}\n\n${focus}\n\n完整原文、每篇评分及店总评价已整理成门店集锦，供您一起查看。评分仅作文字初筛参考，辛苦您结合事实和文化代表性，确定本店最推荐的2篇；如符合质量要求的案例不足2篇，可先完善、保留空缺，并在「店总评价」中注明推荐理由。BP会继续协助撰写人把故事补充完整。\n\n让伙伴的优秀被认可，也让好做法有机会在月会上被更多人学习💜`;
}

export const COLLECTION_PAGE={width:1080,maxHeight:4000,top:176,bottom:92,margin:54};
const fontFamily='"PingFang SC", "Microsoft YaHei", sans-serif';
const themesText=report=>report.themes.map(t=>t.name+' '+t.count+'篇').join('  ·  ')||'本月尚未收到案例';
export function collectionPages(report,measureText){
  const {width,maxHeight,top,bottom,margin}=COLLECTION_PAGE,content=width-margin*2,units=[];
  const add=(text,{size=29,weight=500,color='#54425f',gap=0,tag='',caseId='',lineHeight=Math.ceil(size*1.7)}={})=>{
    const lines=wrapText(String(text??'').replace(/\r\n?/g,'\n'),content-40,s=>measureText(s,size,weight));
    lines.forEach((line,i)=>units.push({text:line,size,weight,color,lineHeight,gap:i===0?gap:0,tag,caseId}));
  };
  add('本月收集结论',{size:34,weight:700,gap:6,color:'#76518c'});
  add(`已收集 ${report.total} 篇  ·  主题覆盖 ${report.themes.length} / 7`,{size:32,weight:650,gap:14});
  add(`文字初筛可复核 ${report.qualified} 篇  ·  待补充 ${report.pending} 篇`,{size:29,gap:5});
  add(themesText(report),{size:27,gap:9,color:'#856792'});
  add(report.shortfall?`每店征集目标3篇，目前还差${report.shortfall}篇。`:'已达到每店至少3篇的征集目标。',{size:27,gap:8});
  add('评分供文字初筛与内容完善参考；事实与最终推荐由店总、负责人复核。',{size:25,color:'#8a7297',gap:12});
  report.entries.forEach(c=>{
    const id=c.id||String(report.entries.indexOf(c));
    add(c.title||'文化案例',{size:34,weight:700,color:'#73508b',gap:32,tag:'case-heading',caseId:id});
    add(`${c.nominee||'主人公待补充'}  ·  ${c.theme}`,{size:28,weight:600,gap:7,caseId:id});
    add(`文字初筛参考分：${c.assessment.total} / 100分`,{size:31,weight:650,gap:7,caseId:id});
    add(SCORE_DIMENSIONS.map(d=>`${d.label} ${c.assessment.scores[d.key]}/${d.max}`).join('  ·  '),{size:25,color:'#866b98',gap:6,caseId:id});
    add('案例完整原文',{size:28,weight:650,gap:15,caseId:id});
    add(c.body||'',{size:30,lineHeight:50,gap:8,tag:'body',caseId:id});
    if(c.manager_review?.trim()){
      add('店总评价',{size:28,weight:650,color:'#a26683',gap:19,caseId:id});
      add(c.manager_review,{size:28,tag:'manager',caseId:id});
    }
  });
  const pages=[],byId=new Map(report.entries.map((c,i)=>[c.id||String(i),c]));let page={items:[],height:0},y=top;
  function flush(){page.height=Math.max(640,Math.min(maxHeight,Math.ceil((y+bottom)/20)*20));pages.push(page);page={items:[],height:0};y=top;}
  for(const unit of units){
    const nextHeight=unit.lineHeight+unit.gap;
    // Keep a case heading with at least the first metadata line.
    if(page.items.length&&y+nextHeight+(unit.tag==='case-heading'?80:0)>maxHeight-bottom){
      flush();
      if(unit.caseId&&unit.tag!=='case-heading'){
        const c=byId.get(unit.caseId);
        const label=wrapText((c?.title||'文化案例')+'（续）',content-40,s=>measureText(s,29,650));
        for(const text of label){page.items.push({text,size:29,weight:650,color:'#76518c',lineHeight:48,x:margin+20,y,tag:'continuation',caseId:unit.caseId});y+=48;}
        y+=12;
      }
    }
    y+=unit.gap;page.items.push({...unit,x:margin+20,y});y+=unit.lineHeight;
  }
  if(page.items.length)flush();
  return pages;
}
function rounded(ctx,x,y,w,h,r,color){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();}
function draw(ctx,text,x,y,size,weight,color){ctx.font=`${weight} ${size}px ${fontFamily}`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText(text,x,y);}
export async function renderCollectionImages(report){
  await document.fonts?.ready;
  const probe=document.createElement('canvas').getContext('2d');
  const pages=collectionPages(report,(text,size,weight)=>{probe.font=`${weight} ${size}px ${fontFamily}`;return probe.measureText(text).width;});
  return {
    total:pages.length,
    async render(index){
      const page=pages[index];if(!page)throw Error('未找到该页集锦。');
      const scale=1.5,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),width=COLLECTION_PAGE.width;
      canvas.width=width*scale;canvas.height=page.height*scale;ctx.scale(scale,scale);
      ctx.fillStyle='#f8f2fc';ctx.fillRect(0,0,width,page.height);
      rounded(ctx,20,20,width-40,page.height-40,27,'#fff');
      rounded(ctx,54,43,width-108,112,18,'#f0e5f8');
      draw(ctx,report.store+' · 文化案例集锦',76,60,32,700,'#6b487f');
      draw(ctx,report.cycle.replace('-','年')+'月 · 全部'+report.total+'篇 · 第'+(index+1)+'/'+pages.length+'张',76,111,24,550,'#866597');
      draw(ctx,'♡',width-112,75,43,600,'#ca91ae');
      page.items.forEach(item=>draw(ctx,item.text,item.x,item.y,item.size,item.weight,item.color));
      draw(ctx,'丽兹行 · 上海  |  完整原文与文字初筛评分',74,page.height-58,23,500,'#977ea4');
      return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('集锦图片生成失败，请重试。')),'image/png'));
    }
  };
}
