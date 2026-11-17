import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReminder,deadlineLabel,validDeadline,shanghaiDay,posterSize} from '../src/counts-tools.js';
import {submissionCounts} from '../src/submission.js';
import {STORES} from '../src/model.js';
const cycle='2026-11';
test('reminder only lists stores below three, with exact current counts and shortfalls',()=>{
 const records=STORES.flatMap((store,i)=>Array.from({length:i===0?0:i===1?1:i===2?2:3},(_,j)=>({id:store+j,store,theme:'顾客至上',cycle})));
 const result=buildReminder({counts:submissionCounts(records,cycle),deadline:'2026-11-17',today:'2026-11-17',link:'https://example.test/'});
 assert.ok(result.includes('还有3家门店'));assert.ok(result.includes('仁恒河滨城店：已提交0篇，还差3篇'));assert.ok(result.includes('碧云店：已提交1篇，还差2篇'));assert.ok(result.includes('御翠园店：已提交2篇，还差1篇'));
 assert.ok(!result.includes('星河湾店：'));assert.ok(result.includes('今天（2026年11月17日）24:00前'));assert.ok(result.includes('店总推荐1 / 店总推荐2'));assert.ok(result.includes('https://example.test/'));
});
test('all stores completed produces a truthful completion message without a missing-store list',()=>{
 const cases=STORES.flatMap(store=>Array.from({length:3},(_,i)=>({id:store+i,store,theme:'专业卓越',cycle})));
 const result=buildReminder({counts:submissionCounts(cases,cycle),deadline:'2026-11-20',today:'2026-11-17'});
 assert.ok(result.includes('21家门店均已提交至少3篇'));assert.ok(!result.includes('还差'));assert.ok(result.includes('2026年11月20日24:00前'));assert.ok(!result.includes('今天'));
});
test('deadline dates are valid and local midnight uses Shanghai timezone',()=>{
 assert.equal(validDeadline('2026-02-30'),false);assert.equal(deadlineLabel('bad'),'');
 assert.equal(shanghaiDay(new Date('2026-11-17T16:05:00Z')),'2026-11-18');
 assert.equal(buildReminder({counts:submissionCounts([],cycle),deadline:''}),'');
});
test('poster includes space for every row rather than only the viewport',()=>{
 assert.deepEqual(posterSize(21),{width:1680,height:1678});assert.equal(posterSize(22).height-posterSize(21).height,54);
});
