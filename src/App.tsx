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

function useTextEditing() {
  const [text, setText] = useState<string>();
  const resolveRef = useRef<((value: string) => void) | undefined>();
  const rejectRef = useRef<((value?: unknown) => void) | undefined>();

  return {
    text,
    setText,
    isEditing: text != null,
    edit(text: string) {
      setText(text);
      return new Promise<string>((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;
      });
    },
    done() {
      resolveRef.current?.(text!);
      resolveRef.current = undefined;
      rejectRef.current = undefined;
      setText(undefined);
    },
    cancel() {
      resolveRef.current = undefined;
      rejectRef.current?.();
      rejectRef.current = undefined;
      setText(undefined);
    },
  };
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
    filter: saturate(0.6);
  }

  &[disabled] > * {
    filter: saturate(0.05);
    opacity: 0.5;
  }

  &:not([disabled]):active > * {
    filter: invert(1) hue-rotate(180deg);
    border-color: white;
  }
`;

function autoSizeTextarea(textarea: HTMLElement | null) {
  if (textarea == null) return;
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

export default function App() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Save the order of cards when they change.
  useEffect(() => {
    if (errIsDemoStack) return;
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

  // textEditing is used to edit the text of a card.
  const cardEditing = useTextEditing();

  // Reasons why an action can't be performed:
  let errIsDemoStack =
    stackStorage.stack === "/" &&
    "This button is disabled for this demo, but you'll be able to use it in your own stacks!";
  let errNoTopCard = cardsStorage.topCard == null && true;
  let errOneOrFewerCards = cardsStorage.cards.length <= 1 && true;
  let errIsEditing = cardEditing.isEditing && true;
  let errNoUndoHistory = cardsStorage.cardsUndoHistory.length <= 1 && true;

  function displayError(err: boolean | string) {
    if (typeof err === "string") alert(err);
    return err;
  }

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
            disabled={Boolean(errIsDemoStack)}
            onClick={async () => {
              if (displayError(errIsDemoStack)) return;

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
              cardsStorage.setCards([], true);
              cardEditing.cancel();

              await cardsStorage.loadCards(stackStorage.stack);
            }}
          >
            <Box
              title="Reload cards and order by date created"
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
            key={cardsStorage.topCard?.id}
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={Boolean(errNoTopCard || errIsDemoStack)}
            onClick={async () => {
              if (displayError(errNoTopCard || errIsDemoStack)) return;
              if (cardsStorage.topCard == null) return; // just for typescript

              if (cardEditing.isEditing) {
                cardEditing.done();
                return;
              }

              textareaRef.current?.select();

              let text;
              try {
                text = await cardEditing.edit(cardsStorage.topCard.fields.Text);
              } catch (e) {
                // The user cancelled editing.
                return;
              }

              if (!text || !text.trim()) return;
              textareaRef.current?.blur();
              window.getSelection?.()?.removeAllRanges();
              await cardsStorage.updateCardText(
                cardsStorage.topCard,
                text.trim(),
              );
            }}
          >
            <Box
              title="Edit card"
              className={[Border, cardEditing.isEditing && "primary"]}
              size="grow"
              flex="center"
            >
              <div>{cardEditing.isEditing ? "✅" : "✏️"}</div>
            </Box>
          </Box>

          <Box
            size="60rem"
            flex="x/stretch 0"
            className={Button}
            disabled={Boolean(errNoTopCard || errIsDemoStack || errIsEditing)}
            onClick={async () => {
              if (displayError(errNoTopCard || errIsDemoStack || errIsEditing))
                return;
              if (cardsStorage.topCard == null) return; // just for typescript

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
                <Box
                  tag="label"
                  flex="center-y"
                  size="grow"
                  readOnly={!cardEditing.isEditing}
                  className={[
                    Card(-3, -5),
                    css`
                      &:not([readonly]):focus-within {
                        border-color: #1e43eb;
                        border-color: SelectedItem;
                        box-shadow: inset 0 0 0 1px #1e43eb;
                        box-shadow: inset 0 0 0 1px SelectedItem;
                      }

                      cursor: text;
                      &[readonly] {
                        cursor: default;
                      }
                    `,
                  ]}
                >
                  <Box
                    tag="textarea"
                    className={css`
                      font: inherit;
                      resize: none;
                      box-sizing: content-box;
                      outline: none;
                      border: none;
                      text-align: inherit;
                      cursor: inherit;
                    `}
                    onInput={(e) => {
                      cardEditing.setText(e.currentTarget.value);
                      autoSizeTextarea(e.currentTarget);
                    }}
                    ref={(el) => {
                      textareaRef.current = el as HTMLTextAreaElement;
                      autoSizeTextarea(el);
                    }}
                    readOnly={!cardEditing.isEditing}
                    value={cardEditing.text ?? cardsStorage.topCard.fields.Text}
                  ></Box>
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
            disabled={Boolean(errNoUndoHistory || errIsEditing)}
            onClick={() => {
              if (displayError(errNoUndoHistory || errIsEditing)) return;

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
            disabled={Boolean(errOneOrFewerCards || errIsEditing)}
            onClick={() => {
              if (displayError(errOneOrFewerCards || errIsEditing)) return;

              cardsStorage.sendTopCardToBottom();
            }}
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
            disabled={Boolean(
              errOneOrFewerCards || errIsDemoStack || errIsEditing,
            )}
            onClick={() => {
              if (
                displayError(
                  errOneOrFewerCards || errIsDemoStack || errIsEditing,
                )
              )
                return;

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
            disabled={Boolean(errIsDemoStack || errIsEditing)}
            onClick={() => {
              if (displayError(errIsDemoStack || errIsEditing)) return;

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
            disabled={Boolean(
              errOneOrFewerCards || errIsDemoStack || errIsEditing,
            )}
            onClick={() => {
              if (
                displayError(
                  errOneOrFewerCards || errIsDemoStack || errIsEditing,
                )
              )
                return;

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
