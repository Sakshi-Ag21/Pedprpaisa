import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  variant?: 'default' | 'petal' | 'sage'
  className?: string
}

export function StatCard({ title, value, subtitle, icon: Icon, variant = 'default', className }: StatCardProps) {
  const cardClass = variant === 'petal' ? 'petal-card' : variant === 'sage' ? 'sage-card' : 'flora-card'

  return (
    <div className={cn(cardClass, 'p-5 animate-fade-in', className)}>
      <p className="label-spaced">{title}</p>
      <p className="font-serif text-3xl font-light mt-2 tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      {Icon && (
        <div className="mt-3 flex justify-end">
          <Icon className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
