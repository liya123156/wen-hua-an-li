const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const tokenPattern=/^[A-Za-z0-9_-]{40,128}$/;
export function parseModificationLink(value){
  try{
    const raw=String(value||'').trim(),hash=raw.startsWith('#')?raw.slice(1):new URL(raw).hash.slice(1);
    const params=new URLSearchParams(hash),id=params.get('edit')||'',token=params.get('key')||'';
    return idPattern.test(id)&&tokenPattern.test(token)?{id,token}:null;
  }catch{return null;}
}
export function caseClientInfo(recordToken=''){return 'culture-web.'+recordToken;}
