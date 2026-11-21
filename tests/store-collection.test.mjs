import test from 'node:test';
import assert from 'node:assert/strict';
import {storeCollection,storeFeedback,collectionLayout,COLLECTION_IMAGE} from '../src/store-collection.js';
import {parseModificationLink,caseClientInfo} from '../src/edit-access.js';
const caseOne={id:'one',cycle:'2026-11',store:'陆家嘴旗舰店',theme:'尊重伙伴',title:'测试故事',nominee:'测试伙伴',body:'伙伴主动帮助新人补充工作知识，并耐心解释每个具体问题。',manager_review:'店总评价：请补充结果。',created_at:'2026-11-20T08:00:00Z'};
test('monthly collection includes only the chosen store and month and deduplicates records',()=>{
 const report=storeCollection([caseOne,caseOne,{...caseOne,id:'two',theme:'协作共创'},{...caseOne,id:'other-store',store:'碧云店'},{...caseOne,id:'other-month',cycle:'2026-10'}],'陆家嘴旗舰店','2026-11');
 assert.equal(report.total,2);assert.equal(report.themes.length,2);assert.equal(report.shortfall,1);assert.equal(report.entries[0].body,caseOne.body);assert.equal(report.entries[0].manager_review,caseOne.manager_review);
 const message=storeFeedback(report);assert.ok(message.includes('共收集2篇'));assert.ok(message.includes('还差1篇'));assert.ok(message.includes('尊重伙伴1篇'));assert.ok(!message.includes('碧云店'));assert.ok(message.includes('文字初筛参考'));assert.ok(message.includes('不足2篇'));
});
test('an empty store receives a truthful zero-case message and can still generate a summary page',()=>{
 const report=storeCollection([],'碧云店','2026-12');assert.equal(report.total,0);assert.ok(storeFeedback(report).includes('2026年12月'));assert.ok(storeFeedback(report).includes('还差3篇'));assert.ok(collectionLayout(report,(s,size)=>Array.from(s).length*size).items.length);
});
test('one store image retains every full case and comment without pagination or shrinking text',()=>{
 const body=(' 第一段：伙伴耐心沟通，补充真实行动细节。\n第二段：实际结果需要结合顾客反馈说明。\n').repeat(160);
 const review='店总评价原文。'.repeat(60);
 const report=storeCollection([{...caseOne,body,manager_review:review},{...caseOne,id:'two',body:'第二篇的完整内容，请不要丢失。'}],'陆家嘴旗舰店','2026-11');
 const layout=collectionLayout(report,(s,size)=>Array.from(s).length*size),lines=layout.items;
 assert.ok(layout.height>4000);assert.equal(layout.width,1080);
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
