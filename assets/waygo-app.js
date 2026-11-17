(() => {
  'use strict';
  const C = window.WaygoCore, config = window.WAYGO_CONFIG;
  const $ = id => document.getElementById(id);
  const state = {from:null,to:null,route:null,version:0,controller:null,routerDiag:[]};
  const searches = {}, cache = new Map();
  let map, markers = [], line;
  const mapPadding = () => [Math.min(140,map.getSize().x/4),75];
  const status = (text, kind='info') => { $('routeStatus').textContent=text; $('routeStatus').dataset.kind=kind; };
  const countryOf = place => place ? C.countryInfo(place.code,place.countryName) : null;
  const currentCountry = () => countryOf(state.from);
  const rateFor = country => country && (config.rates[country.code] || country);
  const rateLabel = () => config.ratesAreDemo ? 'Демо-тариф' : 'Предварительная стоимость';
  function setSummary() {
    const country=currentCountry();
    const route=state.route;
    const cross=state.from && state.to && state.from.code!==state.to.code;
    const price=country && route && !cross ? C.quote(country,route.distance,$('tariff').value,config.rates) : null;
    $('distance').textContent = route ? `Расстояние ${route.distance.toLocaleString('ru-RU',{maximumFractionDigits:1})} км` : 'Расстояние —';
    $('time').textContent = route ? `≈ ${route.minutes} мин` : 'Время —';
    $('price').textContent = price===null ? '—' : C.money(price,country.currency);
    $('estimateTitle').textContent=rateLabel();
    $('countryFlag').textContent=country?.flag || '🌍';
    $('countryName').textContent=country ? `${country.name} · ${C.currencyText(country)}` : 'Страна определяется по месту отправления';
    for (const id of ['from','to']) {
      const p=state[id], c=countryOf(p);
      $(`${id}Meta`).textContent = p ? `${c.flag} ${c.name} · ${C.currencyText(c)}` : 'Введите город или адрес и нажмите «Найти»';
    }
    const rate=rateFor(country);
    $('rateDetail').textContent = Number.isFinite(rate?.base) && Number.isFinite(rate?.km) ?
      `(${C.money(rate.base,country.currency)} посадка + ${C.money(rate.km,country.currency)}/км) × ${C.tariffs[$('tariff').value].mult}. Время — без учёта пробок.` :
      (country ? 'Для этой страны ставки ещё не заданы.' : 'Выберите место отправления, чтобы увидеть валюту и ставки.');
    $('tariffCaption').textContent = country ? `${rateLabel()}: ${country.name} · ${C.currencyText(country)}. Формула: (посадка + километры × ставка) × коэффициент класса.` : 'Страна и валюта тарифов определятся после выбора места отправления.';
    document.querySelectorAll('[data-tariff]').forEach(el=>{
      el.textContent=!Number.isFinite(rate?.base) ? 'Ставки не заданы' : `Посадка ${C.money(rate.base*C.tariffs[el.dataset.tariff].mult,country.currency)}`;
    });
    document.querySelectorAll('[data-rate]').forEach(el=>{
      el.textContent=Number.isFinite(rate?.km) ? `${C.money(rate.km*C.tariffs[el.dataset.rate].mult,country.currency)} / км · ${config.ratesAreDemo?'демо':'тариф'}` : 'Выберите страну отправления';
    });
    $('orderSummary').textContent = $('requestType').value==='connect' ? 'Подключение к сервису заказов. Укажите город работы, а в комментарии — название компании и пожелания к подключению.' : [state.from?`Откуда: ${state.from.label}`:'Маршрут пока не выбран.',state.to?`Куда: ${state.to.label}`:'',country?`Страна отправления: ${country.name}. Валюта: ${C.currencyText(country)}.`:'',route?`${route.estimated?'Ориентировочно, по прямой (сервисы маршрутов были недоступны)':'По дороге'}: ${route.distance.toFixed(1)} км, ≈ ${route.minutes} мин.`:'',price!==null?`${rateLabel()}: ${C.money(price,country.currency)} · ${C.tariffs[$('tariff').value].name}.`:'Стоимость не рассчитана.'].filter(Boolean).join('\n');
    $('routerDiag').textContent = state.routerDiag.length ? `Диагностика: ${state.routerDiag.join('; ')}.` : '';
  }
  function clearLine() { if(line && map) {line.remove();line=null;} }
  function invalidate(message='Маршрут изменён. Рассчитайте поездку заново.') {
    state.version++; state.controller?.abort(); state.controller=null; state.route=null;
    clearLine(); $('calculate').disabled=false; $('calculate').textContent='Рассчитать поездку';
    $('mapStatus').textContent='Выберите две точки для автомобильного маршрута';
    status(message); setSummary();
  }
  function drawPoints(fit=true) {
    if(!map)return;
    markers.forEach(m=>m.remove()); markers=[];
    for(const id of ['from','to']) {
      const p=state[id]; if(!p)continue;
      const label=document.createElement('span');label.textContent=p.label;
      const icon=L.divIcon({className:'',html:`<div class="waygo-pin ${id==='from'?'from':'destination'}"></div>`,iconSize:[30,30],iconAnchor:[15,30]});
      markers.push(L.marker(p.point,{icon,title:(id==='from'?'Откуда: ':'Куда: ')+p.label}).addTo(map).bindTooltip(label,{permanent:true,direction:'top',offset:[0,-26],className:'waygo-label'}));
    }
    const points=[state.from,state.to].filter(Boolean).map(p=>p.point);
    if(fit && points.length)map.fitBounds(L.latLngBounds(points),{padding:mapPadding(),maxZoom:14});
  }
  function cancelSearch(id) {
    searches[id]?.abort(); delete searches[id];
    $(`${id}Search`).disabled=false; $(`${id}Search`).textContent='Найти';
  }
  // The host is named in every message: on mobile networks a single provider is often blocked.
  const hostOf = url => { try { return new URL(url).hostname; } catch { return String(url); } };
  const hasKey = () => Boolean(config.locationiqKey) && config.locationiqKey !== 'YOUR_LOCATIONIQ_KEY';
  // error.reason is a short cause shown on the page: an HTTP code tells a refusal
  // apart from a connection that never opened.
  const mark = (error, reason) => { error.reason = reason; return error; };
  async function request(url,controller,timeout=25000) {
    const host=hostOf(url);
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeout);
    try {
      const response=await fetch(url,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)throw mark(new Error(`Сервис ${host} временно недоступен (${response.status}). Попробуйте позже.`),`ответил ${response.status}`);
      return await response.json();
    } catch(error) {
      if(error.name==='AbortError')throw mark(error,timedOut?`молчит дольше ${Math.round(timeout/1000)} с`:'запрос отменён');
      if(error.name==='TypeError')throw mark(new Error(navigator.onLine===false ? 'Нет подключения к интернету. Проверьте мобильные данные или Wi‑Fi.' : `Не удалось соединиться с ${host}. Сервис может быть заблокирован Вашим мобильным оператором или сетью.`),navigator.onLine===false?'нет интернета':'соединение не установлено');
      if(error.name==='SyntaxError')throw mark(new Error(`Сервис ${host} вернул некорректные данные. Попробуйте ещё раз.`),'ответ не разобран');
      throw mark(error,error.reason||'ошибка');
    } finally {clearTimeout(timer);}
  }
  function nominatimFeatures(data) {
    if (!Array.isArray(data)) return null;
    return data.map(item => {
      const lat=Number(item.lat), lon=Number(item.lon), a=item.address || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) return null;
      const code=String(a.country_code || '').toLowerCase();
      if (!/^[a-z]{2}$/.test(code)) return null;
      return {geometry:{type:'Point',coordinates:[lon,lat]},properties:{
        name:a.road || a.city || a.town || a.village || item.display_name,
        street:a.road, housenumber:a.house_number,
        city:a.city || a.town || a.village || a.municipality,
        state:a.state, countrycode:code, country:a.country
      }};
    }).filter(Boolean);
  }
  async function searchGeocoder(query,filter,controller) {
    const bases=Array.isArray(config.geocoderUrls) && config.geocoderUrls.length ? config.geocoderUrls : [config.geocoderUrl];
    let last, malformed=false, sawEmpty=false;
    for (const base of bases) {
      if (controller.signal.aborted) throw new DOMException('Aborted','AbortError');
      const attempt=new AbortController();
      const relay=()=>attempt.abort();
      controller.signal.addEventListener('abort',relay,{once:true});
      try {
        const url=new URL(base);
        const isLocationIQ=url.hostname.includes('locationiq');
        const isNominatim=url.hostname.includes('nominatim');
        
        if (isLocationIQ) {
          // LocationIQ uses the same format as Nominatim but requires an API key
          if (!hasKey()) throw new Error('LocationIQ key not configured');
          url.searchParams.set('key',config.locationiqKey);
          url.searchParams.set('q',query);
          url.searchParams.set('format','json');
          url.searchParams.set('addressdetails','1');
          url.searchParams.set('accept-language','ru');
          url.searchParams.set('limit','6');
          if (filter) url.searchParams.set('countrycodes',filter.toLowerCase());
        } else {
          url.searchParams.set('q',query);
          url.searchParams.set('limit','6');
          // Nominatim names the filter countrycodes (lowercase); Photon uses countrycode.
          if (filter) isNominatim
            ? url.searchParams.set('countrycodes',filter.toLowerCase())
            : url.searchParams.set('countrycode',filter.toUpperCase());
          if (isNominatim) {
            url.searchParams.set('format','jsonv2');
            url.searchParams.set('addressdetails','1');
            url.searchParams.set('accept-language','ru');
          }
        }
        
        const data=await request(url,attempt);
        const features=(isLocationIQ || isNominatim) ? nominatimFeatures(data) : (Array.isArray(data.features) ? data.features : null);
        if (!features) { malformed=true; throw new Error('Сервис поиска вернул некорректный ответ.'); }
        const places=features.map(C.placeFromFeature).filter(Boolean);
        if (places.length) return places;
        sawEmpty=true;
        last=new Error('Адрес не найден.');
      } catch(error) {
        if (error.name==='AbortError' && controller.signal.aborted) throw error;
        last=error;
      } finally {
        controller.signal.removeEventListener('abort',relay);
      }
    }
    if (sawEmpty) return [];
    if (malformed) throw new Error('Сервис поиска вернул некорректный ответ. Попробуйте позже.');
    if (navigator.onLine===false) throw new Error('Нет подключения к интернету. Проверьте мобильные данные или Wi‑Fi.');
    throw new Error(`Не удалось соединиться с сервисами поиска (${bases.map(hostOf).join(', ')}). Возможно, они заблокированы Вашим мобильным оператором или сетью.`);
  }
  // The public OSRM demo server is rate-limited, so each router gets its own attempt.
  async function fetchRoute(coords, outer) {
    const bases = Array.isArray(config.routerUrls) && config.routerUrls.length ? config.routerUrls : [config.routerUrl];
    let data, last;
    state.routerDiag = [];
    for (const base of bases) {
      if (outer.signal.aborted) return null;
      const attempt = new AbortController();
      const relay = () => attempt.abort();
      outer.signal.addEventListener('abort', relay, {once:true});
      try {
        const isLocationIQ = base.includes('locationiq');
        const url = new URL(`${base.replace(/\/+$/,'')}/${coords}`);
        // LocationIQ speaks OSRM, but only with a key. Without one the service is skipped.
        if (isLocationIQ) {
          if (!hasKey()) throw new Error('LocationIQ key not configured');
          url.searchParams.set('key', config.locationiqKey);
        }
        url.searchParams.set('overview','full');
        url.searchParams.set('geometries','geojson');
        // Remove radiuses parameter — can cause matching issues on some OSRM servers
        data = await request(url, attempt, 35000);
      } catch (error) {
        if (outer.signal.aborted) return null;
        console.warn(`Router ${hostOf(base)} failed:`, error.message || error);
        state.routerDiag.push(`${hostOf(base)} — ${error.reason || 'ошибка'}`);
        last = error; continue;
      } finally {
        outer.signal.removeEventListener('abort', relay);
      }
      // The router answered: its verdict is final, no point asking the next one.
      state.routerDiag = [];
      return C.routeFromResponse(data);
    }
    // All routers failed: estimate by straight-line distance with typical road detour
    const estimate = C.estimateRoute(state.from.point,state.to.point);
    if (estimate) return estimate;
    throw last;
  }
  async function search(id) {
    const query=$(id).value.trim();
    if(query.length<2){status('Введите хотя бы два символа города или адреса.','error');$(id).focus();return;}
    cancelSearch(id);
    const controller=new AbortController();searches[id]=controller;
    const filter=$('lang').value;
    $(`${id}Search`).disabled=true;$(`${id}Search`).textContent='Ищем…';$(`${id}Results`).replaceChildren();
    status('Ищем адрес. Выберите подходящий результат с указанной страной.');
    try {
      const key=`${filter}|${query.toLowerCase()}`;
      let places=cache.get(key);
      if(!places){
        places=await searchGeocoder(query,filter,controller);
        if(cache.size>80)cache.clear();cache.set(key,places);
      }
      if(searches[id]!==controller || $(id).value.trim()!==query || $('lang').value!==filter)return;
      if(!places.length){status('Адрес не найден. Уточните город и улицу или выберите «Весь мир» в фильтре страны.','error');return;}
      for(const p of places){
        const c=countryOf(p), button=document.createElement('button');button.type='button';button.className='result';
        const name=document.createElement('span');name.textContent=p.label;
        const meta=document.createElement('small');meta.textContent=`${c.flag} ${c.name} · ${C.currencyText(c)}`;
        button.append(name,meta);button.addEventListener('click',()=>selectPlace(id,p));
        $(`${id}Results`).append(button);
      }
      status(`Выберите ${id==='from'?'место отправления':'назначение'} из результатов поиска.`);
    } catch(error) {
      if(searches[id]===controller)status(error.name==='AbortError'?'Поиск не ответил вовремя. Попробуйте ещё раз.':error.message,'error');
    } finally {
      if(searches[id]===controller)cancelSearch(id);
    }
  }
  function selectPlace(id,place) {
    cancelSearch(id);state[id]=place;$(id).value=place.label;$(`${id}Results`).replaceChildren();
    invalidate('Точка выбрана.');drawPoints();
    if(state.from&&state.to)calculate();else status('Теперь найдите и выберите вторую точку.');
  }
  async function calculate() {
    if(!state.from || !state.to){const id=!state.from?'from':'to';status('Сначала выберите оба адреса из результатов поиска.');await search(id);return;}
    invalidate('Строим автомобильный маршрут…');
    if(C.distanceBetween(state.from.point,state.to.point)<50){status('Точки слишком близко. Выберите другой пункт назначения.','error');return;}
    if(!map){status('Карта не загрузилась. Обновите страницу и попробуйте снова.','error');return;}
    const version=state.version, controller=new AbortController();state.controller=controller;
    $('calculate').disabled=true;$('calculate').textContent='Строим маршрут…';$('mapStatus').textContent='Строим маршрут по дорогам…';
    try {
      const coords=[state.from,state.to].map(p=>`${p.point[1]},${p.point[0]}`).join(';');
      const route=await fetchRoute(coords,controller);
      if(state.version!==version || !route)return;
      state.route=route;
      clearLine();
      if(route.estimated){
        line=L.polyline(route.points,{color:'#708700',weight:3,opacity:.5,dashArray:'8,6'}).addTo(map);
        $('mapStatus').textContent='Расстояние по прямой × 1.4 (сервисы маршрутов недоступны)';
      } else {
        line=L.polyline(route.points,{color:'#708700',weight:5,opacity:.9}).addTo(map);
        $('mapStatus').textContent='Автомобильный маршрут · OpenStreetMap / OSRM';
      }
      map.fitBounds(line.getBounds(),{padding:mapPadding(),maxZoom:15});setSummary();
      if(state.from.code!==state.to.code)status('Маршрут проходит между странами. Валюта указана по месту отправления; цену международной поездки нужно согласовать в заявке.');
      else if(route.estimated)status('Расстояние оценено приблизительно — сервисы маршрутов недоступны. Стоимость для справки.');
      else if(C.quote(currentCountry(),route.distance,$('tariff').value,config.rates)===null)status('Маршрут построен. Для этой страны тариф ещё не настроен — уточните стоимость в заявке.');
      else status(`Маршрут построен. ${config.ratesAreDemo?'Стоимость рассчитана по демонстрационным ставкам.':'Стоимость предварительная.'}`);
    } catch(error) {
      if(state.version!==version)return;
      state.route=null;clearLine();setSummary();
      status(error.name==='AbortError'?'Сервисы маршрутов не ответили вовремя. Нажмите «Рассчитать поездку» ещё раз.':error.message,'error');
      $('mapStatus').textContent='Маршрут недоступен. Показаны только выбранные точки.';
    } finally {
      if(state.version===version){$('calculate').disabled=false;$('calculate').textContent='Рассчитать поездку';state.controller=null;}
    }
  }
  // Country filtering never guesses country from a typed city name.
  Object.values(C.countries).sort((a,b)=>a.name.localeCompare(b.name,'ru')).forEach(c=>{
    const option=document.createElement('option');option.value=c.code;option.textContent=`${c.flag} ${c.name} · ${C.currencyText(c)}`;$('lang').append(option);
  });
  $('lang').addEventListener('change',()=>{
    for(const id of ['from','to']){cancelSearch(id);$(`${id}Results`).replaceChildren();}
    status($('lang').value ? `Поиск ограничен страной: ${C.countries[$('lang').value].name}. Уже выбранные точки сохранены.` : 'Поиск городов и адресов по всему миру.');
  });
  for(const id of ['from','to']){
    $(`${id}Search`).addEventListener('click',()=>search(id));
    $(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search(id);}});
    $(id).addEventListener('input',()=>{cancelSearch(id);state[id]=null;$(`${id}Results`).replaceChildren();invalidate('Адрес изменён. Нажмите «Найти» и выберите результат.');drawPoints(false);});
  }
  $('swap').addEventListener('click',()=>{
    for(const id of ['from','to']){cancelSearch(id);$(`${id}Results`).replaceChildren();}
    [state.from,state.to]=[state.to,state.from];[$('from').value,$('to').value]=[$('to').value,$('from').value];
    invalidate('Точки поменялись местами.');drawPoints();if(state.from&&state.to)calculate();
  });
  $('calculate').addEventListener('click',calculate);
  $('tariff').addEventListener('change',()=>{setSummary();document.querySelectorAll('.car').forEach(el=>el.classList.toggle('active',el.querySelector('[data-tariff]').dataset.tariff===$('tariff').value));});
  $('requestType').addEventListener('change',setSummary);
  function orderText(){
    return [`Заявка WAYGO: ${$('requestType').selectedOptions[0].textContent}`,`Имя: ${$('customerName').value.trim()}`,`Контакт: ${$('customerContact').value.trim()}`,`Город: ${$('customerCity').value.trim()}`,'',$('orderSummary').textContent,'',`Комментарий: ${$('customerNote').value.trim() || '—'}`,'','Заявка требует подтверждения. Машина автоматически не назначена.'].join('\n');
  }
  const emailLink=()=>`mailto:${config.orderEmail}?subject=${encodeURIComponent('Заявка WAYGO — '+$('requestType').selectedOptions[0].textContent)}&body=${encodeURIComponent(orderText())}`;
  $('customerContact').addEventListener('input',()=>{
    const value=$('customerContact').value.trim();
    const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || (/^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g,'').length>=7);
    $('customerContact').setCustomValidity(valid?'':'Укажите email или телефон минимум из 7 цифр.');
  });
  $('recipient').textContent=config.orderEmail;$('recipient').href=`mailto:${config.orderEmail}`;
  $('orderForm').addEventListener('submit',event=>{
    event.preventDefault();if(!$('orderForm').reportValidity())return;
    window.location.href=emailLink();
    $('formStatus').textContent='Готовое письмо открывается в Вашем почтовом приложении. Нажмите там «Отправить». Если почта не открылась, скачайте заявку и отправьте её на '+config.orderEmail+'.';
  });
  $('downloadRequest').addEventListener('click',()=>{
    if(!$('orderForm').reportValidity())return;
    const url=URL.createObjectURL(new Blob([orderText()],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='waygo-request.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('formStatus').textContent='Заявка скачана. Отправьте файл на '+config.orderEmail+'. Скачивание не отправляет заявку.';
  });
  try {
    if(!window.L)throw new Error('Leaflet unavailable');
    map=L.map('map',{scrollWheelZoom:false}).setView([55.76,37.64],11);
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    tiles.on('tileerror',()=>{$('mapStatus').textContent='Подложка карты временно недоступна. Повторите загрузку позже.';});
  } catch(error) {status('Карта не загрузилась. Обновите страницу.','error');}
  state.from={point:[55.8125441,37.8113875],code:'ru',label:'улица Чусовская, 5, Москва, Россия'};
  state.to={point:[55.749,37.54],code:'ru',label:'Москва-Сити, Москва, Россия'};
  $('from').value=state.from.label;$('to').value=state.to.label;
  drawPoints();setSummary();if(map)calculate();
})();
