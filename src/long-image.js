// Encode one PNG from small canvas strips so a long store collection does not
// need one canvas taller than the browser's canvas limit.
const crcTable=Uint32Array.from({length:256},(_,n)=>{
  for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;
  return n>>>0;
});
function chunk(type,data=new Uint8Array()){
  const bytes=new Uint8Array(data.length+12),view=new DataView(bytes.buffer);
  view.setUint32(0,data.length);
  for(let i=0;i<4;i++)bytes[i+4]=type.charCodeAt(i);
  bytes.set(data,8);let crc=0xffffffff;
  for(let i=4;i<bytes.length-4;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
  view.setUint32(bytes.length-4,(crc^0xffffffff)>>>0);
  return bytes;
}
export async function encodeRgbaPng(width,height,getRows,{stripRows=1024}={}){
  if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1||height>0x7fffffff)throw Error('图片尺寸不正确。');
  const header=new Uint8Array(13),view=new DataView(header.buffer);
  view.setUint32(0,width);view.setUint32(4,height);header[8]=8;header[9]=6;
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header)];
  const stream=new CompressionStream('deflate'),writer=stream.writable.getWriter(),reader=stream.readable.getReader();
  const drain=(async()=>{for(;;){const {value,done}=await reader.read();if(done)return;parts.push(chunk('IDAT',value));}})();
  try{
    for(let y=0;y<height;y+=stripRows){
      const rows=Math.min(stripRows,height-y),pixels=await getRows(y,rows),stride=width*4;
      if(pixels.length!==stride*rows)throw Error('集锦图片数据不完整，请重试。');
      const filtered=new Uint8Array((stride+1)*rows);
      for(let row=0;row<rows;row++)filtered.set(pixels.subarray(row*stride,(row+1)*stride),row*(stride+1)+1);
      await writer.write(filtered);
    }
    await writer.close();await drain;
  }catch(error){await writer.abort(error).catch(()=>{});await drain.catch(()=>{});throw error;}
  parts.push(chunk('IEND'));
  return new Blob(parts,{type:'image/png'});
}
