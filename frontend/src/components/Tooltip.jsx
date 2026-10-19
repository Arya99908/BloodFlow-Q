import * as TooltipPrimitive from '@radix-ui/react-tooltip';

// Adapted from Skiper UI's free Custom Tooltip (skiper101), with its Radix
// interaction model retained and project-native CSS replacing Tailwind classes.
export function TooltipProvider({ children }) {
  return <TooltipPrimitive.Provider delayDuration={150}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ label, children }) {
  return <TooltipProvider><TooltipPrimitive.Root>
    <TooltipPrimitive.Trigger asChild>
      <button className="tooltip-trigger" type="button" aria-label={label}>
        {children}
      </button>
    </TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content className="research-tooltip" sideOffset={7}>
        {label}
        <TooltipPrimitive.Arrow className="research-tooltip-arrow" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root></TooltipProvider>;
}
