export const MARA_API = {
  BASE_URL: 'https://mara-hackathon-api.onrender.com',
  ENDPOINTS: {
    SITES: '/sites',
    PRICES: '/prices',
    INVENTORY: '/inventory',
    MACHINES: '/machines'
  },
  POLL_INTERVAL: 5 * 60 * 1000, // 5 minutes in milliseconds
  DEFAULT_SITE_NAME: 'VertexArbiter'
} as const;

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development'
} as const;
