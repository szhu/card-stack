import { css } from "@emotion/css";
import Balancer from "react-wrap-balancer";

import { useRef, useState } from "react";
import Button from "./Button";
import { Box } from "./DS23";

type ModalProps =
  | {
      type: "alert";
      text: string;
      resolve: (value?: true | undefined) => void;
      options: ModalOptions;
    }
  | {
      type: "confirm";
      text: string;
      resolve: (value: true | undefined) => void;
      options: ModalOptions;
    }
  | {
      type: "prompt";
      text: string;
      defaultValue: string;
      resolve: (value: string | undefined) => void;
      options: ModalOptions;
    }
  | {
      type: undefined;
    };

interface ModalOptions {
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

const ModalWindow: React.FC<ModalProps> = (props) => {
  let inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      {props.type != null && (
        <Box
          tag="label"
          tabIndex={-1}
          ref={(el) => {
            el?.focus();
            el?.querySelector("input")?.select();
          }}
          flex="center"
          className={css`
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(2px);
            overscroll-behavior: none;
            outline: none;
          `}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              props.resolve(undefined);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (props.type === "prompt") {
                props.resolve(inputRef.current?.value);
              } else {
                props.resolve(true);
              }
            } else if (e.key === "Escape") {
              props.resolve(undefined);
            }
          }}
        >
          <Box
            flex="y/stretch 16rem"
            padding="24rem/40rem"
            className={css`
              background: white;
              border-radius: 3rem;
              max-width: min(500rem, 95vw);
            `}
          >
            <Box
              flex="y/stretch 20rem"
              padding="30rem/0"
              className={css`
                font: var(--font-l);
                text-align: center;
              `}
            >
              <Box flex="center-x">
                <Balancer>{props.text}</Balancer>
              </Box>

              {props.type === "prompt" && (
                <input
                  ref={inputRef}
                  className={css`
                    box-sizing: border-box;
                    margin-top: 1rem;
                    width: 100%;
                    font: inherit;
                    padding: 10rem;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    border-radius: 0.5rem;
                  `}
                  defaultValue={props.defaultValue}
                />
              )}
            </Box>

            <Box flex="center-x" size="40rem">
              <Box flex="x/stretch 40rem">
                {props.type === "confirm" || props.type === "prompt" ? (
                  <>
                    <Button
                      theme="card-editing"
                      text={props.options.cancelText ?? "Cancel"}
                      onClick={() => {
                        props.resolve(undefined);
                      }}
                    />
                    <Button
                      theme="card-editing"
                      variant={
                        props.options.danger ? "danger-primary" : "primary"
                      }
                      text={props.options.okText ?? "OK"}
                      onClick={() => {
                        if (props.type === "confirm") {
                          props.resolve(true);
                        } else {
                          props.resolve(inputRef.current?.value);
                        }
                      }}
                    />
                  </>
                ) : props.type === "alert" ? (
                  <Button
                    theme="card-editing"
                    variant={
                      props.options.danger ? "danger-primary" : "primary"
                    }
                    text={props.options.okText ?? "OK"}
                    onClick={() => {
                      props.resolve();
                    }}
                  />
                ) : undefined}
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
};

/**
 * Replace alert, confirm, and prompt alert with a modal window.
 */
export function useModalWindow() {
  const [data, setData] = useState<ModalProps>({ type: undefined });

  const closeModal = () => setData({ type: undefined });

  const node = <ModalWindow {...data} />;

  return {
    node,
    alert(text: string, options: ModalOptions = {}) {
      let result = new Promise<true | undefined>((resolve) => {
        setData({ type: "alert", text, resolve, options });
      });
      result.then(closeModal);
      return result;
    },
    confirm(text: string, options: ModalOptions = {}) {
      let result = new Promise<true | undefined>((resolve) => {
        setData({ type: "confirm", text, resolve, options });
      });
      result.then(closeModal);
      return result;
    },
    prompt(text: string, defaultValue: string, options: ModalOptions = {}) {
      let result = new Promise<string | undefined>((resolve) => {
        setData({
          type: "prompt",
          text,
          defaultValue,
          resolve,
          options,
        });
      });
      result.then(closeModal);
      return result;
    },
  };
}
