import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {encodeRgbaPng} from '../src/long-image.js';

test('a single PNG preserves every row past the canvas height limit and has valid chunk checksums',async()=>{
  const width=3,height=40001,calls=[];
  const blob=await encodeRgbaPng(width,height,(top,rows)=>{
    calls.push([top,rows]);
    return Uint8Array.from({length:width*rows*4},(_,i)=>((top*width*4+i)%251));
  },{stripRows:777});
  assert.equal(blob.type,'image/png');assert.ok(calls.length>1);
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
  assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
  const types=[],compressed=[];
  for(let offset=8;offset<bytes.length;){
    const length=view.getUint32(offset),type=String.fromCharCode(...bytes.slice(offset+4,offset+8));types.push(type);
    const payload=bytes.subarray(offset+8,offset+8+length);
    let crc=0xffffffff;
    for(const value of bytes.subarray(offset+4,offset+8+length)){crc^=value;for(let k=0;k<8;k++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}
    assert.equal(view.getUint32(offset+8+length),(crc^0xffffffff)>>>0);
    if(type==='IHDR'){assert.equal(view.getUint32(offset+8),width);assert.equal(view.getUint32(offset+12),height);}
    if(type==='IDAT')compressed.push(payload);
    offset+=length+12;
  }
  assert.equal(types.filter(x=>x==='IHDR').length,1);assert.equal(types.at(-1),'IEND');
  const raw=inflateSync(Buffer.concat(compressed));
  assert.equal(raw.length,(width*4+1)*height);
  for(let y=0;y<height;y++){
    assert.equal(raw[y*(width*4+1)],0);
    for(let x=0;x<width*4;x++)assert.equal(raw[y*(width*4+1)+1+x],(y*width*4+x)%251);
  }
});
