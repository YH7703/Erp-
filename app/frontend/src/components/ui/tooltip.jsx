import * as React from 'react'
import { cn } from '@/lib/utils'

const TooltipProvider = ({ children }) => <>{children}</>
TooltipProvider.displayName = 'TooltipProvider'

const Tooltip = ({ children }) => <>{children}</>
Tooltip.displayName = 'Tooltip'

const TooltipTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <span ref={ref} className={cn('group/tooltip relative inline-flex', className)} {...props} />
))
TooltipTrigger.displayName = 'TooltipTrigger'

const TooltipContent = React.forwardRef(({ className, sideOffset = 4, children, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
      'bottom-full mb-2',
      'invisible opacity-0 group-hover/tooltip:visible group-hover/tooltip:opacity-100',
      'transition-opacity duration-150 whitespace-nowrap',
      className
    )}
    {...props}
  >
    {children}
  </span>
))
TooltipContent.displayName = 'TooltipContent'

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
