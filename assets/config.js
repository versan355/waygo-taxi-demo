window.WAYGO_CONFIG = {
  orderEmail: 'verrssan@gmail.com',
  // Public URLs only. Never put API secrets in this file.
  geocoderUrl: 'https://photon.komoot.io/api/',
  // Get your free LocationIQ key at https://locationiq.com/ (5000 requests/day, no credit card)
  // Replace 'YOUR_LOCATIONIQ_KEY' with your actual token from the dashboard
  locationiqKey: 'YOUR_LOCATIONIQ_KEY',
  // Mobile networks occasionally block or time out Photon; LocationIQ uses a different domain.
  geocoderUrls: [
    'https://us1.locationiq.com/v1/search',
    'https://photon.komoot.io/api/',
    'https://nominatim.openstreetmap.org/search'
  ],
  // Tried in order. LocationIQ needs the key above; the public OSRM demos are rate-limited
  // and are blocked on some mobile networks.
  routerUrls: [
    'https://us1.locationiq.com/v1/directions/driving/',
    'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
    'https://router.project-osrm.org/route/v1/driving/'
  ],
  routerUrl: 'https://router.project-osrm.org/route/v1/driving/',
  // Approved local rates: ru: {base: 250, km: 32}. Values use the country's currency.
  rates: {},
  ratesAreDemo: true
};
