import {analyze,THEMES} from './model.js';
export function reviewMessage(c){
  const a=analyze(c),theme=THEMES.find(t=>t.name===c.theme),person=c.nominee||'待补充主人公',quote=s=>s?`“${s.slice(0,135)}”`:'';
  const focus=a.standardEvidence[0]?.label||theme?.yes?.[0]?.[0]||c.theme;
  const items=[];
  if(c.manager_review?.trim())items.push(`店总评价供本次修改参考：${quote(c.manager_review)}。请回应其中提出的事实、贡献或完善建议；推荐标记作为参考，仍需把关键行为与结果写实。`);
  if(!c.nominee)items.push('先写清主人公姓名、门店及其在事件中的职责。视频需要明确讲谁的故事、哪些贡献由本人完成。');
  if(a.video?.context)items.push(`建议以原文${quote(a.video.context)}作为视频故事的起点。${c.event_on?'保留已写明的时间，':'补充事件发生时间，'}把场景、对方的真实需要和当时最关键的难点讲清楚，压缩与主线无关的背景。`);
  else items.push('补清故事起点：什么时候、在哪里、涉及谁、对方遇到了什么问题？请围绕一件具体事件展开。');
  if(a.actionEvidence.length)items.push(`优先保留行动细节${quote(a.actionEvidence[0])}${a.actionEvidence[1]?`以及${quote(a.actionEvidence[1])}`:''}。按发生顺序组织主线，补足其中最能还原的一个动作或真实沟通过程，并区分本人和其他伙伴的贡献。`);
  else items.push('补足2—3个可以还原的关键动作，写清本人做了什么、怎么做、与谁沟通，形成能拍成画面的行动过程。');
  items.push(`围绕“${focus}”，请主人公确认当时为什么这样选择、主动承担了什么。将真实想法作为采访补充，结尾提炼一个其他伙伴可实践的做法，用具体事实表达文化价值。`);
  if(a.resultEvidence.length)items.push(`核实结果${quote(a.resultEvidence[0])}，补充反馈来自谁、原话或可确认的具体变化是什么。没有数字也可以，但要讲清给顾客、伙伴或团队带来的实际价值。`);
  else items.push('补充实际结果和真实反馈：问题最终如何处理、谁因此受益、发生了什么具体变化？可引用可核实的反馈，不必强行量化。');
  if(a.conflicts.length)items.push(`请先核实这段表述${quote(a.conflicts[0])}的主体和实际经过，并补清后续处理。核实前暂不作为月会候选。`);
  items.push('补充可核实线索：当事人或见证人是谁，是否有对应的业务记录、聊天反馈或工作成果。未确认的内容请标注“待核实”。');
  const scene=a.video?.context||a.actionEvidence[0]||'';
  return `【文化标杆案例修改对接】\n主题：${c.theme}\n门店：${c.store}\n主人公：${person}\n案例：${c.title}\n\nBP / 撰写人好，辛苦继续完善这篇案例。我们希望将优秀标杆拍成月会视频，让伙伴看见真实行动、理解文化价值，并能学习实践。当前是候选评审，补实后再确认最终入选。\n\n建议保留的亮点：\n${a.standardEvidence.length?`原文已呈现“${focus}”的行为线索。${a.actionEvidence[0]?`例如${quote(a.actionEvidence[0])}。`:''}`:'已有推荐方向，请继续用具体事实支撑所选价值观。'}\n\n本次请重点完善：\n${items.map((v,i)=>`${i+1}、${v}`).join('\n')}\n\n为视频呈现准备：\n${scene?`• 场景线索：${quote(scene)}，可确认现场、工作成果或由当事人采访讲述。\n`:''}• 建议采访主人公，补充当时的想法和关键选择；请同时明确一位可以核实结果的当事人或见证人。\n• 如有真实现场照片、工作记录、相关成果，可一并提供；是否有现成素材不作为文化行为优劣的判断。\n\n修改后的叙事顺序：真实场景与问题 → 主人公的选择 → 具体行动 → 实际结果 → 值得学习的文化行为。\n请基于真实经过补充，不新增未经核实的情节或对白。可通过原案例的专属修改链接更新，避免重复入库。`;
}
