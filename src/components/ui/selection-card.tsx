import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectionCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  icon: React.ReactNode
  iconClassName?: string
  title: React.ReactNode
  description?: React.ReactNode
}

const SelectionCard = React.forwardRef<HTMLButtonElement, SelectionCardProps>(
  ({ className, icon, iconClassName, title, description, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "w-full p-3 rounded-lg ring-1 ring-foreground/10 hover:bg-accent text-left cursor-pointer",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              iconClassName
            )}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{title}</div>
            {description && (
              <div className="text-xs text-muted-foreground">
                {description}
              </div>
            )}
          </div>
        </div>
      </button>
    )
  }
)
SelectionCard.displayName = "SelectionCard"

export { SelectionCard }
