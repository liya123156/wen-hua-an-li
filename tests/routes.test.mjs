import test from 'node:test';
import assert from 'node:assert/strict';
import {routeFromHash,createRouteFragment} from '../src/routes.js';
test('opening an ordinary link selects the submission page without credentials',()=>{
  assert.equal(routeFromHash(''),'submit');assert.equal(createRouteFragment('counts'),'#counts');
});
test('old invitation links still work and navigation removes the obsolete access code',()=>{
  assert.equal(routeFromHash('#access=old-value&view=counts'),'counts');
  assert.equal(routeFromHash('#access=old-value'),'submit');
  assert.equal(createRouteFragment('library','obsolete-access'),'#library');
});
