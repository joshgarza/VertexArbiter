# MARA Hackathon 2025 API Reference

**Base URL:** `https://mara-hackathon-api.onrender.com`

## Authentication
- **Header:** `X-Api-Key: YOUR_API_KEY`
- Get API key by creating a site (see below)
- Save your API key - if lost, create new site but lose progress

## Core Endpoints

### 1. Site Management

#### Create Site
```http
POST /sites
Content-Type: application/json

{
  "name": "YourSiteName"
}
```

**Response:**
```json
{
  "api_key": "XXX",
  "name": "YourSiteName",
  "power": 1000000
}
```

#### Get Site Info
```http
GET /sites
X-Api-Key: YOUR_API_KEY
```

### 2. Market Data

#### Get Current Prices (Updates every 5 minutes)
```http
GET /prices
```

**Response:**
```json
[
  {
    "energy_price": 0.647889223893815,
    "hash_price": 8.448180236220946,
    "timestamp": "2025-06-21T13:00:00",
    "token_price": 2.91225594861526
  }
]
```

#### Get Available Inventory (Static)
```http
GET /inventory
```

**Response:**
```json
{
  "inference": {
    "asic": {
      "power": 15000,
      "tokens": 50000
    },
    "gpu": {
      "power": 5000,
      "tokens": 1000
    }
  },
  "miners": {
    "air": {
      "hashrate": 1000,
      "power": 3500
    },
    "hydro": {
      "hashrate": 5000,
      "power": 5000
    },
    "immersion": {
      "hashrate": 10000,
      "power": 10000
    }
  }
}
```

### 3. Machine Management

#### Allocate Machines
```http
PUT /machines
X-Api-Key: YOUR_API_KEY
Content-Type: application/json

{
  "asic_miners": 10,
  "gpu_compute": 30,
  "asic_compute": 5,
  "immersion_miners": 10
}
```

**Response:**
```json
{
  "air_miners": 0,
  "asic_compute": 5,
  "gpu_compute": 30,
  "hydro_miners": 0,
  "id": 5,
  "immersion_miners": 10,
  "site_id": 2,
  "updated_at": "2025-06-21T13:17:50.126193"
}
```

#### Get Machine Status
```http
GET /machines
X-Api-Key: YOUR_API_KEY
```

**Response:**
```json
{
  "air_miners": 0,
  "asic_compute": 5,
  "gpu_compute": 30,
  "hydro_miners": 0,
  "id": 5,
  "immersion_miners": 10,
  "power": {
    "air_miners": 0,
    "asic_compute": 75000,
    "gpu_compute": 150000,
    "hydro_miners": 0,
    "immersion_miners": 100000
  },
  "revenue": {
    "air_miners": 0.0,
    "asic_compute": 212734.43494337276,
    "gpu_compute": 25528.132193204732,
    "hydro_miners": 0.0,
    "immersion_miners": 150596.58003406858
  },
  "site_id": 0,
  "total_power_cost": 238466.35509633605,
  "total_power_used": 325000,
  "total_revenue": 388859.1471706461,
  "updated_at": "2025-06-21T13:17:50.126193"
}
```

## Key Concepts

### Machine Types
- **air_miners**: Air-cooled Bitcoin miners
- **hydro_miners**: Hydro-cooled Bitcoin miners
- **immersion_miners**: Immersion-cooled Bitcoin miners
- **gpu_compute**: GPU inference compute
- **asic_compute**: ASIC inference compute

### Power Constraint
- Each site has a `power` limit (e.g., 1,000,000 watts)
- Cannot exceed total power allocation across all machines
- Power usage calculated from inventory specs × quantity

### Revenue Model
- Revenue generated from:
  - Bitcoin mining (hashrate × hash_price)
  - Inference compute (tokens × token_price)
- Costs: total_power_used × energy_price
- Profit = total_revenue - total_power_cost

### Price Updates
- Prices update every 5 minutes
- Machine status/revenue updates automatically with price changes
- Historical pricing available via `/prices` endpoint

## Integration Notes

### For Real-Time Applications
- Poll `/prices` every 5 minutes for latest market data
- Cache `/inventory` data (static throughout event)
- Monitor `/machines` for revenue/cost tracking

### Power Management Strategy
- Calculate total power before allocation:
  ```
  total_power = (air_miners × 3500) + (hydro_miners × 5000) +
                (immersion_miners × 10000) + (gpu_compute × 5000) +
                (asic_compute × 15000)
  ```
- Must be ≤ site power limit

### Optimization Opportunities
- Monitor price ratios: hash_price vs energy_price, token_price vs energy_price
- Dynamically reallocate machines based on profitability
- Consider power efficiency: immersion > hydro > air for mining
- ASIC compute: higher power but more tokens than GPU

## External Resources
- **Bitcoin Data**: mempool.space, hashrateindex.com
- **Inference Markets**: inference.net, sfcompute.com
- **Energy Pricing**: gridstatus.io