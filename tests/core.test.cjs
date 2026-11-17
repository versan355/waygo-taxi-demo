const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../assets/waygo-core.js');

test('ISO country/currency distinctions and demo rates for all currencies',()=>{
  assert.ok(Object.keys(C.countries).length>240);
  assert.equal(C.countries.bg.currency,'EUR');
  assert.equal(C.countries.za.currency,'ZAR');
  assert.equal(C.currencyText(C.countries.ps),'ILS / JOD');
  for(const [code,currency] of Object.entries({ru:'RUB',by:'BYN',kz:'KZT',ca:'CAD',us:'USD',ng:'NGN',bf:'XOF',cm:'XAF',ae:'AED',no:'NOK',fi:'EUR',in:'INR',tm:'TMT'}))assert.equal(C.countryInfo(code).currency,currency);
  // All countries with known currencies now have demo rates
  assert.ok(Object.values(C.countries).filter(c=>Number.isFinite(c.base)).length>200);
  assert.ok(Number.isFinite(C.countries.ee.base)); // Estonia (EUR) has demo rates
  assert.ok(Number.isFinite(C.countries.jp.base)); // Japan (JPY) has demo rates
});
test('country comes from geocoder metadata even if city name is ambiguous',()=>{
  const place=C.placeFromFeature({geometry:{type:'Point',coordinates:[-71,42]},properties:{name:'Berlin',countrycode:'US',country:'United States'}});
  assert.equal(place.code,'us');assert.match(place.label,/Соединенные Штаты|Соединённые Штаты|США/);
  assert.equal(C.placeFromFeature({geometry:{type:'Point',coordinates:[0,0]},properties:{name:'Berlin'}}),null);
  assert.equal(C.placeFromFeature({geometry:{type:'Point',coordinates:[181,90]},properties:{countrycode:'DE'}}),null);
});
test('local tariff formula, precision, configuration',()=>{
  assert.equal(C.quote(C.countries.ru,10,'econom'),570);
  assert.equal(C.quote(C.countries.de,10,'comfort'),41.85);
  assert.equal(C.quote(C.countries.cm,10,'econom'),1900);
  // Japan now has demo rates based on JPY currency
  assert.ok(C.quote(C.countries.jp,10,'econom')>0);
  assert.equal(C.quote(C.countries.ru,10,'econom',{ru:{base:100,km:20}}),300);
  for(const distance of [0,-1,NaN,Infinity])assert.equal(C.quote(C.countries.ru,distance,'econom'),null);
  assert.equal(C.quote(C.countries.ru,10,'invalid'),null);
  assert.match(C.money(100,'CAD'),/CAD/);assert.match(C.money(100,'USD'),/USD/);
});
test('real geometry, kilometers and duration use route response',()=>{
  const route=C.routeFromResponse({code:'Ok',routes:[{distance:12500,duration:780,geometry:{type:'LineString',coordinates:[[13,52],[13.1,52.1],[13.2,52.3]]}}]});
  assert.equal(route.distance,12.5);assert.equal(route.minutes,13);assert.deepEqual(route.points[1],[52.1,13.1]);
  for(const data of [{code:'NoRoute'}, {code:'Ok',routes:[]},{code:'Ok',routes:[{distance:0,duration:0}]}])assert.throws(()=>C.routeFromResponse(data));
});
test('straight-line estimate is longer than the straight line and always flagged',()=>{
  const moscow=[55.75,37.61], spb=[59.94,30.31];
  const estimate=C.estimateRoute(moscow,spb);
  assert.equal(estimate.estimated,true);
  assert.ok(estimate.distance>C.distanceBetween(moscow,spb)/1000);
  assert.equal(estimate.points.length,2);
  assert.ok(estimate.minutes>0);
  assert.equal(C.estimateRoute(moscow,[55.7505,37.6105]),null);
});
test('coincident points can be rejected before routing',()=>{
  assert.equal(C.distanceBetween([52,13],[52,13]),0);
  assert.ok(C.distanceBetween([52,13],[52.01,13])>1000);
});
