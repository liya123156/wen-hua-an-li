import {THEMES,SCORE_DIMENSIONS,analyze} from './model.js';
import {wrapText} from './advice-image.js';
import {encodeRgbaPng} from './long-image.js';

export function collectionPerson(c){
  if(c.nominee?.trim())return c.nominee.trim();
  const text=String(c.body||'').replace(/\r\n?/g,'\n').replace(/\*\*/g,'').trim(),candidates=[];
  const record=value=>{
    const name=value.replace(c.store||'\0','').replace(/^[\s·|：:—-]+/,'').replace(/^[A-Za-zＡ-Ｚａ-ｚ]组\s*/,'').replace(/[。！!]+$/,'').trim();
    if(/^[\p{Script=Han}A-Za-z·\s]{2,20}$/u.test(name))candidates.push(name);
  };
  for(const match of text.matchAll(/^\s*(?:被推荐人|主人翁|主人公)\s*[:：]\s*([^\n]+)$/gm))record(match[1]);
  for(const match of text.matchAll(/^([\p{Script=Han}A-Za-z· ]{2,20})\s*[|｜]\s*(?:感恩利他|诚信求真|顾客至上|尊重伙伴|协作共创|拥抱变化|专业卓越)标兵/gmu))record(match[1]);
  for(const match of text.matchAll(/(?:他|她|他们|她们)就是[^\n]*?组\s*([\p{Script=Han}A-Za-z· ]{2,20})[。！!]?\s*$/gmu))record(match[1]);
  const names=[...new Set(candidates)];return names.length===1?names[0]:'';
}
export function storeCollection(cases,store,cycle){
  const seen=new Set();
  const entries=cases.filter(c=>c.store===store&&c.cycle===cycle).filter(c=>{if(c.id&&seen.has(c.id))return false;if(c.id)seen.add(c.id);return true;})
    .map(c=>({...c,assessment:analyze(c)})).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')||String(a.id||'').localeCompare(String(b.id||'')));
  const themes=THEMES.map(t=>({name:t.name,count:entries.filter(c=>c.theme===t.name).length})).filter(t=>t.count);
  const qualified=entries.filter(c=>c.assessment.eligible);
  const recommended=[...qualified].sort((a,b)=>(b.assessment.total+b.assessment.manager.priority)-(a.assessment.total+a.assessment.manager.priority)).slice(0,2);
  const checks=[
    {label:'主人公与个人贡献',test:c=>!collectionPerson(c)},
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
  const award='全司月会获奖情况：【BP手动补充：有/无；获奖伙伴＋文化主题】';
  if(!report.total)return `店总好～🌱\n\n同步${month}【${report.store}】文化案例收集情况，供本店启动大会文化嘉奖筹备参考。\n\n目前工作台暂未收到本店案例，距离每店3篇的征集目标还差3篇。\n文化主题及主人翁：待补充。\n\n${award}\n\n辛苦您和经理一起回顾本月顾客服务、伙伴成长及团队协作中的真实行动，发现值得嘉奖的伙伴。BP会协助梳理素材，让伙伴的认真付出被看见💜`;
  const people=report.themes.map(t=>t.name+'：'+report.entries.filter(c=>c.theme===t.name).map(c=>collectionPerson(c)||'主人翁待补充').join('、')).join('\n');
  const focus=report.focus.length?'案例完善方面，接下来重点补充'+report.focus.map(x=>x.label).join('、')+'。\n\n':'';
  return `店总好～🌱\n\n${month}【${report.store}】文化案例已整理成门店集锦，供本店启动大会文化嘉奖使用。\n\n本月共收集${report.total}篇，覆盖${report.themes.length}个文化主题，${report.shortfall?'距离每店3篇目标还差'+report.shortfall+'篇':'已达到每店至少3篇的征集目标'}。\n\n文化主题：主人翁\n${people}\n\n${award}\n\n完整案例、每篇评分及店总评价详见集锦。评分仅作文字初筛参考，辛苦您结合伙伴的真实行动、文化代表性和实际贡献，确定本店启动大会文化嘉奖人选。\n\n${focus}希望通过这次嘉奖，让伙伴的优秀被认可，也让值得学习的好行为在店面持续传递💜`;
}

export const COLLECTION_IMAGE={cardWidth:920,top:188,bottom:92,margin:48,gap:28,padding:32};
const fontFamily='"PingFang SC", "Microsoft YaHei", sans-serif';
const themesText=report=>report.themes.map(t=>t.name+' '+t.count+'篇').join('  ·  ')||'本月尚未收到案例';
function textBlock(width,measureText){
  const units=[];
  const add=(text,{size=29,weight=500,color='#54425f',gap=0,tag='',caseId='',lineHeight=Math.ceil(size*1.6)}={})=>{
    const lines=wrapText(String(text??'').replace(/\r\n?/g,'\n'),width,s=>measureText(s,size,weight));
    lines.forEach((line,i)=>units.push({text:line,size,weight,color,lineHeight,gap:i===0?gap:0,tag,caseId}));
  };
  return {add,units};
}
export function collectionLayout(report,measureText,{columns='auto'}={}){
  const {cardWidth,top,bottom,margin,gap,padding}=COLLECTION_IMAGE;
  const blocks=report.entries.map((c,index)=>{
    const id=c.id||String(index),block=textBlock(cardWidth-padding*2,measureText),add=(text,options={})=>block.add(text,{...options,caseId:id});
    add(`案例 ${index+1}  ·  ${c.theme}`,{size:25,weight:650,color:'#9571a5',tag:'case-number'});
    add(c.title||'文化案例',{size:34,weight:700,color:'#73508b',gap:12,tag:'case-heading'});
    add(collectionPerson(c)||'主人公待补充',{size:28,weight:600,gap:8});
    add(`文字初筛参考分：${c.assessment.total} / 100分`,{size:31,weight:650,gap:14});
    add(SCORE_DIMENSIONS.map(d=>`${d.label} ${c.assessment.scores[d.key]}/${d.max}`).join('  ·  '),{size:25,color:'#866b98',gap:8});
    add('案例完整原文',{size:28,weight:650,gap:20});
    add(c.body||'',{size:30,lineHeight:48,gap:10,tag:'body'});
    if(c.manager_review?.trim()){
      add('店总评价',{size:28,weight:650,color:'#a26683',gap:24});
      add(c.manager_review,{size:28,tag:'manager'});
    }
    return {id,units:block.units,height:padding*2+block.units.reduce((n,u)=>n+u.lineHeight+u.gap,0)};
  });
  function arrange(count){
    const width=margin*2+count*cardWidth+(count-1)*gap,summary=textBlock(width-margin*2-padding*2,measureText);
    summary.add('本月收集结论',{size:34,weight:700,color:'#76518c'});
    summary.add(`已收集 ${report.total} 篇  ·  主题覆盖 ${report.themes.length} / 7  ·  文字初筛可复核 ${report.qualified} 篇  ·  待补充 ${report.pending} 篇`,{size:30,weight:600,gap:12});
    summary.add(themesText(report),{size:27,gap:8,color:'#856792'});
    summary.add(report.shortfall?`每店征集目标3篇，目前还差${report.shortfall}篇。`:'已达到每店至少3篇的征集目标。',{size:27,gap:7});
    if(report.focus.length)summary.add('重点完善：'+report.focus.map(x=>x.label).join('、')+'。',{size:27,gap:8});
    summary.add('评分供文字初筛与内容完善参考；事实与最终推荐由店总、负责人复核。',{size:25,color:'#8a7297',gap:10});
    const items=[],cards=[],heights=Array(count).fill(0);let y=top+padding;
    for(const unit of summary.units){y+=unit.gap;items.push({...unit,x:margin+padding,y});y+=unit.lineHeight;}
    const summaryHeight=y-top+padding,casesTop=top+summaryHeight+gap;
    for(const block of blocks){
      const col=heights.indexOf(Math.min(...heights)),x=margin+col*(cardWidth+gap),cardY=casesTop+heights[col];
      cards.push({x,y:cardY,width:cardWidth,height:block.height,caseId:block.id,column:col});
      y=cardY+padding;
      for(const unit of block.units){y+=unit.gap;items.push({...unit,x:x+padding,y});y+=unit.lineHeight;}
      heights[col]+=block.height+gap;
    }
    const height=Math.ceil((casesTop+Math.max(0,...heights)-gap+bottom)/20)*20;
    return {items,cards,width,height:Math.max(640,height),columns:count,summary:{x:margin,y:top,width:width-margin*2,height:summaryHeight}};
  }
  const maxColumns=Math.max(1,Math.min(4,blocks.length));
  if(columns!=='auto')return arrange(Math.max(1,Math.min(maxColumns,Number(columns)||1)));
  // Choose a compact portrait or landscape board without reducing body text.
  const candidates=Array.from({length:maxColumns-Math.min(2,maxColumns)+1},(_,i)=>arrange(i+Math.min(2,maxColumns)));
  return candidates.sort((a,b)=>Math.abs(Math.log(a.height/a.width/1.25))-Math.abs(Math.log(b.height/b.width/1.25))||a.columns-b.columns)[0];
}
function rounded(ctx,x,y,w,h,r,color,stroke=''){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function draw(ctx,text,x,y,size,weight,color){ctx.font=`${weight} ${size}px ${fontFamily}`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText(text,x,y);}
export async function renderCollectionImage(report,options={}){
  await document.fonts?.ready;
  const probe=document.createElement('canvas').getContext('2d');
  const layout=collectionLayout(report,(text,size,weight)=>{probe.font=`${weight} ${size}px ${fontFamily}`;return probe.measureText(text).width;},options);
  const scale=1.5,width=layout.width,height=layout.height,canvas=document.createElement('canvas');
  canvas.width=width*scale;
  const paint=(top,rows)=>{
      canvas.height=rows;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(0,-top/scale);
      const visible=(y,h)=>(y+h)*scale>top&&y*scale<top+rows;
      ctx.fillStyle='#f8f2fc';ctx.fillRect(0,0,width,height);
      rounded(ctx,48,38,width-96,126,22,'#eee1f7');
      draw(ctx,report.store+' · 文化案例集锦',80,57,40,700,'#6b487f');
      draw(ctx,report.cycle.replace('-','年')+'月 · 本店全部'+report.total+'篇 · '+layout.columns+'列排版 · 一张完整集锦',80,114,26,550,'#866597');
      draw(ctx,'♡',width-120,74,48,600,'#ca91ae');
      const summary=layout.summary;
      if(visible(summary.y,summary.height))rounded(ctx,summary.x,summary.y,summary.width,summary.height,22,'#fff','#e8dcee');
      for(const card of layout.cards)if(visible(card.y,card.height)){
        rounded(ctx,card.x,card.y,card.width,card.height,22,'#fff','#e3d4ed');
        rounded(ctx,card.x+32,card.y+17,68,5,2,'#cfabd9');
      }
      layout.items.filter(item=>visible(item.y,item.lineHeight)).forEach(item=>draw(ctx,item.text,item.x,item.y,item.size,item.weight,item.color));
      draw(ctx,'丽兹行 · 上海  |  全店案例完整原文、评分与店总评价',74,height-58,23,500,'#977ea4');
      return ctx;
  };
  if(typeof CompressionStream==='function')return encodeRgbaPng(width*scale,height*scale,(top,rows)=>paint(top,rows).getImageData(0,0,canvas.width,rows).data);
  paint(0,height*scale);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('集锦生成未完成，请使用电脑端Chrome或Edge重试。')),'image/png'));
}
