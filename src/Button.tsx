import { css } from "@emotion/css";
import { Box } from "./DS23";

const Border = css`
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 20rem;
  background: white;
`;

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

// let BottomRowButtonExample = (
//   <Box
//     size="grow"
//     flex="x/stretch 0"
//     className={ButtonStyle}
//     disabled={undefined}
//     onClick={undefined}
//   >
//     <Box title="Create new card" className={Border} size="grow" flex="center">
//       <div>❇️</div>
//     </Box>
//   </Box>
// );

// let CardEditingButtonExample = (
//   <Box
//     size="150rem"
//     flex="x/stretch 0"
//     className={ButtonStyle}
//     disabled={undefined}
//     onClick={undefined}
//   >
//     <Box className={Border} size="grow" flex="center">
//       <Box flex="x/center 12rem">
//         <span>✅</span>
//         <big>Done</big>
//       </Box>
//     </Box>
//   </Box>
// );

// let CircleButtonExample = (
//   <Box
//     size="60rem"
//     flex="x/stretch 0"
//     className={ButtonStyle}
//     disabled={undefined}
//     onClick={undefined}
//   >
//     <Box title="Help" className={Border} size="grow" flex="center">
//       <div>❓</div>
//     </Box>
//   </Box>
// );

const Button: React.FC<{
  theme: "bottom-row" | "card-editing" | "circle";
  variant?: "primary" | "danger-primary";
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  icon?: string;
  text?: string;
}> = (props) => {
  const outerCommonProps = {
    className: ButtonStyle,
    disabled: props.disabled,
    onClick: props.onClick,
  } as const;

  const innerCommonProps = {
    className: [
      Border,
      props.variant === "primary"
        ? css`
            background-color: #015fcc;
            color: white;
          `
        : props.variant === "danger-primary"
        ? css`
            background-color: red;
            color: white;
          `
        : undefined,
    ],

    size: "grow",
    flex: "center",
    title: props.title,
  } as const;

  const textClassName =
    props.variant === "primary"
      ? css`
          font-weight: bold;
        `
      : props.variant === "danger-primary"
      ? css`
          font-weight: bold;
        `
      : undefined;

  switch (props.theme) {
    case "bottom-row":
      return (
        <Box size="grow" flex="x/stretch 0" {...outerCommonProps}>
          <Box {...innerCommonProps}>
            <div>{props.icon}</div>
          </Box>
        </Box>
      );
    case "card-editing":
      return (
        <Box
          flex="x/stretch 0"
          {...outerCommonProps}
          className={[
            outerCommonProps.className,
            css`
              width: 150rem;
            `,
          ]}
        >
          <Box {...innerCommonProps}>
            <Box flex="x/center 12rem">
              {props.icon && <span>{props.icon}</span>}
              {props.text && (
                <big
                  className={css`
                    font: var(--font-l);
                    ${textClassName};
                  `}
                >
                  {props.text}
                </big>
              )}
            </Box>
          </Box>
        </Box>
      );
    case "circle":
      return (
        <Box size="60rem" flex="x/stretch 0" {...outerCommonProps}>
          <Box {...innerCommonProps}>
            <div>{props.icon}</div>
          </Box>
        </Box>
      );
  }
};

export default Button;
