(function (root) {
  'use strict';
  // ISO 3166-1 country codes and ISO 4217 currencies. Rates are demo values.
  // Demo rates by currency: [base pickup, per-km rate]
  const currencyRates = {
    EUR: [5, 2.2], GBP: [4, 1.8], USD: [4, 2.5], CAD: [4, 1.7],
    RUB: [250, 32], BYN: [6, 1.2], KZT: [900, 120], PLN: [18, 2.5],
    CZK: [80, 20], HUF: [1200, 300], RON: [20, 5], BGN: [8, 2],
    UAH: [120, 15], MDL: [80, 10], GEL: [10, 2.5], AMD: [1600, 200],
    AZN: [6, 1.5], KGS: [300, 40], UZS: [40000, 5000], TJS: [40, 5],
    TMT: [25, 1.5], NOK: [55, 3.2], SEK: [50, 3], DKK: [35, 2.5],
    ISK: [800, 50], CHF: [6, 2.5], TRY: [180, 14], AED: [18, 2.2],
    SAR: [15, 2], QAR: [15, 2], KWD: [1.2, 0.25], BHD: [1.5, 0.3],
    OMR: [1.5, 0.3], JOD: [3, 0.6], ILS: [15, 2.5], EGP: [120, 15],
    MAD: [40, 5], DZD: [500, 60], TND: [12, 1.8], LYD: [18, 2.5],
    XOF: [700, 110], XAF: [700, 120], NGN: [1800, 95], GHS: [40, 6],
    KES: [400, 50], TZS: [9000, 1200], UGX: [14000, 1800], ZAR: [50, 7],
    MUR: [150, 20], SCR: [60, 8], INR: [120, 18], PKR: [400, 50],
    BDT: [300, 40], LKR: [800, 100], NPR: [200, 25], BTN: [300, 40],
    AFN: [300, 40], MMK: [7000, 900], THB: [120, 15], VND: [90000, 12000],
    KHR: [16000, 2000], LAK: [80000, 10000], MYR: [15, 2.2], SGD: [6, 1.8],
    BND: [6, 1.8], PHP: [200, 25], IDR: [60000, 8000], CNY: [25, 4],
    HKD: [30, 4], TWD: [120, 18], MOP: [30, 4], JPY: [600, 80],
    KRW: [5000, 700], MNT: [12000, 1600], AUD: [6, 2.2], NZD: [6, 2.2],
    FJD: [8, 1.5], PGK: [12, 2], WST: [10, 1.5], TOP: [8, 1.5],
    BRL: [20, 3], ARS: [4000, 500], CLP: [4000, 500], COP: [16000, 2000],
    PEN: [15, 2.2], BOB: [28, 4], PYG: [28000, 3500], UYU: [160, 20],
    MXN: [80, 12], GTQ: [30, 4], HNL: [100, 12], NIO: [140, 18],
    CRC: [2400, 300], PAB: [4, 2.5], DOP: [200, 25], HTG: [500, 60],
    JMD: [600, 75], BBD: [8, 1.2], TTD: [28, 4], XCD: [11, 1.5],
    AWG: [7, 1], BMD: [5, 1.5], BSD: [4, 2.5], KYD: [3.5, 0.8],
    BZD: [8, 1.2], SRD: [60, 8], GYD: [800, 100],
    ALL: [400, 50], AOA: [3000, 400], BAM: [8, 2], BIF: [8000, 1000],
    BWP: [40, 6], CDF: [9000, 1200], CVE: [450, 60], CUP: [100, 12],
    XCG: [7, 1], DJF: [700, 90], ERN: [60, 8], ETB: [200, 25],
    FKP: [3.5, 0.7], GIP: [3.5, 0.7], GMD: [250, 35], GNF: [35000, 4500],
    IQD: [5000, 650], IRR: [160000, 20000], KMF: [1800, 240], KPW: [3600, 480],
    LBP: [60000, 8000], LRD: [600, 80], MGA: [18000, 2400], MKD: [250, 35],
    MRU: [150, 20], MVR: [60, 8], MWK: [6500, 850], MZN: [250, 35],
    NAD: [50, 7], RSD: [500, 70], RWF: [5000, 650], SBD: [32, 4.5],
    SDG: [2400, 320], SHP: [3.5, 0.7], SLE: [90, 12], SOS: [2200, 290],
    SSP: [5200, 680], STN: [100, 13], SYP: [100000, 13000], SZL: [50, 7],
    VES: [140, 18], VUV: [450, 60], XPF: [450, 60], YER: [1000, 130],
    ZMW: [90, 12], ZWG: [1300, 170]
  };
  const currencyData = typeof module === 'object' && module.exports ? require('./country-currencies.js') : root.WaygoCurrencies;
  const names = new Intl.DisplayNames(['ru'], { type: 'region' });
  const countries = Object.fromEntries(Object.entries(currencyData).map(([code,currencies]) => {
    const currency = currencies[0];
    const [base, km] = currencyRates[currency] || [null, null];
    return [code, {
      code, currency, currencies, name: names.of(code.toUpperCase()),
      flag: [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0)+127397)).join(''),
      base, km
    }];
  }));
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
  function estimateRoute(from,to) {
    const straight=distanceBetween(from,to)/1000;
    if(straight<1)return null;
    const distance=straight*1.4;
    const minutes=Math.max(1,Math.ceil(distance/(40/60)));
    return {distance,minutes,points:[from,to],estimated:true};
  }
  const api = {countries,tariffs,countryInfo,money,currencyText,quote,placeFromFeature,routeFromResponse,distanceBetween,estimateRoute};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WaygoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
