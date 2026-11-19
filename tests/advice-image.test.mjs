import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAdviceCard,adviceCardText,wrapText,adviceImageLayout} from '../src/advice-image.js';
import {SCORE_DIMENSIONS} from '../src/model.js';
const c={id:'advice-test',cycle:'2026-11',theme:'顾客至上',store:'嘉御庭公馆店',nominee:'测试伙伴',title:'一次及时的服务',body:'当天，顾客因为原本的预约出现问题而担心无法按时看房。测试伙伴主动询问顾客的实际需求，逐一联系维护人重新协调时间，并整理备用方案。随后，他再次核实看房条件，安排同事对接手续，现场记录顾客反馈并逐条跟进。最终顾客顺利完成看房，反馈沟通安排很周到。小组采纳了提前核实时间、及时分享资料的方法。'};
test('image advice retains the case identity, original evidence and three concise editing tasks',()=>{
 const card=buildAdviceCard(c),text=adviceCardText(card);
 assert.equal(card.items.length,3);assert.equal(card.person,'测试伙伴');assert.ok(card.highlight.includes('主动询问'));
 assert.ok(text.includes('嘉御庭公馆店'));assert.ok(text.includes('顾客至上'));assert.ok(text.includes('事件发生日期'));assert.ok(text.includes('视频准备'));assert.ok(text.includes('待核实'));assert.ok(text.length<650);
 for(const item of card.items)assert.ok(item.text.length<105);
});
test('dates already provided are retained and missing identity receives a concrete follow-up',()=>{
 const card=buildAdviceCard({...c,nominee:'',event_on:'2026-11-06'});
 assert.ok(card.items[0].text.includes('补上主人公'));assert.ok(card.items[0].text.includes('保留已写明'));assert.ok(!card.items[0].text.includes('确认事件发生日期'));
});
test('truth or contribution concerns take precedence and manager comments remain attributed',()=>{
 const card=buildAdviceCard({...c,manager_review:'店总评价：真实性存疑，请先核实行动由谁完成。'});
 assert.equal(card.items.length,4);assert.equal(card.items[0].title,'先核实事实');assert.ok(card.manager.includes('真实性存疑'));assert.ok(card.manager.startsWith('店总评价摘录'));
});
test('wrapping preserves every character and all long-case blocks have enough vertical space',()=>{
 const value='顾客反馈abc123，具体行动。\n核实事实与人物贡献';
 const wrapped=wrapText(value,8,text=>Array.from(text).length);assert.equal(wrapped.join(''),value.replaceAll('\n',''));
 assert.ok(wrapped.every(line=>Array.from(line).length<=8));
 const context={font:'',measureText(value){return {width:Array.from(value).length*30}}};
 const normal=adviceImageLayout(buildAdviceCard(c),context),long=adviceImageLayout(buildAdviceCard({...c,title:'标题较长需要完整换行'.repeat(12),manager_review:'这是需要注明来源的店总评价。'.repeat(50)}),context);
 assert.equal(normal.width,1080);assert.ok(long.height>normal.height);assert.ok(long.height<2400);assert.equal(SCORE_DIMENSIONS.reduce((n,d)=>n+d.max,0),100);
});
