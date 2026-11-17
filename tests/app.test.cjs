const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
const route={code:'Ok',routes:[{distance:12500,duration:780,geometry:{type:'LineString',coordinates:[[13,52],[13.1,52.1],[13.2,52.2]]}}]};
const feature=(name,code,xy)=>({geometry:{type:'Point',coordinates:xy},properties:{name,countrycode:code}});
function setup(handler){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{runScripts:'outside-only',url:'https://waygo.example/'});
  const w=dom.window, calls=[], lines=[];
  w.fetch=async(url,options)=>{calls.push(String(url));return handler?handler(String(url),options):{ok:true,json:async()=>route};};
  const map={setView(){return this;},fitBounds(){},getSize(){return {x:800,y:600};}};
  const layer=()=>({addTo(){return this;},bindTooltip(){return this;},remove(){this.removed=true;},getBounds(){return [];},on(){return this;}});
  w.L={map:()=>map,tileLayer:layer,divIcon:x=>x,marker:layer,latLngBounds:x=>x,polyline:points=>{const l=layer();l.points=points;lines.push(l);return l;}};
  for(const file of ['config.js','country-currencies.js','waygo-core.js','waygo-app.js'])w.eval(fs.readFileSync(path.join(root,'assets',file),'utf8'));
  const el=id=>w.document.getElementById(id);
  const input=(id,value)=>{el(id).value=value;el(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
  async function pick(id,query){input(id,query);el(id+'Search').click();await flush();const b=el(id+'Results').querySelector('button');assert.ok(b,'search result exists');b.click();await flush();}
  return {dom,w,calls,lines,el,input,pick};
}
const json=data=>({ok:true,json:async()=>data});
test('editing while a route request is in flight prevents stale price and geometry',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r),app=setup(()=>pending);
  try{
    app.input('from','Unknown city');resolve(json(route));await flush();
    assert.equal(app.el('price').textContent,'—');assert.equal(app.el('distance').textContent,'Расстояние —');
    assert.equal(app.lines.length,0);assert.equal(app.el('calculate').disabled,false);
  }finally{app.dom.window.close();}
});
test('selected city metadata changes country, currency, price and tariff without route refetch',async()=>{
  const app=setup(url=>Promise.resolve(json(url.includes('/api/')?{features:[feature(new URL(url).searchParams.get('q'),'CA',url.includes('Brandon')?[-99.95,49.84]:[-97.13,49.89])]}:route)));
  try{
    await flush();app.input('to','');await app.pick('from','Winnipeg');await app.pick('to','Brandon');
    assert.equal(app.el('countryName').textContent,'Канада · CAD');assert.match(app.el('price').textContent,/25,25.*CAD/);
    assert.equal(app.lines.at(-1).points.length,3);
    const count=app.calls.length;app.el('tariff').value='comfort';app.el('tariff').dispatchEvent(new app.w.Event('change'));
    assert.equal(app.calls.length,count);assert.match(app.el('price').textContent,/39,14.*CAD/);
    const codes=[...app.el('lang').options].map(o=>o.value);assert.equal(new Set(codes).size,codes.length);
  }finally{app.dom.window.close();}
});
test('international route never receives a fabricated price',async()=>{
  let code='DE';const app=setup(url=>Promise.resolve(json(url.includes('/api/')?{features:[feature('City',code,code==='DE'?[13,52]:[139.63,35.44])]}:route)));
  try{
    await flush();await app.pick('from','Berlin');
    code='JP';app.input('to','');await app.pick('to','Yokohama');
    assert.match(app.el('routeStatus').textContent,/между странами/);
    assert.equal(app.el('price').textContent,'—','International routes should not show a price');
  }finally{app.dom.window.close();}
});
test('router failure falls back to an estimate that is always marked as one',async()=>{
  let fail=false;const app=setup(()=>Promise.resolve(fail?{ok:false,status:503}:json(route)));
  try{
    await flush();const exact=app.el('price').textContent;assert.notEqual(exact,'—');
    fail=true;app.el('calculate').click();await flush();
    assert.ok(app.lines[0].removed,'stale geometry is dropped');
    assert.match(app.el('routeStatus').textContent,/приблизительно/);
    assert.match(app.el('mapStatus').textContent,/по прямой/i);
    assert.match(app.el('orderSummary').textContent,/Ориентировочно/);
    const diag=app.el('routerDiag').textContent;
    assert.match(diag,/Диагностика/);
    assert.match(diag,/locationiq\.com — ответил 503/);
    assert.match(diag,/router\.project-osrm\.org — ответил 503/);
    assert.notEqual(app.el('price').textContent,exact,'estimate must not reuse the routed price');
    assert.equal(app.el('calculate').disabled,false);
  }finally{app.dom.window.close();}
});
test('late search results do not resurrect after text changes',async()=>{
  let resolve;const app=setup(url=>url.includes('/api/')||url.includes('locationiq')||url.includes('nominatim')?new Promise(r=>resolve=r):Promise.resolve(json(route)));
  try{
    await flush();app.input('from','Berlin');app.el('fromSearch').click();app.input('from','Paris');
    if(resolve)resolve(json({features:[feature('Berlin','DE',[13,52])]}));await flush();
    assert.equal(app.el('fromResults').children.length,0);assert.equal(app.el('price').textContent,'—');
  }finally{app.dom.window.close();}
});
test('empty and malformed search responses never choose a city or use a fallback price',async()=>{
  let data={features:[]};const app=setup(url=>Promise.resolve(json(url.includes('/api/')?data:route)));
  try{
    await flush();app.input('from','Not a real city');app.el('fromSearch').click();await flush();
    assert.match(app.el('routeStatus').textContent,/Адрес не найден/);assert.equal(app.el('price').textContent,'—');
    data={features:{unexpected:true}};app.input('from','Another query');app.el('fromSearch').click();await flush();
    assert.match(app.el('routeStatus').textContent,/некорректный ответ/);assert.equal(app.el('price').textContent,'—');
  }finally{app.dom.window.close();}
});
test('form validates contacts and downloads route with no network transmission',async()=>{
  const app=setup();
  try{
    await flush();app.input('customerName','Test');app.input('customerCity','Москва');app.input('customerContact','wrong');
    assert.equal(app.el('customerContact').checkValidity(),false);
    app.input('customerContact','test@example.org');assert.equal(app.el('customerContact').checkValidity(),true);
    app.el('consent').checked=true;
    let blob;app.w.Blob=Blob;app.w.URL.createObjectURL=b=>{blob=b;return 'blob:test';};app.w.URL.revokeObjectURL=()=>{};
    app.w.HTMLAnchorElement.prototype.click=function(){};
    const before=app.calls.length;app.el('downloadRequest').click();
    const text=await blob.text();assert.match(text,/Страна отправления: Россия/);assert.match(text,/test@example.org/);assert.match(text,/RUB/);
    assert.equal(app.calls.length,before);assert.match(app.el('recipient').href,/mailto:verrssan@gmail.com/);
    assert.match(app.el('formStatus').textContent,/не отправляет/);
    app.el('requestType').value='connect';app.el('requestType').dispatchEvent(new app.w.Event('change'));
    assert.doesNotMatch(app.el('orderSummary').textContent,/Чусовская/);
  }finally{app.dom.window.close();}
});
