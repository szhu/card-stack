import { css } from "@emotion/css";
import { useEffect, useRef, useState } from "react";
import Button from "./Button";
import { Box } from "./DS23";
import { useModalWindow } from "./ModalWindow";
import {
  CardRecord,
  apiCreateCard,
  apiDeleteCard,
  apiGetCards,
  apiUpdateCardText,
} from "./api";

/**
 * useEffect, but as a component.
 */
const Effect: React.FC<{
  fn: React.EffectCallback;
  deps?: React.DependencyList;
}> = (props) => {
  useEffect(props.fn, props.deps);
  return null;
};

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
  interface Return {
    current: T;
    set: (newValue: T) => void;
  }
  const returnRef = useRef<Return>();

  if (returnRef.current == null) {
    const storedValue = localStorage.getItem(key);
    let newValue =
      storedValue != null ? deserialize(storedValue) : defaultValue;
    returnRef.current = {
      current: newValue,
      set(newValue: T) {
        if (newValue === defaultValue) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, serialize(newValue));
        }
        returnRef.current!.current = newValue;
      },
    };
  }

  return returnRef.current;
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

function useDerivedState<B, D, O extends unknown[]>(
  baseState: B,
  setBaseState: (newBaseState: React.SetStateAction<B>) => void,
  derive: (baseState: B) => D,
  merge: (baseState: B, derivedState: D, ...opts: O) => B,
) {
  const derivedState = derive(baseState);

  const setDerivedState = (
    setDerivedStateAction: React.SetStateAction<D>,
    ...opts: O
  ) => {
    setBaseState((oldBaseState) => {
      let oldDerivedState = derive(oldBaseState);
      let newDerivedState =
        typeof setDerivedStateAction === "function"
          ? (setDerivedStateAction as (prevState: D) => D)(oldDerivedState)
          : setDerivedStateAction;

      return merge(oldBaseState, newDerivedState, ...opts);
    });
  };

  return [derivedState, setDerivedState] as const;
}

