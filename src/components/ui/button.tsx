import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'rounded-lg bg-foreground text-background shadow-sm hover:opacity-85 active:scale-[0.98]',
        destructive: 'rounded-lg bg-destructive text-destructive-foreground shadow-sm hover:opacity-90',
        outline: 'rounded-lg border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
        secondary: 'rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'rounded-lg hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        bloom: 'rounded-full bg-primary text-primary-foreground shadow hover:opacity-90 active:scale-[0.98]',
        gradient: 'rounded-lg bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow hover:opacity-90 active:scale-[0.98]',
        petal: 'rounded-lg bg-petal border border-bloom text-primary hover:bg-bloom/60 active:scale-[0.98]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 px-8 text-base',
        xl: 'h-12 px-10 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
