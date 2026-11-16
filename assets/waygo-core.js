(function (root) {
  'use strict';
  // ISO 3166-1 country codes and ISO 4217 currencies. Rates are demo values.
  const rows = [
    ['ru','RUB',250,32], ['by','BYN',6,1.2], ['kz','KZT',900,120],
    ['de','EUR',5,2.2], ['gb','GBP',4,1.8], ['es','EUR',4,1.9],
    ['ca','CAD',4,1.7], ['us','USD',4,2.5], ['no','NOK',55,3.2],
    ['fi','EUR',5,2.1], ['lt','EUR',4,1.8], ['pl','PLN',18,2.5],
    ['fr','EUR',5,2.3], ['tm','TMT',25,1.5], ['in','INR',120,18],
    ['cm','XAF',700,120], ['ng','NGN',1800,95], ['bf','XOF',700,110],
    ['ae','AED',18,2.2], ['tr','TRY',180,14]
  ];
  const currencyData = typeof module === 'object' && module.exports ? require('./country-currencies.js') : root.WaygoCurrencies;
  const names = new Intl.DisplayNames(['ru'], { type: 'region' });
  const countries = Object.fromEntries(Object.entries(currencyData).map(([code,currencies]) => [code, {
    code, currency:currencies[0], currencies, name: names.of(code.toUpperCase()),
    flag: [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0)+127397)).join('')
  }]));
  rows.forEach(([code,currency,base,km])=>Object.assign(countries[code],{currency,base,km}));
  const tariffs = {econom:{name:'Эконом',mult:1},comfort:{name:'Комфорт',mult:1.55},business:{name:'Бизнес',mult:2.6}};
  function countryInfo(code, fallbackName) {
    const key = String(code || '').toLowerCase();
    return countries[key] || {code:key, name:fallbackName || 'Страна не определена', currency:null, flag:'🌍'};
  }
  function money(amount, currency) {
    if (!currency || !Number.isFinite(amount)) return '—';
    return new Intl.NumberFormat('ru-RU', {style:'currency',currency,currencyDisplay:'code',maximumFractionDigits:2}).format(amount);
  }
  function currencyText(country) { return country?.currencies?.join(' / ') || country?.currency || 'валюта не настроена'; }
  function quote(country, distance, tariffKey, overrides = {}) {
    const rate = overrides[country.code] || country;
    if (!Number.isFinite(rate.base) || rate.base < 0 || !Number.isFinite(rate.km) || rate.km < 0 ||
        !Number.isFinite(distance) || distance <= 0 || !tariffs[tariffKey]) return null;
    const digits = new Intl.NumberFormat('ru', {style:'currency',currency:country.currency}).resolvedOptions().maximumFractionDigits;
    const scale = 10 ** digits;
    return Math.round((rate.base + rate.km * distance) * tariffs[tariffKey].mult * scale) / scale;
  }
  function placeFromFeature(feature) {
    const p = feature?.properties, xy = feature?.geometry?.coordinates;
    if (!p || feature.geometry.type !== 'Point' || !Array.isArray(xy) || xy.length < 2 ||
        !Number.isFinite(xy[0]) || !Number.isFinite(xy[1]) || Math.abs(xy[0]) > 180 || Math.abs(xy[1]) > 90 ||
        !/^[a-z]{2}$/i.test(p.countrycode || '')) return null;
    const country = countryInfo(p.countrycode, p.country);
    const street = [p.street, p.housenumber].filter(Boolean).join(', ');
    const pieces = [p.name, street, p.city || p.town || p.village, p.state, country.name].filter(Boolean);
    return {point:[xy[1],xy[0]], code:country.code, label:[...new Set(pieces)].join(', '), countryName:country.name};
  }
  function routeFromResponse(data) {
    const r = data?.routes?.[0];
    if (data?.code !== 'Ok' || !Number.isFinite(r?.distance) || r.distance <= 0 || !Number.isFinite(r.duration) || r.duration < 0 ||
        r.geometry?.type !== 'LineString' || !Array.isArray(r.geometry.coordinates) || r.geometry.coordinates.length < 2 ||
        r.geometry.coordinates.some(p => !Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0])>180 || Math.abs(p[1])>90)) {
      throw new Error('Автомобильный маршрут не найден. Уточните точки или попробуйте позже.');
    }
    return {distance:r.distance/1000, minutes:Math.max(1,Math.ceil(r.duration/60)), points:r.geometry.coordinates.map(p=>[p[1],p[0]])};
  }
  function distanceBetween(a,b) {
    const rad = Math.PI/180, dlat=(b[0]-a[0])*rad, dlon=(b[1]-a[1])*rad;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2));
  }
  const api = {countries,tariffs,countryInfo,money,currencyText,quote,placeFromFeature,routeFromResponse,distanceBetween};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WaygoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
