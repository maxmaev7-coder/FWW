export enum CardType {
  UNIT = 'UNIT',
  ARMOR = 'ARMOR',
  WEAPON = 'WEAPON',
  ITEM = 'ITEM',
  MOD = 'MOD',
}

export interface CardStat {
  label: string;
  value: string | number;
  accent?: boolean;
}

export interface GameCardData {
  id: string;
  name: string;
  type: CardType;
  image?: string;
  subtitle?: string;
  description?: string;
  cost?: number;
  stats?: CardStat[];
  tags?: string[];
  mods?: GameCardData[];
}

export interface UnitGroupData {
  id: string;
  label?: string;
  unit: GameCardData;
  equipment: GameCardData[];
}
