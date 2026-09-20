import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fx-accent disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default: 'bg-fx-accent text-fx-bg hover:bg-[#8bb0c8]',
        secondary:
          'bg-fx-elevated text-fx-text border border-fx-border hover:bg-fx-panel',
        ghost: 'text-fx-muted hover:text-fx-text hover:bg-fx-elevated',
        danger: 'bg-fx-danger/20 text-fx-danger border border-fx-danger/40',
        outline:
          'border border-fx-border bg-transparent text-fx-text hover:bg-fx-elevated',
      },
      size: {
        default: 'h-9 px-3 py-2',
        sm: 'h-7 px-2 text-xs',
        lg: 'h-11 px-5',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
