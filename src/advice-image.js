import {analyze,THEMES} from './model.js';

const compact=value=>String(value||'').replace(/\s+/g,' ').trim();
export function excerpt(value,max=64){const chars=Array.from(compact(value));return chars.length>max?chars.slice(0,max-1).join('')+'…':chars.join('');}
export function buildAdviceCard(c){
  const a=analyze(c),theme=THEMES.find(t=>t.name===c.theme);
  const focus=excerpt(a.standardEvidence[0]?.label||theme?.yes?.[0]?.[0]||c.theme,38);
  const highlight=excerpt(a.actionEvidence[0]||a.video.context||'',60);
  const items=[];
  if(a.conflicts.length||a.manager.needsVerification){
    items.push({title:'先核实事实',text:a.conflicts.length?`请核实“${excerpt(a.conflicts[0],40)}”的主体、经过及后续处理。确认前暂缓推荐。`:'请先与店总、当事人核实评价中提到的事实或贡献归属，再补清原文。'});
  }
  const identity=c.nominee?.trim()?'':'补上主人公姓名与职责；';
  const date=c.event_on?(a.inRange?'保留已写明的发生日期，':'核对发生日期与征集月份；'):'确认事件发生日期；';
  items.push({title:'讲清故事起点',text:identity+date+(a.video.context?'围绕原文场景，突出对方的真实需要及当时最关键的难点。':'补清谁遇到了什么问题、为什么需要主人公出面解决。')});
  items.push({title:'写实关键行动',text:a.actionEvidence.length?`${a.video.choice?'补清当时为什么这样选择；':'补出关键选择与真实想法；'}按顺序写2—3个具体动作，分清本人和其他伙伴的贡献。`:'按顺序补2—3个具体动作：本人做了什么、如何沟通、为什么这样选择；用事实体现文化。'});
  items.push({title:'补实结果与反馈',text:a.resultEvidence.length?'确认问题最后如何处理、谁因此受益；补一项可核实的具体变化或反馈来源。':'补清问题最后如何处理、谁因此受益；写出具体变化或真实反馈，没有数字也可以。'});
  return {
    title:'文化案例修改建议',
    caseTitle:excerpt(c.title||'文化案例',64),
    person:excerpt(c.nominee||'主人公待补充',26),
    store:excerpt(c.store,30),theme:c.theme||'主题待补充',focus,
    highlight:highlight?`原文线索：“${highlight}”`:`围绕“${focus}”，补充一件真实具体的事。`,
    items,
    manager:c.manager_review?.trim()?`店总评价摘录：“${excerpt(c.manager_review,72)}”`:'',
    video:'准备主人公采访＋1位可核实结果的当事人或见证人；可附真实现场、反馈或工作成果。',
    footer:'按真实经过修改，未确认内容标注“待核实”；请在原案例更新。',
    status:a.eligible?'月会视频候选 · 待复核':'完善后再参与候选复核'
  };
}
export function adviceCardText(card){
  return `【${card.title}】\n${card.theme}｜${card.person}｜${card.store}\n${card.caseTitle}\n\n保留亮点：${card.highlight}\n\n${card.items.map(item=>`${item.title}：${item.text}`).join('\n')}\n${card.manager?'\n'+card.manager+'\n':''}\n视频准备：${card.video}\n\n${card.footer}`;
}
export function wrapText(value,width,measure){
  const result=[];
  for(const paragraph of String(value||'').split('\n')){
    let line='';
    for(const char of Array.from(paragraph)){
      if(line&&measure(line+char)>width){result.push(line);line=char;}else line+=char;
    }
    result.push(line);
  }
  return result;
}
const FONT='"PingFang SC", "Microsoft YaHei", sans-serif';
function round(ctx,x,y,w,h,r,color){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();}
function setFont(ctx,size,weight=500){ctx.font=`${weight} ${size}px ${FONT}`;ctx.textBaseline='top';ctx.textAlign='left';}
function lines(ctx,value,width,size,weight=500){setFont(ctx,size,weight);return wrapText(value,width,v=>ctx.measureText(v).width);}
function drawLines(ctx,list,x,y,size,color='#51405f',weight=500,lineHeight=size*1.65){setFont(ctx,size,weight);ctx.fillStyle=color;list.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));return y+list.length*lineHeight;}
export function adviceImageLayout(card,ctx){
  const width=1080,margin=54,content=width-margin*2;
  const heading=lines(ctx,card.caseTitle,content-56,34,650),identity=lines(ctx,`${card.person}  ·  ${card.store}`,content-56,27,550);
  const headerHeight=156+heading.length*49+identity.length*40;
  const highlight=lines(ctx,card.highlight,content-60,30),focus=lines(ctx,'文化方向：'+card.focus,content-60,25,550);
  const highlightHeight=90+highlight.length*48+focus.length*40;
  const items=card.items.map(item=>({...item,lines:lines(ctx,item.text,content-62,30),height:78+lines(ctx,item.text,content-62,30).length*48}));
  const manager=card.manager?lines(ctx,card.manager,content-60,27):[];
  const video=lines(ctx,card.video,content-60,29);
  const footer=lines(ctx,card.footer,content-16,25);
  const height=54+headerHeight+24+highlightHeight+26+items.reduce((n,item)=>n+item.height+16,0)+(manager.length?manager.length*43+46:0)+video.length*46+96+footer.length*41+65;
  return {width,height,margin,content,heading,identity,headerHeight,highlight,focus,highlightHeight,items,manager,video,footer};
}
export async function renderAdviceImage(card,{scale=2}={}){
  await document.fonts?.ready;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const layout=adviceImageLayout(card,ctx),{width,height,margin,content}=layout;
  canvas.width=width*scale;canvas.height=height*scale;ctx.scale(scale,scale);
  ctx.fillStyle='#fbf6fc';ctx.fillRect(0,0,width,height);
  round(ctx,20,20,width-40,height-40,34,'#fff');
  let y=54;
  round(ctx,margin,y,content,layout.headerHeight,25,'#f0e5f8');
  drawLines(ctx,['给撰写人 / BP'],margin+28,y+25,25,'#816293',600);
  drawLines(ctx,['♡'],width-margin-66,y+21,42,'#c886a7',600);
  drawLines(ctx,[card.title],margin+28,y+69,39,'#67417f',700);
  let inner=drawLines(ctx,layout.heading,margin+28,y+125,34,'#604273',650,49);
  drawLines(ctx,layout.identity,margin+28,inner+5,27,'#7e628e',550,40);
  y+=layout.headerHeight+24;
  round(ctx,margin,y,content,layout.highlightHeight,20,'#fff4f8');
  drawLines(ctx,['保留亮点 · '+card.theme],margin+28,y+22,29,'#a36381',650);
  inner=drawLines(ctx,layout.highlight,margin+28,y+70,30,'#6d5064',500,48);
  drawLines(ctx,layout.focus,margin+28,inner+8,25,'#8b6d82',550,40);
  y+=layout.highlightHeight+26;
  layout.items.forEach((item,index)=>{
    round(ctx,margin,y,content,item.height,18,index%2?'#fbf8fd':'#f6f0fb');
    drawLines(ctx,[item.title],margin+28,y+20,31,'#75518c',650);
    drawLines(ctx,item.lines,margin+28,y+65,30,'#51405f',500,48);y+=item.height+16;
  });
  if(layout.manager.length){
    y=drawLines(ctx,layout.manager,margin+28,y+12,27,'#90647e',500,43)+34;
  }
  const videoHeight=layout.video.length*46+78;
  round(ctx,margin,y,content,videoHeight,20,'#eef6f1');
  drawLines(ctx,['为月会视频准备'],margin+28,y+19,29,'#568069',650);
  drawLines(ctx,layout.video,margin+28,y+64,29,'#506e5d',500,46);
  y+=videoHeight+26;
  y=drawLines(ctx,layout.footer,margin+8,y,25,'#816d8b',500,41);
  drawLines(ctx,['丽兹行 · 上海  |  让每一份优秀被看见'],margin+8,y+12,22,'#92759f',500,34);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('修改建议图片生成失败，请重试。')),'image/png'));
}
