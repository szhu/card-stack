import { css } from "@emotion/css";
import { useEffect, useRef, useState } from "react";
import { Box } from "./DS23";
import {
  CardRecord,
  apiCreateCard,
  apiDeleteCard,
  apiGetCards,
  apiUpdateCardText,
} from "./api";

function useStackStorage() {
  const stack = decodeURI(location.pathname);
  const prettyStack = stack.replace(/^\/(stack\/)?/, "");

  const self = {
    stack,

    setStack(newStack: string) {
      if (newStack === stack) return;
      location.pathname = encodeURI(newStack);
    },

    prettyStack,

    setPrettyStack(newPrettyStack: string) {
      newPrettyStack = newPrettyStack.trim();
      if (!newPrettyStack) {
        self.setStack("/");
      } else {
        self.setStack(`/stack/${newPrettyStack}`);
      }
    },
  };
  return self;
}

function useStructuredLocalStorage<T>(
  key: string,
  defaultValue: T,
  serialize: (value: T) => string,
  deserialize: (value: string) => T,
) {
  const hasInitializedRef = useRef(false);
  const valueRef = useRef<T>();

  if (!hasInitializedRef.current) {
    const storedValue = localStorage.getItem(key);
    if (storedValue != null) {
      valueRef.current = deserialize(storedValue);
    } else {
      valueRef.current = defaultValue;
    }
    hasInitializedRef.current = true;
  }

  const setValue = (newValue: T) => {
    if (newValue === defaultValue) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, serialize(newValue));
    }
    valueRef.current = newValue;
  };

  return [valueRef.current as T, setValue] as const;
}

function shuffle<T>(items: T[]) {
  let newCards = [...items];
  for (let i = newCards.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
  }
  return newCards;
}

function orderCardsByArray(cards: CardRecord[], order: string[]) {
  let orderIdsSet = new Set(order);
  let idToCardMap = new Map(cards.map((card) => [card.id, card]));

  let orderedCards = [];
  for (let card of cards) {
    if (!orderIdsSet.has(card.id)) {
      orderedCards.push(card);
      idToCardMap.delete(card.id);
    }
  }

  for (let id of order) {
    let card = idToCardMap.get(id);
    if (card != null) {
      orderedCards.push(card);
      idToCardMap.delete(id);
    }
  }

  // Sanity check
  if (idToCardMap.size > 0) {
    // Error: Some cards were not placed in `orderedCards`.
    debugger;
  }

  return orderedCards;
}

function useCardStorage() {
  const [cardsUndoHistory, setCardsUndoHistory] = useState<CardRecord[][]>([]);

  const cards = cardsUndoHistory[0] ?? [];
  function setCards(cards: CardRecord[], clearUndoHistory = false) {
    if (clearUndoHistory) {
      setCardsUndoHistory([cards]);
    } else {
      setCardsUndoHistory([cards, ...cardsUndoHistory]);
    }
  }

  const topCard = cards[0];

  return {
    cardsUndoHistory,
    cards,
    topCard: topCard as CardRecord | undefined,

    async loadCards(stack: string, orderedIds?: string[] | "shuffle") {
      let cards = await apiGetCards(stack);

      let orderedCards;
      if (orderedIds == null) {
        orderedCards = cards;
      } else if (orderedIds === "shuffle") {
        orderedCards = shuffle(cards);
      } else {
        orderedCards = orderCardsByArray(cards, orderedIds);
      }

      setCards(orderedCards, true);
    },

    async updateCardText(card: CardRecord, text: string) {
      if (card == null) return;

      card.fields = await apiUpdateCardText(card.id, text);
      setCards([...cards]);
    },

    async deleteCard(card: CardRecord) {
      if (card == null) return;

      await apiDeleteCard(card.id);
      setCards(
        cards.filter((c) => c.id !== card.id),
        true,
      );
    },

    async addCard(stack: string, text: string) {
      let newCard = await apiCreateCard(stack, text);
      setCards([newCard, ...cards], true);
    },

    async shuffleCards() {
      setCards(shuffle(cards));
    },

    sendTopCardToBottom() {
      if (cards.length < 1) return;

      let [topCard, ...restCards] = cards;
      setCards([...restCards, topCard]);
    },

    sendTopCardToRandom() {
      if (cards.length < 1) return;

      let [topCard, ...restCards] = cards;
      let randomIndex = Math.floor(Math.random() * restCards.length) + 1;
      restCards.splice(randomIndex, 0, topCard);
      setCards(restCards);
    },

    undo() {
      setCardsUndoHistory(cardsUndoHistory.slice(1));
    },

    clearCardsUndoHistory() {
      setCardsUndoHistory([]);
    },

    setCards,
  } as const;
}

