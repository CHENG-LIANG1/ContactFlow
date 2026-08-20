'use client';
import React, { useState } from 'react';
import { createPressable } from '@gluestack-ui/core/pressable/creator';
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableStateCallbackType,
} from 'react-native';

import { tva , withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

const UIPressable = createPressable({
  Root: withStyleContext(RNPressable),
});

const pressableStyle = tva({
  base: 'data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-indicator-info data-[focus-visible=true]:ring-2 data-[disabled=true]:opacity-40',
});

type IPressableProps = Omit<
  React.ComponentProps<typeof UIPressable>,
  'context'
> &
  VariantProps<typeof pressableStyle>;

/**
 * NativeWind's css-interop drops function-valued `style` props, so the pressed
 * state is tracked locally and the style callback is resolved before it is
 * passed down. Callers keep the standard Pressable API.
 */
const Pressable = React.forwardRef<
  React.ComponentRef<typeof UIPressable>,
  IPressableProps
>(function Pressable({ className, onPressIn, onPressOut, style, ...props }, ref) {
  const [pressed, setPressed] = useState(false);
  const resolvedStyle =
    typeof style === 'function'
      ? style({ pressed } as PressableStateCallbackType)
      : style;

  const handlePressIn = (event: GestureResponderEvent) => {
    setPressed(true);
    onPressIn?.(event);
  };
  const handlePressOut = (event: GestureResponderEvent) => {
    setPressed(false);
    onPressOut?.(event);
  };

  return (
    <UIPressable
      {...props}
      ref={ref}
      className={pressableStyle({
        class: className,
      })}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={resolvedStyle}
    />
  );
});

Pressable.displayName = 'Pressable';
export { Pressable };
