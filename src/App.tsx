import { css } from "@emotion/css";
import { useEffect, useState } from "react";
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

function useCardStorage(stack: string) {
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

    async loadCards() {
      let cards = await apiGetCards(stack);
      setCards(cards, true);
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

    async addCard(text: string) {
      let newCard = await apiCreateCard(stack, text);
      setCards([newCard, ...cards], true);
    },

    async shuffleCards() {
      let newCards = [...cards];
      for (let i = newCards.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
      }
      setCards(newCards);
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
  const stackStorage = useStackStorage();
  const storage = useCardStorage(stackStorage.stack);

  useEffect(() => {
    storage.loadCards();
  }, []);

  return (
    <>
      <Box
        className={css`
          background: #929694;
          height: 100svh;
          width: 100vw;
          max-width: 500rem;
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
            <Box className={Border} size="grow" flex="center">
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
            <Box className={Border} size="grow" flex="center">
              <div>🏠</div>
            </Box>
          </Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={storage.topCard == null}
            onClick={async () => {
              storage.loadCards();
            }}
          >
            <Box className={Border} size="grow" flex="center">
              <div>🔄</div>
            </Box>
          </Box>

          <Box size="grow" />

          <Box flex="center">Total: {storage.cards.length}</Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={storage.topCard == null}
            onClick={async () => {
              if (storage.topCard == null) return;
              let text = prompt("Edit card:", storage.topCard.fields.Text);
              if (!text || !text.trim()) return;
              await storage.updateCardText(storage.topCard, text.trim());
            }}
          >
            <Box className={Border} size="grow" flex="center">
              <div>✏️</div>
            </Box>
          </Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={storage.topCard == null}
            onClick={async () => {
              if (storage.topCard == null) return;
              if (!confirm("Delete this card?")) return;
              await storage.deleteCard(storage.topCard);
            }}
          >
            <Box className={Border} size="grow" flex="center">
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
          {storage.topCard && (
            <>
              <Box
                flex="center"
                size="grow"
                className={css`
                  position: relative;
                `}
              >
                {storage.cards.length >= 4 && (
                  <Box size="grow" className={Card(6, 10)} />
                )}
                {storage.cards.length >= 3 && (
                  <Box size="grow" className={Card(3, 5)} />
                )}
                {storage.cards.length >= 2 && (
                  <Box size="grow" className={Card(0, 0)} />
                )}
                <Box flex="center-y" size="grow" className={Card(-3, -5)}>
                  <div>{storage.topCard.fields.Text}</div>
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
            disabled={storage.cardsUndoHistory.length < 2}
            onClick={() => {
              if (storage.cardsUndoHistory.length < 2) return;
              storage.undo();
            }}
          >
            <Box className={Border} size="grow" flex="center">
              <div>⏮️</div>
            </Box>
          </Box>

          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled={storage.cards.length < 2}
            onClick={storage.sendTopCardToBottom}
          >
            <Box className={Border} size="grow" flex="center">
              <div>↘️</div>
            </Box>
          </Box>

          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled={storage.cards.length < 2}
            onClick={storage.sendTopCardToRandom}
          >
            <Box className={Border} size="grow" flex="center">
              <div>➡️</div>
            </Box>
          </Box>
        </Box>

        <Box padding="0/20rem" size="60rem" flex="x/stretch 20rem">
          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            onClick={() => {
              let text = prompt("Add new card:", storage.topCard?.fields.Text);
              if (!text || !text.trim()) return;
              storage.addCard(text);
            }}
          >
            <Box className={Border} size="grow" flex="center">
              <div>❇️</div>
            </Box>
          </Box>
          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled={storage.cards.length < 2}
            onClick={storage.shuffleCards}
          >
            <Box className={Border} size="grow" flex="center">
              <div>&nbsp;🔀&nbsp;</div>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
