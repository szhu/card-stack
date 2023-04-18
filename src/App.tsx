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

function useCardStorage() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const topCard = cards[0];

  return {
    cards,
    topCard: topCard as CardRecord | undefined,

    async loadCards() {
      let cards = await apiGetCards();
      setCards(cards);
    },

    async updateCardText(card: CardRecord, text: string) {
      if (card == null) return;

      card.fields = await apiUpdateCardText(card.id, text);
      setCards([...cards]);
    },

    async deleteCard(card: CardRecord) {
      if (card == null) return;

      await apiDeleteCard(card.id);
      setCards(cards.filter((c) => c.id !== card.id));
    },

    async addCard(text: string) {
      let newCard = await apiCreateCard(text);
      setCards([newCard, ...cards]);
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

    setCards,
  } as const;
}

const Border = css`
  border: 1px solid rgba(0, 0, 0, 0.5);
  border-radius: 8rem;
  background: white;
`;

const Button = css`
  cursor: pointer;
  user-select: none;
  padding: 10rem;
  margin: -10rem;

  &[disabled] {
    opacity: 0.5;
  }

  &:not([disabled]):active > * {
    filter: invert(1) hue-rotate(180deg);
    border-color: white;
  }
`;

export default function App() {
  const storage = useCardStorage();

  useEffect(() => {
    storage.loadCards();
  }, []);

  return (
    <>
      <Box
        className={css`
          background: white;
          height: 100svh;
          width: 100vw;
          max-width: 500rem;
          margin: 0 auto;
          padding: 20rem 0 40rem;
        `}
        flex="y/stretch 20rem"
      >
        <Box padding="0/20rem" size="30rem" flex="x/stretch 20rem">
          <Box size="grow" />

          <Box flex="center">Total: {storage.cards.length}</Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={storage.topCard == null}
            onClick={async () => {
              if (storage.topCard == null) return;
              let text = prompt("Enter text:");
              if (!text || !text.trim()) return;
              await storage.updateCardText(storage.topCard, text);
            }}
          >
            <Box className={Border} size="grow" flex="center">
              <div>📝</div>
            </Box>
          </Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={storage.topCard == null}
            onClick={async () => {
              if (storage.topCard == null) return;
              if (!confirm("Are you sure?")) return;
              await storage.deleteCard(storage.topCard);
            }}
          >
            <Box className={Border} size="grow" flex="center">
              <div>🗑️</div>
            </Box>
          </Box>
        </Box>

        <Box padding="0/20rem" size="grow" flex="x/stretch 0">
          {storage.topCard && (
            <Box
              flex="center"
              size="grow"
              className={[
                Border,
                css`
                  font: var(--font-l);
                `,
              ]}
            >
              <div>{storage.topCard.fields.Text}</div>
            </Box>
          )}
        </Box>

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

        <Box padding="0/20rem" size="40rem" flex="x/stretch 20rem">
          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            disabled
            onClick={() => {}}
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

        <Box padding="0/20rem" size="40rem" flex="x/stretch 20rem">
          <Box
            size="grow"
            flex="x/stretch 0"
            className={Button}
            onClick={() => {
              let text = prompt("Enter text:");
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

      {/* <div
        className={css`
          color: white;
        `}
      >
        <fieldset>
          <legend>Cards</legend>
          <pre
            className={css`
              white-space: pre-wrap;
            `}
          >
            {JSON.stringify(storage.cards, null, 2)}
          </pre>
        </fieldset>

        <fieldset>
          <legend>Current Card</legend>
          <pre
            className={css`
              white-space: pre-wrap;
            `}
          >
            {JSON.stringify(storage.topCard, null, 2)}
          </pre>
        </fieldset>

        <fieldset>
          <legend>Controls</legend>
          <button onClick={() => settopCard(storage.cards[0])}>First</button>
          <button onClick={() => storage.loadCards()}>Reload</button>
          <button
            onClick={() => storage.updateCardText(storage.topCard, "Hello")}
          >
            Update
          </button>
        </fieldset>
      </div> */}
    </>
  );
}
