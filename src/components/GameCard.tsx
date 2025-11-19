import React from 'react';
import clsx from 'clsx';
import { CardType, GameCardData } from '../types';

interface GameCardProps {
  card: GameCardData;
}

const neonAccentByType: Record<CardType, string> = {
  [CardType.UNIT]: 'border-b-2 border-b-emerald-400/60',
  [CardType.ARMOR]: 'border-b-2 border-b-cyan-400/70',
  [CardType.WEAPON]: 'border-b-2 border-b-amber-400/70',
  [CardType.ITEM]: 'border-b-2 border-b-sky-400/60',
  [CardType.MOD]: 'border-b-2 border-b-fuchsia-400/60',
};

const dimensionClasses: Record<CardType, string> = {
  [CardType.UNIT]: 'w-[220px] aspect-[63/88]',
  [CardType.ARMOR]: 'w-[220px] aspect-[63/88]',
  [CardType.WEAPON]: 'w-[280px] aspect-[88/63]',
  [CardType.ITEM]: 'w-[260px] aspect-[88/63]',
  [CardType.MOD]: 'w-[240px] aspect-[88/63] scale-95 origin-top-left',
};

const cardBackground = 'bg-[#1e1e1e] border border-gray-800 text-gray-100 rounded-lg shadow-[0_0_25px_rgba(0,0,0,0.4)]';

const GameCard: React.FC<GameCardProps> = ({ card }) => {
  const containerClasses = clsx(
    'flex flex-col overflow-hidden',
    cardBackground,
    dimensionClasses[card.type],
    neonAccentByType[card.type],
    {
      'pl-3 border-l-2 border-l-emerald-500/50 bg-[#151515]': card.type === CardType.MOD,
    }
  );

  return (
    <article className={containerClasses}>
      <header className="px-3 py-2 flex flex-col gap-0.5 font-['Roboto_Condensed',_sans-serif]">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gray-400">{card.subtitle}</p>
        <h3 className="text-lg font-semibold text-slate-50">{card.name}</h3>
      </header>
      <div className="flex-1 flex flex-col">
        <div className="h-36 flex items-center justify-center bg-black/80">
          {card.image ? (
            <img
              src={card.image}
              alt={card.name}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          ) : (
            <span className="text-xs text-gray-500 tracking-widest uppercase">No Image</span>
          )}
        </div>
        {card.description && (
          <p className="text-xs text-gray-300 px-3 py-2 leading-snug flex-1">
            {card.description}
          </p>
        )}
        {card.stats && card.stats.length > 0 && (
          <dl className="grid grid-cols-2 gap-2 px-3 py-3 text-xs text-gray-200 border-t border-gray-800">
            {card.stats.map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <dt className="text-[0.65rem] uppercase tracking-widest text-gray-500">{stat.label}</dt>
                <dd className={clsx('text-base font-semibold', stat.accent ? 'text-emerald-300' : 'text-gray-100')}>
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {card.tags && card.tags.length > 0 && (
          <footer className="px-3 py-2 border-t border-gray-800 text-[0.65rem] uppercase tracking-widest text-slate-300 flex flex-wrap gap-1">
            {card.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-800/60 text-sky-300">
                {tag}
              </span>
            ))}
          </footer>
        )}
      </div>
    </article>
  );
};

export default GameCard;
