import ironGateTrader from '../data/traders/iron_gate_trader.json';

interface TraderItem {
  itemId: string;
  price: number;
}

export interface TraderDef {
  id: string;
  name: string;
  location: string;
  inventory: TraderItem[];
  buybackRate: number;
}

const TRADERS: TraderDef[] = [ironGateTrader as TraderDef];

export function getTraderAtLocation(location: string): TraderDef | null {
  return TRADERS.find(trader => trader.location === location) ?? null;
}
