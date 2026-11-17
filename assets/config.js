window.WAYGO_CONFIG = {
  orderEmail: 'verrssan@gmail.com',
  // Public URLs only. Never put API secrets in this file.
  geocoderUrl: 'https://photon.komoot.io/api/',
  // Tried in order: the public OSRM demo server is rate-limited and often slow.
  routerUrls: [
    'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
    'https://router.project-osrm.org/route/v1/driving/'
  ],
  routerUrl: 'https://router.project-osrm.org/route/v1/driving/',
  // Approved local rates: ru: {base: 250, km: 32}. Values use the country's currency.
  rates: {},
  ratesAreDemo: true
};
