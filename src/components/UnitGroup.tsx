import React from 'react';
import GameCard from './GameCard';
import { CardType, GameCardData, UnitGroupData } from '../types';

interface UnitGroupProps {
  group: UnitGroupData;
}

const isModCard = (card: GameCardData) => card.type === CardType.MOD;

const UnitGroup: React.FC<UnitGroupProps> = ({ group }) => {
  return (
    <section className="w-full bg-[#121212] rounded-2xl border border-gray-900 px-5 py-4 shadow-[0_0_45px_rgba(0,0,0,0.65)]">
      {group.label && (
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.3em] text-slate-400 font-['Roboto_Condensed',_sans-serif]">
            {group.label}
          </h2>
          <span className="h-px flex-1 ml-4 bg-gradient-to-r from-emerald-500/60 via-cyan-400/40 to-transparent" />
        </header>
      )}
      <div className="flex flex-row gap-4 items-start overflow-x-auto">
        <div className="flex-shrink-0">
          <GameCard card={group.unit} />
        </div>
        <div className="flex flex-row gap-4 items-start">
          {group.equipment.map((item) => (
            <div key={item.id} className="flex flex-col gap-2">
              <GameCard card={item} />
              {!!item.mods?.length && (
                <div className="flex flex-col gap-2 pl-4 border-l border-gray-800">
                  {item.mods.map((mod) => (
                    <GameCard key={mod.id} card={isModCard(mod) ? mod : { ...mod, type: CardType.MOD }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UnitGroup;
