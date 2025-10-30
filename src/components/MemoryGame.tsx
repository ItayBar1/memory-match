import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/memory-game.css';

type CardVariant = 'flag' | 'name';
type CardState = 'hidden' | 'revealed' | 'matched';

interface Card {
  id: string;
  countryKey: string;
  variant: CardVariant;
  label: string;
  imageSrc?: string;
  state: CardState;
}

interface CountryConfig {
  key: string;
  name: string;
  asset: string;
}

const SHUFFLE_DURATION = 1200;
const MATCH_SUCCESS_DURATION = 1200;
const MATCH_TOAST_DURATION = 1800;
const MISMATCH_HIDE_DELAY = 1100;

const countries: CountryConfig[] = [
  { key: 'united_states', name: 'ארצות הברית', asset: 'united_states.png' },
  { key: 'united_kingdom', name: 'בריטניה', asset: 'united_kingdom.png' },
  { key: 'romania', name: 'רומניה', asset: 'romania.png' },
  { key: 'iceland', name: 'איסלנד', asset: 'iceland.png' },
  { key: 'philippines', name: 'הפיליפינים', asset: 'philippines.png' },
  { key: 'greece', name: 'יוון', asset: 'greece.png' },
  { key: 'japan', name: 'יפן', asset: 'japan.png' },
  { key: 'mexico', name: 'מקסיקו', asset: 'mexico.png' },
  { key: 'israel', name: 'ישראל', asset: 'israel.png' },
  { key: 'egypt', name: 'מצרים', asset: 'egypt.svg' },
  { key: 'france', name: 'צרפת', asset: 'france.png' },
  { key: 'canada', name: 'קנדה', asset: 'canada.png' }
];

const buildDeck = (): Card[] => {
  return countries.flatMap((country) => {
    const flagSrc = new URL(`../../flags/${country.asset}`, import.meta.url).href;
    return [
      {
        id: `${country.key}-flag`,
        countryKey: country.key,
        variant: 'flag' as CardVariant,
        label: country.name,
        imageSrc: flagSrc,
        state: 'hidden' as CardState
      },
      {
        id: `${country.key}-name`,
        countryKey: country.key,
        variant: 'name' as CardVariant,
        label: country.name,
        state: 'hidden' as CardState
      }
    ];
  });
};

