const views=['submit','library','selection','counts'];
export function routeFromHash(hash){
  const raw=String(hash||'').replace(/^#/,'');
  const params=new URLSearchParams(raw);
  const view=params.get('view')||raw;
  return views.includes(view)?view:'submit';
}
export function createRouteFragment(view){return '#'+(views.includes(view)?view:'submit');}
