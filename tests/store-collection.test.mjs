import test from 'node:test';
import assert from 'node:assert/strict';
import {storeCollection,storeFeedback,collectionLayout,COLLECTION_IMAGE,collectionPerson} from '../src/store-collection.js';
import {parseModificationLink,caseClientInfo} from '../src/edit-access.js';
const caseOne={id:'one',cycle:'2026-11',store:'陆家嘴旗舰店',theme:'尊重伙伴',title:'测试故事',nominee:'测试伙伴',body:'伙伴主动帮助新人补充工作知识，并耐心解释每个具体问题。',manager_review:'店总评价：请补充结果。',created_at:'2026-11-20T08:00:00Z'};
test('monthly collection includes only the chosen store and month and deduplicates records',()=>{
 const report=storeCollection([caseOne,caseOne,{...caseOne,id:'two',theme:'协作共创'},{...caseOne,id:'other-store',store:'碧云店'},{...caseOne,id:'other-month',cycle:'2026-10'}],'陆家嘴旗舰店','2026-11');
 assert.equal(report.total,2);assert.equal(report.themes.length,2);assert.equal(report.shortfall,1);assert.equal(report.entries[0].body,caseOne.body);assert.equal(report.entries[0].manager_review,caseOne.manager_review);
 const message=storeFeedback(report);assert.ok(message.includes('共收集2篇'));assert.ok(message.includes('还差1篇'));assert.ok(!message.includes('碧云店'));assert.ok(message.includes('文字初筛参考'));assert.ok(message.includes('启动大会文化嘉奖'));assert.ok(message.includes('尊重伙伴：测试伙伴'));assert.ok(message.includes('协作共创：测试伙伴'));assert.ok(message.includes('全司月会获奖情况：【BP手动补充'));assert.ok(!message.includes('视频候选'));
});
test('an empty store receives a truthful zero-case message and can still generate a summary page',()=>{
 const report=storeCollection([],'碧云店','2026-12');assert.equal(report.total,0);assert.ok(storeFeedback(report).includes('2026年12月'));assert.ok(storeFeedback(report).includes('还差3篇'));assert.ok(collectionLayout(report,(s,size)=>Array.from(s).length*size).items.length);
});
test('one store image retains every full case and comment without pagination or shrinking text',()=>{
 const body=(' 第一段：伙伴耐心沟通，补充真实行动细节。\n第二段：实际结果需要结合顾客反馈说明。\n').repeat(160);
 const review='店总评价原文。'.repeat(60);
 const report=storeCollection([{...caseOne,body,manager_review:review},{...caseOne,id:'two',body:'第二篇的完整内容，请不要丢失。'}],'陆家嘴旗舰店','2026-11');
 const layout=collectionLayout(report,(s,size)=>Array.from(s).length*size),lines=layout.items;
 assert.ok(layout.height>4000);assert.equal(layout.columns,2);assert.equal(layout.width,COLLECTION_IMAGE.margin*2+COLLECTION_IMAGE.cardWidth*2+COLLECTION_IMAGE.gap);
 assert.equal(lines.filter(x=>x.tag==='case-heading').length,2);assert.ok(!lines.some(x=>x.tag==='continuation'));
 assert.ok(lines.filter(x=>x.tag==='body').every(x=>x.size===30));
 assert.equal(lines.filter(x=>x.caseId==='one'&&x.tag==='body').map(x=>x.text).join(''),body.replaceAll('\n',''));
 assert.equal(lines.filter(x=>x.caseId==='one'&&x.tag==='manager').map(x=>x.text).join(''),review);
 assert.ok(lines.some(x=>x.tag==='body'&&x.text.includes('第二篇')));assert.ok(lines.every(x=>x.y+x.lineHeight<=layout.height-COLLECTION_IMAGE.bottom));
});
test('BP can use a specifically shared case edit link without granting access to other cases',()=>{
 const id='11111111-2222-4333-8444-555555555555',token='b'.repeat(64);
 assert.deepEqual(parseModificationLink('https://example.test/#edit='+id+'&key='+token),{id,token});
 assert.equal(parseModificationLink('https://example.test/#bp=shared-access-to-everything'),null);
 assert.equal(parseModificationLink('https://example.test/#edit='+id+'&key=1234'),null);
 assert.equal(caseClientInfo('record-key'),'culture-web.record-key');assert.equal(caseClientInfo(),'culture-web.');
});

test('multi-column cards balance different lengths while keeping every case separate and avoiding overlap',()=>{
 const cases=[20,100,10,70].map((n,i)=>({...caseOne,id:'case-'+i,body:('第'+i+'篇完整案例原文，包含具体场景、行动和结果。').repeat(n)}));
 const report=storeCollection(cases,caseOne.store,caseOne.cycle),measure=(s,size)=>Array.from(s).length*size;
 const single=collectionLayout(report,measure,{columns:1}),auto=collectionLayout(report,measure),manual=collectionLayout(report,measure,{columns:3});
 assert.ok(auto.columns>=2);assert.ok(auto.height/auto.width<single.height/single.width);assert.equal(manual.columns,3);
 for(const layout of [auto,manual]){
  assert.equal(layout.cards.length,4);
  for(let i=0;i<layout.cards.length;i++){
   const a=layout.cards[i];assert.ok(a.y>=layout.summary.y+layout.summary.height);
   for(const b of layout.cards.slice(i+1))assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
   const body=layout.items.filter(x=>x.caseId===a.caseId&&x.tag==='body');
   assert.ok(body.every(x=>x.x>=a.x&&x.y>=a.y&&x.y+x.lineHeight<=a.y+a.height));
   assert.equal(body.map(x=>x.text).join(''),cases.find(c=>c.id===a.caseId).body);
  }
 }
});

test('feedback names use explicit nomination text without guessing from ordinary mentions',()=>{
 assert.equal(collectionPerson({...caseOne,nominee:'',body:'李四 | 专业卓越标兵\n完整案例正文。'}),'李四');
 assert.equal(collectionPerson({...caseOne,nominee:'',body:'具体事迹。\n她就是——测试店B组张三！'}),'张三');
 assert.equal(collectionPerson({...caseOne,nominee:'',body:'顾客王五向顾问李四咨询，经理张三也来帮助。'}),'');
 assert.equal(collectionPerson({...caseOne,nominee:'',body:'李四 | 专业卓越标兵\n他就是——测试店B组张三！'}),'');
});