const shuffleCards = (cards: Card[]): Card[] => {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function MemoryGame() {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [isInteractionLocked, setIsInteractionLocked] = useState(false);
  const [recentMatch, setRecentMatch] = useState<{ country: string; id: number } | null>(null);
  const matchSequenceRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutsRef.current.push(timeoutId);
  }, []);

  const initializeGame = useCallback(() => {
    clearTimers();
    const freshDeck = shuffleCards(buildDeck());
    setCards(freshDeck);
    setSelectedIds([]);
    setHasWon(false);
    setRecentMatch(null);
    matchSequenceRef.current = 0;
    setIsGameActive(false);
    setIsInteractionLocked(true);
    setIsShuffling(true);
    scheduleTimeout(() => {
      setIsShuffling(false);
      setIsInteractionLocked(false);
      setIsGameActive(true);
    }, SHUFFLE_DURATION);
  }, [clearTimers, scheduleTimeout]);

  useEffect(() => {
    initializeGame();
    return () => clearTimers();
  }, [initializeGame, clearTimers]);

  useEffect(() => {
    if (isGameActive && cards.length === 0) {
      setHasWon(true);
      setIsGameActive(false);
    }
  }, [cards, isGameActive]);

  const resetSelections = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const concealCards = useCallback((cardIds: string[]) => {
    setCards((prev) =>
      prev.map((card) =>
        cardIds.includes(card.id)
          ? {
              ...card,
              state: 'hidden'
            }
          : card
      )
    );
  }, []);

  const removeMatchedCards = useCallback((cardIds: string[]) => {
    setCards((prev) => prev.filter((card) => !cardIds.includes(card.id)));
  }, []);

  const revealCard = useCallback((cardId: string) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              state: 'revealed'
            }
          : card
      )
    );
  }, []);

  const markCardsAsMatched = useCallback((cardIds: string[]) => {
    setCards((prev) =>
      prev.map((card) =>
        cardIds.includes(card.id)
          ? {
              ...card,
              state: 'matched'
            }
          : card
      )
    );
  }, []);

  const handleCardClick = useCallback(
    (card: Card) => {
      if (isInteractionLocked || !isGameActive) {
        return;
      }

      if (card.state !== 'hidden') {
        return;
      }

      revealCard(card.id);
      const nextSelection = [...selectedIds, card.id];
      setSelectedIds(nextSelection);

      if (nextSelection.length === 2) {
        setIsInteractionLocked(true);
        const [firstId, secondId] = nextSelection;
        const firstCard = cards.find((item) => item.id === firstId);
        const secondCard = cards.find((item) => item.id === secondId);

        if (firstCard && secondCard && firstCard.countryKey === secondCard.countryKey && firstCard.variant !== secondCard.variant) {
          markCardsAsMatched(nextSelection);
          matchSequenceRef.current += 1;
          const matchId = matchSequenceRef.current;
          setRecentMatch({ country: firstCard.label, id: matchId });
          scheduleTimeout(() => {
            removeMatchedCards(nextSelection);
            setIsInteractionLocked(false);
          }, MATCH_SUCCESS_DURATION);
          scheduleTimeout(() => {
            setRecentMatch((current) => (current && current.id === matchId ? null : current));
          }, MATCH_TOAST_DURATION);
          scheduleTimeout(() => {
            resetSelections();
          }, MATCH_SUCCESS_DURATION);
        } else {
          scheduleTimeout(() => {
            concealCards(nextSelection);
            setIsInteractionLocked(false);
          }, MISMATCH_HIDE_DELAY);
          scheduleTimeout(() => {
            resetSelections();
          }, MISMATCH_HIDE_DELAY);
        }

      }
    },
    [
      cards,
      concealCards,
      isGameActive,
      isInteractionLocked,
      markCardsAsMatched,
      removeMatchedCards,
      revealCard,
      resetSelections,
      scheduleTimeout
    ]
  );

  const statusMessage = useMemo(() => {
    if (isShuffling) {
      return 'מערבב את הקלפים...';
    }

    if (hasWon) {
      return 'כל הכבוד! מצאת את כל הזוגות.';
    }

    if (!isGameActive) {
      return 'לחצו על "התחל משחק חדש" כדי להתחיל.';
    }

    return 'בחרו שני כרטיסים בכל תור כדי למצוא זוגות תואמים.';
  }, [hasWon, isGameActive, isShuffling]);

  return (
    <div className="memory-game" dir="rtl">
      <header className="memory-game__header">
        <h1 className="memory-game__title">משחק זיכרון: מדינה ודגל</h1>
        <p className="memory-game__status">{statusMessage}</p>
        <button className="memory-game__button" onClick={initializeGame} disabled={isShuffling}>
          התחל משחק חדש
        </button>
      </header>

      {recentMatch && (
        <div className="memory-game__celebration" role="status" aria-live="polite">
          <span>מעולה! מצאתם את {recentMatch.country}</span>
        </div>
      )}

      <div className={`memory-game__board ${isShuffling ? 'memory-game__board--shuffling' : ''}`}>
        {cards.map((card) => (
          <button
            key={card.id}
            className={`memory-card memory-card--${card.variant} memory-card--${card.state}`}
            onClick={() => handleCardClick(card)}
            type="button"
            disabled={isInteractionLocked || card.state !== 'hidden'}
          >
            <div className="memory-card__inner">
              {card.variant === 'flag' && card.imageSrc ? (
                <img src={card.imageSrc} alt={`דגל ${card.label}`} className="memory-card__flag" />
              ) : (
                <span className="memory-card__label">{card.label}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {hasWon && (
        <div className="memory-game__overlay">
          <div className="memory-game__overlay-content">
            <h2>ניצחתם!</h2>
            <p>מצאתם את כל הזוגות. מוכנים לסיבוב נוסף?</p>
            <button className="memory-game__button" onClick={initializeGame}>
              שחקו שוב
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryGame;