const Border = css`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 20rem;
  background: white;
`;

function Card(left: number, top: number) {
  return css`
    white-space: pre-wrap;
    border: 1px solid rgba(0, 0, 0, 0.7);
    border-radius: 8rem;
    background: white;
    font: var(--font-card);
    text-align: center;
    position: absolute;
    width: 100%;
    height: 100%;
    padding: 10rem;
    top: ${top}rem;
    left: ${left}rem;
    user-select: text;
  `;
}

const Button = css`
  cursor: pointer;
  user-select: none;
  padding: 10rem;
  margin: -10rem;

  & > * {
    filter: saturate(0.05);
  }

  &[disabled] {
    opacity: 0.5;
  }

  &:not([disabled]):active > * {
    filter: invert(1) hue-rotate(180deg);
    border-color: white;
  }
`;

export default function App() {
  // stackStorage keeps track of the current stack name.
  const stackStorage = useStackStorage();

  // cardsStorage keeps track of the current cards and undo history.
  const cardsStorage = useCardStorage();

  // orderedIds is a cached version of the order of cards
  const [orderedIds, setOrderedIds] = useStructuredLocalStorage(
    `CardStack.storage.cardsOrder:${stackStorage.prettyStack}`,
    [] as string[],
    (value) => value.join("\n"),
    (value) => value.split("\n"),
  );

  // Check if the current stack is the demo stack.
  function isDemoStack(doAlert = false) {
    let result = stackStorage.stack === "/";

    if (result && doAlert) {
      alert(
        "This button isn't available in the demo stack, but you'll be able to use it in your own stacks!",
      );
    }

    return result;
  }

  // Save the order of cards when they change.
  useEffect(() => {
    if (isDemoStack()) return;
    if (cardsStorage.cards.length === 0) return;

    setOrderedIds(cardsStorage.cards.map((card) => card.id));
  }, [cardsStorage.cards]);

  // Load cards when the stack changes.
  useEffect(() => {
    let order;
    if (stackStorage.stack === "/") {
      order = undefined;
    } else if (orderedIds.length > 0) {
      order = orderedIds;
    } else {
      order = "shuffle" as const;
    }

    cardsStorage.loadCards(stackStorage.stack, order);
  }, [stackStorage.stack]);

  return (
    <>
      <Box
        className={css`
          background: #929694;
          height: 100svh;
          width: 100vw;
          max-width: 550rem;
          margin: 0 auto;
          padding: 20rem 0 40rem;
        `}
        flex="y/stretch 20rem"
      >
        <Box padding="0/20rem" size="40rem" flex="x/stretch 10rem">
          <Box
            flex="center"
            className={css`
              font: var(--font-title);
            `}
          >
            CardStack
          </Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            onClick={async () => {
              stackStorage.setPrettyStack("");
            }}
          >
            <Box title="Help" className={Border} size="grow" flex="center">
              <div>❓</div>
            </Box>
          </Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            onClick={async () => {
              let text = prompt(
                "Switch to another stack?",
                stackStorage.prettyStack,
              );
              if (!text || !text.trim()) return;
              stackStorage.setPrettyStack(text ?? "");
            }}
          >
            <Box
              title="Switch to another card stack"
              className={Border}
              size="grow"
              flex="center"
            >
              <div>🏠</div>
            </Box>
          </Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={cardsStorage.topCard == null}
            onClick={async () => {
              cardsStorage.loadCards(stackStorage.stack);
            }}
          >
            <Box
              title="Refresh cards"
              className={Border}
              size="grow"
              flex="center"
            >
              <div>🔄</div>
            </Box>
          </Box>

          <Box size="grow" />

          <Box flex="center">Total: {cardsStorage.cards.length}</Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={cardsStorage.topCard == null || isDemoStack()}
            onClick={async () => {
              if (cardsStorage.topCard == null || isDemoStack(true)) return;
              let text = prompt("Edit card:", cardsStorage.topCard.fields.Text);
              if (!text || !text.trim()) return;
              await cardsStorage.updateCardText(
                cardsStorage.topCard,
                text.trim(),
              );
            }}
          >
            <Box title="Edit card" className={Border} size="grow" flex="center">
              <div>✏️</div>
            </Box>
          </Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={cardsStorage.topCard == null || isDemoStack()}
            onClick={async () => {
              if (cardsStorage.topCard == null || isDemoStack(true)) return;
              if (!confirm("Delete this card?")) return;
              await cardsStorage.deleteCard(cardsStorage.topCard);
            }}
          >
            <Box
              title="Delete card"
              className={Border}
              size="grow"
              flex="center"
            >
              <div>🗑️</div>
            </Box>
          </Box>
        </Box>

        <Box size="grow" />

        <Box
          padding="0/20rem"
          flex="x/stretch 0"
          className={css`
            aspect-ratio: 1/1;
          `}
        >
          {cardsStorage.topCard && (
            <>
              <Box
                flex="center"
                size="grow"
                className={css`
                  position: relative;
                `}
              >
                {cardsStorage.cards.length >= 4 && (
                  <Box size="grow" className={Card(6, 10)} />
                )}
                {cardsStorage.cards.length >= 3 && (
                  <Box size="grow" className={Card(3, 5)} />
                )}
                {cardsStorage.cards.length >= 2 && (
                  <Box size="grow" className={Card(0, 0)} />
                )}
                <Box flex="center-y" size="grow" className={Card(-3, -5)}>
                  <div>{cardsStorage.topCard.fields.Text}</div>
                </Box>
              </Box>
            </>
          )}
        </Box>

        <Box size="grow" />

        {/* <Box
            flex="center-x"
            className={css`
              gap: 10rem;
            `}
          >
            {storage.cards.map((card) => (
              <Box> {card.fields.Text}</Box>
            ))}
          </Box> */}

        <Box padding="0/20rem" size="60rem" flex="x/stretch 20rem">
          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled={cardsStorage.cardsUndoHistory.length < 2}
            onClick={() => {
              if (cardsStorage.cardsUndoHistory.length < 2) return;
              cardsStorage.undo();
            }}
          >
            <Box
              title="View previously seen card"
              className={Border}
              size="grow"
              flex="center"
            >
              <div>⏮️</div>
            </Box>
          </Box>

          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled={cardsStorage.cards.length < 2}
            onClick={cardsStorage.sendTopCardToBottom}
          >
            <Box
              title="Move this card to the bottom of the stack"
              className={Border}
              size="grow"
              flex="center"
            >
              <div>↘️</div>
            </Box>
          </Box>

          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled={cardsStorage.cards.length < 2 || isDemoStack()}
            onClick={() => {
              if (isDemoStack(true)) return;
              cardsStorage.sendTopCardToRandom();
            }}
          >
            <Box
              title="Move this card to somewhere in the middle of the stack"
              className={Border}
              size="grow"
              flex="center"
            >
              <div>➡️</div>
            </Box>
          </Box>
        </Box>

        <Box padding="0/20rem" size="60rem" flex="x/stretch 20rem">
          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled={isDemoStack()}
            onClick={() => {
              if (isDemoStack(true)) return;
              let text = prompt("Add new card:");
              if (!text || !text.trim()) return;
              cardsStorage.addCard(stackStorage.stack, text);
            }}
          >
            <Box
              title="Create new card"
              className={Border}
              size="grow"
              flex="center"
            >
              <div>❇️</div>
            </Box>
          </Box>
          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled={cardsStorage.cards.length < 2 || isDemoStack()}
            onClick={() => {
              if (isDemoStack(true)) return;
              cardsStorage.shuffleCards();
            }}
          >
            <Box
              title="Shuffle all cards in this stack"
              className={Border}
              size="grow"
              flex="center"
            >
              <div>&nbsp;🔀&nbsp;</div>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