function useCardStorage() {
  const [cardsUndoHistory, setCardsUndoHistory] = useState<CardRecord[][]>([]);

  const [cards, setCards] = useDerivedState<
    CardRecord[][],
    CardRecord[],
    [clearUndoHistory?: boolean]
  >(
    cardsUndoHistory,
    setCardsUndoHistory,
    (cardsUndoHistory) => cardsUndoHistory[0] ?? [],
    (cardsUndoHistory, newCards, clearUndoHistory) => {
      let [currentCards] = cardsUndoHistory;

      if (currentCards === newCards) return cardsUndoHistory;

      if (clearUndoHistory) {
        return [newCards];
      } else {
        return [newCards, ...cardsUndoHistory];
      }
    },
  );

  return {
    cardsUndoHistory,
    cards,
    topCard: cards[0] as CardRecord | undefined,

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
      setCards((oldCards) => oldCards);
    },

    async deleteCard(card: CardRecord) {
      if (card == null) return;

      await apiDeleteCard(card.id);
      setCards((oldCards) => oldCards.filter((c) => c.id !== card.id), true);
    },

    async addCard(stack: string, text: string) {
      let newCard = await apiCreateCard(stack, text);
      setCards((oldCards) => [newCard, ...oldCards], true);
    },

    async shuffleCards() {
      setCards((oldCards) => shuffle(oldCards));
    },

    sendTopCardToBottom() {
      setCards((oldCards) => {
        if (oldCards.length < 1) return oldCards;

        let [topCard, ...restCards] = oldCards;

        return [...restCards, topCard];
      });
    },

    sendTopCardToRandom() {
      setCards((oldCards) => {
        if (oldCards.length < 1) return oldCards;

        let [topCard, ...restCards] = oldCards;
        let randomIndex = Math.floor(Math.random() * restCards.length) + 1;
        restCards.splice(randomIndex, 0, topCard);
        return restCards;
      });
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
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState<string>();
  const [reason, setReason] = useState<string>();

  const resolveRef = useRef<
    ((value: string | undefined) => void) | undefined
  >();

  return {
    text,
    reason,
    setText,
    isEditing,
    edit(text: string, reason?: string) {
      setReason(reason);
      setText(text);
      setIsEditing(true);
      return new Promise<string | undefined>((resolve) => {
        resolveRef.current = resolve;
      });
    },
    done() {
      resolveRef.current?.(text!);
      resolveRef.current = undefined;
      setIsEditing(false);
    },
    cancel() {
      resolveRef.current?.(undefined);
      resolveRef.current = undefined;
      setText(undefined);
      setReason(undefined);
      setIsEditing(false);
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
    top: ${top * 1.5}rem;
    left: ${left * 1.5}rem;
    user-select: text;
  `;
}

const ButtonStyle = css`
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

function useVisualViewportAspectRatio() {
  const getValue = () =>
    visualViewport ? visualViewport.width / visualViewport.height : 1;
  const [aspectRatio, setAspectRatio] = useState<number>(getValue);

  useEffect(() => {
    const updateValue = () => setAspectRatio(getValue);
    visualViewport?.addEventListener("resize", updateValue);
    return () => visualViewport?.removeEventListener("resize", updateValue);
  }, []);

  return aspectRatio;
}

export default function App() {
  // stackStorage keeps track of the current stack name.
  const stackStorage = useStackStorage();

  // cardsStorage keeps track of the current cards and undo history.
  const cardsStorage = useCardStorage();

  // orderedIds is a cached version of the order of cards
  const orderedIds = useStructuredLocalStorage(
    `CardStack.storage.cardsOrder:${stackStorage.prettyStack}`,
    [] as string[],
    (value) => value.join("\n"),
    (value) => value.split("\n"),
  );

  // Save the order of cards when they change.
  useEffect(() => {
    if (errIsDemoStack) return;
    if (cardsStorage.cards.length === 0) return;

    orderedIds.set(cardsStorage.cards.map((card) => card.id));
  }, [cardsStorage.cards]);

  // Load cards when the stack changes.
  useEffect(() => {
    let order;
    if (stackStorage.stack === "/") {
      order = undefined;
    } else if (orderedIds.current.length > 0) {
      order = orderedIds.current;
    } else {
      order = "shuffle" as const;
    }

    babysitAsyncAction(
      cardsStorage.loadCards(stackStorage.stack, order),
      "Loading",
    );
  }, [stackStorage.stack]);

  // textEditing is used to edit the text of a card.
  const cardEditing = useTextEditing();

  // textarea connects cardEditing to the card textarea.
  const cardTextarea = {
    ref: useRef<HTMLTextAreaElement | null>(null),
    // select() {
    //   if (cardTextarea.ref.current == null) return;
    //   cardTextarea.ref.current.focus();
    //   cardTextarea.ref.current.select();
    // },
    blur() {
      if (cardTextarea.ref.current == null) return;
      cardTextarea.ref.current.blur();
      window.getSelection?.()?.removeAllRanges();
    },
    async edit(initialText: string, reason: string) {
      let text = await cardEditing.edit(initialText, reason);
      cardTextarea.blur();
      return text?.trim();
    },
  };

  useEffect(() => {
    const handler = () => {
      autoSizeTextarea(cardTextarea.ref.current);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // modalWindow is used to display alerts, prompts, and confirmations.
  const modalWindow = useModalWindow();

  // statusMessage is used to display a status message at the top of the screen.
  const [statusMessage, setStatusMessage] = useState<string | undefined>();

  // Detect whether the software keyboard is obscuring parts of the screen.
  // https://stackoverflow.com/a/74962180/782045
  const viewportIsSquareIsh = useVisualViewportAspectRatio() > 0.75;

  // Reasons why an action can't be performed:
  let errIsDemoStack =
    stackStorage.stack === "/" &&
    "This action is disabled for this demo, but you'll be able to use it when you're making your own card stacks!";
  let errAlreadyAtDemoStack = stackStorage.stack === "/" && true;
  let errNoTopCard = cardsStorage.topCard == null && true;
  let errOneOrFewerCards = cardsStorage.cards.length <= 1 && true;
  let errIsEditing = cardEditing.isEditing && true;
  let errNoUndoHistory = cardsStorage.cardsUndoHistory.length <= 1 && true;
  let errIsSaving =
    (statusMessage === "Saving" || statusMessage === "Deleting") && true;

  async function displayError(err: boolean | string) {
    if (typeof err === "string") await modalWindow.alert(err);
    return err;
  }

  function disabledAndOnClick(err: boolean | string, onClick: () => void) {
    return {
      disabled: !!err,
      onClick: async () => {
        if (await displayError(err)) return;
        return onClick();
      },
    } as const;
  }

  function babysitAsyncAction(promise: Promise<void>, statusMessage: string) {
    setStatusMessage(statusMessage);
    return promise
      .then(() => {
        setStatusMessage(undefined);
      })
      .catch((e) => {
        setStatusMessage("ERROR");
        throw e;
      });
  }

  const cardText =
    cardEditing.isEditing || errIsSaving
      ? cardEditing.text
      : cardsStorage.topCard?.fields.Text;

  return (
    <>
      <Box
        className={css`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
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

          <Button
            theme="circle"
            icon="❓"
            title="Help"
            {...disabledAndOnClick(errAlreadyAtDemoStack, async () => {
              if (
                await modalWindow.confirm(
                  "Would you like to view the CardStack tutorial?",
                  {
                    okText: "View",
                    cancelText: "Cancel",
                  },
                )
              ) {
                stackStorage.setPrettyStack("");
              }
            })}
          />

          <Button
            theme="circle"
            icon="🏠"
            title="Switch to another card stack"
            {...disabledAndOnClick(false, async () => {
              let text = await modalWindow.prompt(
                "Switch to or create a stack named:",
                stackStorage.prettyStack,
              );
              text = text?.trim() ?? "";
              if (!text) return;
              stackStorage.setPrettyStack(text);
            })}
          />

          <Button
            theme="circle"
            icon="🔄"
            title="Reload cards"
            {...disabledAndOnClick(false, async () => {
              let resetOrder = await modalWindow.confirm(
                "Also reset card order to date created?",
                {
                  okText: "Reset",
                  cancelText: "Keep ",
                },
              );

              cardsStorage.setCards([], true);
              cardEditing.cancel();

              babysitAsyncAction(
                cardsStorage.loadCards(
                  stackStorage.stack,
                  resetOrder ? undefined : orderedIds.current,
                ),
                "Loading",
              );
            })}
          />

          <Box flex="center">
            {statusMessage != null ? (
              <em>{statusMessage}</em>
            ) : (
              <>{cardsStorage.cards.length} cards</>
            )}
          </Box>

          <Box size="grow" />

          <Button
            theme="circle"
            icon="✏️"
            title="Edit card"
            {...disabledAndOnClick(
              errNoTopCard || errIsDemoStack || errIsEditing || errIsSaving,
              async () => {
                if (cardsStorage.topCard == null) return; // just for typescript

                let text = await cardTextarea.edit(
                  cardsStorage.topCard.fields.Text,
                  "Edit this card",
                );
                if (!text) return;

                await babysitAsyncAction(
                  cardsStorage.updateCardText(cardsStorage.topCard, text),
                  "Saving",
                );
              },
            )}
          />

          <Button
            theme="circle"
            icon="🗑️"
            title="Delete card"
            {...disabledAndOnClick(
              errNoTopCard || errIsDemoStack || errIsEditing || errIsSaving,
              async () => {
                if (cardsStorage.topCard == null) return; // just for typescript

                if (
                  !(await modalWindow.confirm("Delete this card?", {
                    okText: "Delete",
                    cancelText: "Cancel",
                    danger: true,
                  }))
                )
                  return;

                await babysitAsyncAction(
                  cardsStorage.deleteCard(cardsStorage.topCard),
                  "Deleting",
                );
              },
            )}
          />
        </Box>

        <Box size="grow" />

        <Box
          padding="0/20rem"
          flex="x/stretch 0"
          className={css`
            aspect-ratio: 1/1;
          `}
        >
          {(cardsStorage.topCard || cardEditing.isEditing) && (
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
                      padding: ${viewportIsSquareIsh ? "50rem 10rem" : "10rem"};
                      transition: padding 0.2s ease-in-out;

                      &:not([readonly]):focus-within {
                        border-color: black;
                        border-color: SelectedItem;
                        box-shadow: inset 0 0 0 max(1px, 3rem) black;
                        box-shadow: inset 0 0 0 max(1px, 3rem) SelectedItem;
                      }

                      cursor: text;
                      &[readonly] {
                        cursor: default;
                      }
                    `,
                  ]}
                >
                  <Effect
                    fn={() => {
                      autoSizeTextarea(cardTextarea.ref.current);
                    }}
                    deps={[cardText]}
                  />
                  <Effect
                    fn={() => {
                      if (cardEditing.isEditing && cardTextarea.ref.current) {
                        let el = cardTextarea.ref.current;
                        el.focus();
                        el.setSelectionRange(el.value.length, el.value.length);
                      }
                    }}
                    deps={[cardEditing.isEditing]}
                  />
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
                      overscroll-behavior: contain;

                      filter: ${errIsSaving && "blur(5px)"};
                    `}
                    onInput={(e) => {
                      cardEditing.setText(e.currentTarget.value);
                    }}
                    ref={cardTextarea.ref}
                    readOnly={!cardEditing.isEditing}
                    value={cardText}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.altKey &&
                        (e.metaKey || e.ctrlKey)
                      ) {
                        e.preventDefault();
                        cardEditing.done();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        // Is it safe to discard?
                        if (
                          !cardEditing.text ||
                          cardEditing.text === cardsStorage.topCard?.fields.Text
                        ) {
                          cardEditing.cancel();
                        }
                      }
                    }}
                  />
                </Box>

                <Box
                  className={css`
                    position: absolute;
                    top: ${viewportIsSquareIsh ? "0rem" : "-40rem"};
                    transition: top 0.2s ease-in-out;
                    left: 0;
                    right: 0;
                    visibility: ${cardEditing.isEditing ? "visible" : "hidden"};
                  `}
                  flex="center-x"
                >
                  <Box className={Border} padding="10rem/20rem">
                    <big>{cardEditing.reason}</big>
                  </Box>
                </Box>

                <Box
                  className={css`
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: ${viewportIsSquareIsh ? "20rem" : "-30rem"};
                    transition: bottom 0.2s ease-in-out;
                    height: 40rem;
                    visibility: ${cardEditing.isEditing ? "visible" : "hidden"};
                  `}
                  flex="x/stretch 20rem"
                >
                  <Box size="grow" />

                  <Button
                    theme="card-editing"
                    icon="❌"
                    text="Cancel"
                    onClick={cardEditing.cancel}
                  />

                  <Button
                    theme="card-editing"
                    icon="✅"
                    text="Save"
                    onClick={cardEditing.done}
                  />

                  <Box size="grow" />
                </Box>
              </Box>
            </>
          )}
        </Box>

        <Box size="grow" />

        <Box padding="0/20rem" size="60rem" flex="x/stretch 20rem">
          <Button
            theme="bottom-row"
            icon="⏮️"
            title="View previously seen card"
            {...disabledAndOnClick(
              errNoUndoHistory || errIsEditing || errIsSaving,
              cardsStorage.undo,
            )}
          />

          <Button
            theme="bottom-row"
            icon="↘️"
            title="Move this card to the bottom of the stack"
            {...disabledAndOnClick(
              errOneOrFewerCards || errIsEditing || errIsSaving,
              cardsStorage.sendTopCardToBottom,
            )}
          />

          <Button
            theme="bottom-row"
            icon="➡️"
            title="Move this card to somewhere in the middle of the stack"
            {...disabledAndOnClick(
              errOneOrFewerCards ||
                errIsDemoStack ||
                errIsEditing ||
                errIsSaving,
              cardsStorage.sendTopCardToRandom,
            )}
          />
        </Box>

        <Box padding="0/20rem" size="60rem" flex="x/stretch 20rem">
          <Button
            theme="bottom-row"
            icon="❇️"
            title="Create new card"
            {...disabledAndOnClick(
              errIsDemoStack || errIsEditing || errIsSaving,
              async () => {
                let text = await cardTextarea.edit("", "Add new card");
                if (!text) return;

                await babysitAsyncAction(
                  cardsStorage.addCard(stackStorage.stack, text),
                  "Saving",
                );
              },
            )}
          />

          <Button
            theme="bottom-row"
            icon="🔀"
            title="Shuffle all cards in this stack"
            {...disabledAndOnClick(
              errOneOrFewerCards ||
                errIsDemoStack ||
                errIsEditing ||
                errIsSaving,
              cardsStorage.shuffleCards,
            )}
          />
        </Box>
      </Box>
      {modalWindow.node}
    </>
  );
}
