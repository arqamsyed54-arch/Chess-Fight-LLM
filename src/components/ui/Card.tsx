import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-white rounded-xl shadow-sm',
      elevated: 'bg-white rounded-xl shadow-lg',
      bordered: 'bg-white rounded-xl border border-slate-200'
    }
    
    return (
      <div
        ref={ref}
        className={`${variants[variant]} ${className}`}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'
export default Card
