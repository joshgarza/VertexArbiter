// MARA API Request Types
export interface CreateSiteRequest {
  name: string;
}

export interface AllocateMachinesRequest {
  air_miners?: number;
  hydro_miners?: number;
  immersion_miners?: number;
  gpu_compute?: number;
  asic_compute?: number;
}

// MARA API Response Types
export interface CreateSiteResponse {
  api_key: string;
  name: string;
  power: number;
}

export interface PriceData {
  energy_price: number;
  hash_price: number;
  timestamp: string;
  token_price: number;
}

export interface InventoryResponse {
  inference: {
    asic: {
      power: number;
      tokens: number;
    };
    gpu: {
      power: number;
      tokens: number;
    };
  };
  miners: {
    air: {
      hashrate: number;
      power: number;
    };
    hydro: {
      hashrate: number;
      power: number;
    };
    immersion: {
      hashrate: number;
      power: number;
    };
  };
}

export interface MachineAllocation {
  air_miners: number;
  asic_compute: number;
  gpu_compute: number;
  hydro_miners: number;
  id: number;
  immersion_miners: number;
  site_id: number;
  updated_at: string;
}

export interface MachineStatus extends MachineAllocation {
  power: {
    air_miners: number;
    asic_compute: number;
    gpu_compute: number;
    hydro_miners: number;
    immersion_miners: number;
  };
  revenue: {
    air_miners: number;
    asic_compute: number;
    gpu_compute: number;
    hydro_miners: number;
    immersion_miners: number;
  };
  total_power_cost: number;
  total_power_used: number;
  total_revenue: number;
}

// Configuration Types
export interface SiteConfig {
  api_key: string;
  name: string;
  power: number;
  created_at: string;
}
