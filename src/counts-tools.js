import {THEMES} from './model.js';

export function shanghaiDay(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const value=type=>parts.find(p=>p.type===type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function validDeadline(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return false;
  const d=new Date(day+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;
}
export function deadlineLabel(day,today=shanghaiDay()){
  if(!validDeadline(day))return '';
  const [year,month,date]=day.split('-').map(Number);
  return `${day===today?'今天（':''}${year}年${month}月${date}日${day===today?'）':''}24:00前`;
}
export function buildReminder({counts,deadline,link='',today=shanghaiDay()}){
  const when=deadlineLabel(deadline,today);
  if(!when)return '';
  const below=counts.rows.filter(r=>r.total<3);
  const progress=below.length
    ?`目前还有${below.length}家门店提交不足3篇，请对应BP伙伴重点跟进：\n${below.map(r=>`▫️ ${r.store}：已提交${r.total}篇，还差${3-r.total}篇`).join('\n')}`
    :'目前21家门店均已提交至少3篇，感谢大家及时推进💜';
  return `各位BP伙伴，下午好～🌱\n\n📌 提醒大家，本轮文化案例请于${when}完成链接填写及提交！\n\n${progress}\n\n案例收集后，记得及时同步各自店总，邀请店总结合案例质量及文化代表性，选出本店最推荐的2篇，在案例下方「店总评价」中注明“店总推荐1 / 店总推荐2＋推荐理由”。暂时没有评价，也可先提交案例。\n\n让店总及时了解收集进展，也方便项目负责人重点关注有代表性、值得拍成月会视频的优秀故事。请写清真实场景、具体行动及实际结果，一起把伙伴的优秀呈现好。\n\n⏰ 截止时间：${when}\n${link?`🔗 收集链接：${link}\n`:''}\n辛苦大家及时跟进、推动完善啦！💜`;
}

export const POSTER={width:1680,padding:52,header:274,headRow:62,row:54,totalRow:66,footer:142};
export function posterSize(rowCount){return {width:POSTER.width,height:POSTER.header+POSTER.headRow+rowCount*POSTER.row+POSTER.totalRow+POSTER.footer};}
function rounded(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
function heart(ctx,x,y,size,color){ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);ctx.beginPath();ctx.moveTo(0,28);ctx.bezierCurveTo(-75,-18,-42,-70,0,-35);ctx.bezierCurveTo(42,-70,75,-18,0,28);ctx.fillStyle=color;ctx.fill();ctx.restore();}
function text(ctx,value,x,y,size,color='#51405f',weight=500,align='left'){
  ctx.font=`${weight} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);
}
export async function renderCountsImage({counts,cycle,deadline='',scale=2}){
  await document.fonts?.ready;
  const {width,height}=posterSize(counts.rows.length),canvas=document.createElement('canvas');
  canvas.width=width*scale;canvas.height=height*scale;
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
  ctx.fillStyle='#fff9f7';ctx.fillRect(0,0,width,height);
  rounded(ctx,22,22,width-44,height-44,38,'#fff');
  rounded(ctx,POSTER.padding,52,width-POSTER.padding*2,178,28,'#f4eafa');
  heart(ctx,width-185,125,114,'#e9b9d0');heart(ctx,width-90,84,36,'#c7b1e4');
  // A small smiling heart makes the poster warm while keeping every number exact.
  ctx.fillStyle='#79608e';ctx.beginPath();ctx.arc(width-202,108,4,0,Math.PI*2);ctx.arc(width-170,108,4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#79608e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(width-186,119,11,0,Math.PI);ctx.stroke();
  text(ctx,'让每一份优秀，被看见',82,90,23,'#816592',600);
  text(ctx,'各店文化案例提交一览',82,148,49,'#5e4276',700);
  const month=cycle.replace('-','年')+'月';
  const covered=counts.rows.filter(r=>r.total>=3).length;
  text(ctx,`${month}  ·  21家门店  ·  7大文化主题`,82,197,25,'#755e87');
  text(ctx,`已入库 ${counts.grandTotal} 篇`,POSTER.padding+12,250,29,'#6c4b86',700);
  text(ctx,`达到3篇 ${covered} / 21店`,width-POSTER.padding-12,250,27,'#866377',600,'right');
  const x=POSTER.padding,y=POSTER.header,w=width-x*2,first=308,last=110,themeWidth=(w-first-last)/7;
  rounded(ctx,x,y,w,POSTER.headRow+counts.rows.length*POSTER.row+POSTER.totalRow,18,'#f6eefb');
  const positions=THEMES.map((_,i)=>x+first+themeWidth*(i+.5));
  text(ctx,'门店',x+22,y+POSTER.headRow/2,27,'#644679',700);
  THEMES.forEach((t,i)=>text(ctx,t.name,positions[i],y+POSTER.headRow/2,26,'#644679',700,'center'));
  text(ctx,'合计',x+w-last/2,y+POSTER.headRow/2,27,'#644679',700,'center');
  counts.rows.forEach((r,i)=>{
    const top=y+POSTER.headRow+i*POSTER.row,center=top+POSTER.row/2;
    ctx.fillStyle=i%2?'#fdf8fc':'#fff';ctx.fillRect(x,top,w,POSTER.row);
    ctx.fillStyle=r.total<3?'#fff0f4':'#f0f7f1';ctx.fillRect(x+w-last,top,last,POSTER.row);
    text(ctx,r.store,x+22,center,26,'#51405f',600);
    THEMES.forEach((t,j)=>text(ctx,r.counts[t.name],positions[j],center,29,r.counts[t.name]?'#70449b':'#85738f',r.counts[t.name]?700:500,'center'));
    text(ctx,r.total,x+w-last/2,center,30,r.total<3?'#b45c7a':'#4c7f60',700,'center');
    ctx.strokeStyle='#eee5f1';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,top+POSTER.row);ctx.lineTo(x+w,top+POSTER.row);ctx.stroke();
  });
  const bottom=y+POSTER.headRow+counts.rows.length*POSTER.row;
  text(ctx,'合计',x+22,bottom+POSTER.totalRow/2,28,'#644679',700);
  THEMES.forEach((t,i)=>text(ctx,counts.totals[t.name],positions[i],bottom+POSTER.totalRow/2,31,'#644679',700,'center'));
  text(ctx,counts.grandTotal,x+w-last/2,bottom+POSTER.totalRow/2,32,'#644679',700,'center');
  const footerY=bottom+POSTER.totalRow;
  text(ctx,'每店目标 ≥3篇  ·  粉色合计提醒待补齐  ·  提交成功即计入篇数',x+14,footerY+37,24,'#7b637f');
  text(ctx,validDeadline(deadline)?`提交截止：${deadlineLabel(deadline,'')}`:'一起发现优秀，把文化落实到行动里',x+14,footerY+77,25,'#7b637f',600);
  text(ctx,'丽兹行 · 上海',width-x-12,footerY+77,24,'#8c6b9e',600,'right');
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片生成失败，请重试')),'image/png'));
  return blob;
}
