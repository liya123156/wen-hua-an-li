import {THEMES,SCORE_DIMENSIONS,analyze} from './model.js';
import {wrapText} from './advice-image.js';
import {encodeRgbaPng} from './long-image.js';

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

export const COLLECTION_IMAGE={width:1080,top:176,bottom:92,margin:54};
const fontFamily='"PingFang SC", "Microsoft YaHei", sans-serif';
const themesText=report=>report.themes.map(t=>t.name+' '+t.count+'篇').join('  ·  ')||'本月尚未收到案例';
export function collectionLayout(report,measureText){
  const {width,top,bottom,margin}=COLLECTION_IMAGE,content=width-margin*2,units=[];
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
  if(report.focus.length)add('重点完善：'+report.focus.map(x=>x.label).join('、')+'。',{size:27,gap:10});
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
  const items=[];let y=top;
  for(const unit of units){
    y+=unit.gap;items.push({...unit,x:margin+20,y});y+=unit.lineHeight;
  }
  return {items,width,height:Math.max(640,Math.ceil((y+bottom)/20)*20)};
}
function rounded(ctx,x,y,w,h,r,color){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();}
function draw(ctx,text,x,y,size,weight,color){ctx.font=`${weight} ${size}px ${fontFamily}`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText(text,x,y);}
export async function renderCollectionImage(report){
  await document.fonts?.ready;
  const probe=document.createElement('canvas').getContext('2d');
  const layout=collectionLayout(report,(text,size,weight)=>{probe.font=`${weight} ${size}px ${fontFamily}`;return probe.measureText(text).width;});
  const scale=1.5,width=layout.width,height=layout.height,canvas=document.createElement('canvas');
  canvas.width=width*scale;
  const paint=(top,rows)=>{
      canvas.height=rows;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(0,-top/scale);
      ctx.fillStyle='#f8f2fc';ctx.fillRect(0,0,width,height);
      rounded(ctx,20,20,width-40,height-40,27,'#fff');
      rounded(ctx,54,43,width-108,112,18,'#f0e5f8');
      draw(ctx,report.store+' · 文化案例集锦',76,60,32,700,'#6b487f');
      draw(ctx,report.cycle.replace('-','年')+'月 · 本店全部'+report.total+'篇 · 一张完整长图',76,111,24,550,'#866597');
      draw(ctx,'♡',width-112,75,43,600,'#ca91ae');
      layout.items.filter(item=>(item.y+item.lineHeight)*scale>top&&item.y*scale<top+rows).forEach(item=>draw(ctx,item.text,item.x,item.y,item.size,item.weight,item.color));
      draw(ctx,'丽兹行 · 上海  |  全店案例完整原文、评分与店总评价',74,height-58,23,500,'#977ea4');
      return ctx;
  };
  if(typeof CompressionStream==='function')return encodeRgbaPng(width*scale,height*scale,(top,rows)=>paint(top,rows).getImageData(0,0,canvas.width,rows).data);
  paint(0,height*scale);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('长图生成未完成，请使用电脑端Chrome或Edge重试。')),'image/png'));
}
