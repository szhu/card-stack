import { ClassNamesArg, css, cx } from "@emotion/css";
import { ButtonHTMLAttributes, HTMLAttributes } from "react";

type Length = "0" | `${number}px` | `${number}rem`;
type Direction = "x" | "y";
type Flow = "x" | "y" | "x-wrap" | "y-wrap";

type Align = "center" | "stretch";

type FlexBasis = "auto" | Length;

interface CssShorthandProps {
  class?: ClassNamesArg;
  className?: ClassNamesArg;
  label?: boolean;
  flex?:
    | "center"
    | `center-${Direction}`
    | `${Flow}/${Align} ${Length}`
    | `${Flow}/${Align} ${Length}/${Length}`;
  size?:
    | "grow"
    | `grow-${number}`
    | FlexBasis
    | `${number} ${FlexBasis} | ${number}`;
  padding?: Length | `${Length}/${Length}`;
  title?: HTMLAttributes<HTMLElement>["title"];
  onClick?: HTMLAttributes<HTMLElement>["onClick"];
  disabled?: ButtonHTMLAttributes<HTMLButtonElement>["disabled"];
}

interface CssShorthandOutput {
  tag?: "label";
  className?: string;
  title?: HTMLAttributes<HTMLElement>["title"];
  onClick?: HTMLAttributes<HTMLElement>["onClick"];
  disabled?: ButtonHTMLAttributes<HTMLButtonElement>["disabled"];
}

export function cssShorthand(props: CssShorthandProps): CssShorthandOutput {
  let display,
    flexFlow,
    gap,
    flexBasis,
    flexGrow,
    flexShrink,
    alignItems,
    justifyContent;

  // If `flex` is set, set display, flex-direction, and gap.
  if (props.flex != null) {
    display = "flex";

    if (props.flex === "center") {
      flexFlow = "column";
      alignItems = "center";
      justifyContent = "center";
    } else if (props.flex === "center-x") {
      flexFlow = "row";
      alignItems = "stretch";
      justifyContent = "center";
    } else if (props.flex === "center-y") {
      flexFlow = "column";
      alignItems = "stretch";
      justifyContent = "center";
    } else {
      let direction;
      [direction, gap] = props.flex.split(/\s+/);

      [flexFlow, alignItems] = {
        "x/stretch": ["row", undefined],
        "y/stretch": ["column", undefined],
        "x/center": ["row", "center"],
        "y/center": ["column", "center"],
        "x-wrap/stretch": ["row wrap", undefined],
        "y-wrap/stretch": ["column wrap", undefined],
        "x-wrap/center": ["row wrap", "center"],
        "y-wrap/center": ["column wrap", "center"],
      }[direction]!;
    }
  }

  // If `size` is set, set flex-basis, flex-grow, and flex-shrink.
  if (props.size != null) {
    let parts;
    if (props.size === "grow") {
      // For the "grow" value, set flex-grow to 1.
      [flexShrink, flexBasis, flexGrow] = [0, 0, 1];
    } else if (props.size.startsWith("grow-")) {
      // For the "grow-N" value, set flex-grow to N.
      [flexShrink, flexBasis, flexGrow] = [0, 0, props.size.slice(5)];
    } else if ((parts = props.size.split(/\s+/)).length === 3) {
      // For the three-word values, set all three properties.
      [flexShrink, flexBasis, flexGrow] = parts;
    } else {
      // For the one-word values, set flex-basis and flex-grow to 0.
      [flexShrink, flexBasis, flexGrow] = [0, props.size, 0];
    }
  }

  return {
    tag: props.label ? "label" : undefined,
    className: cx(
      css`
        display: ${display};
        flex-flow: ${flexFlow};
        gap: ${gap?.replace("/", " ")};

        flex-basis: ${flexBasis};
        flex-grow: ${flexGrow};
        flex-shrink: ${flexShrink};

        align-items: ${alignItems};
        justify-content: ${justifyContent};

        box-sizing: border-box;
        padding: ${props.padding?.replace("/", " ")};
      `,
      props.class,
      props.className,
    ),
    title: props.title,
    onClick: props.onClick,
    disabled: props.disabled,
  };
}

export const Box: React.FC<
  CssShorthandProps & { children?: React.ReactNode }
> = (props) => {
  let { tag, ...restProps } = cssShorthand(props);

  if (tag === "label") {
    return <label {...restProps}>{props.children}</label>;
  } else {
    return <div {...restProps}>{props.children}</div>;
  }
};
