interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizeMap = {
    sm: { icon: 24, text: 'text-base' },
    md: { icon: 32, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
    xl: { icon: 64, text: 'text-4xl' },
  }

  const { icon: iconSize, text: textSize } = sizeMap[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* SVG Logo: Group of people with a route/map */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Route/Path line - curved path */}
        <path
          d="M 10 40 Q 20 25, 32 30 T 54 40"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className="text-primary-500"
          opacity="0.6"
        />
        
        {/* Main route line */}
        <path
          d="M 10 40 Q 20 25, 32 30 T 54 40"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          className="text-primary-600"
        />
        
        {/* People icons along the route */}
        {/* Person 1 (left) */}
        <g transform="translate(16, 35)">
          <circle cx="0" cy="-2" r="5" fill="currentColor" className="text-primary-500" />
          <path
            d="M -6 6 Q 0 2, 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            className="text-primary-500"
          />
        </g>
        
        {/* Person 2 (center) - larger */}
        <g transform="translate(32, 28)">
          <circle cx="0" cy="-2" r="6" fill="currentColor" className="text-primary-600" />
          <path
            d="M -7 7 Q 0 3, 7 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            className="text-primary-600"
          />
        </g>
        
        {/* Person 3 (right) */}
        <g transform="translate(48, 35)">
          <circle cx="0" cy="-2" r="5" fill="currentColor" className="text-primary-500" />
          <path
            d="M -6 6 Q 0 2, 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            className="text-primary-500"
          />
        </g>
        
        {/* Destination pin */}
        <g transform="translate(54, 40)">
          <circle cx="0" cy="0" r="4" fill="currentColor" className="text-primary-600" />
          <path
            d="M 0 4 L -3 8 L 0 10 L 3 8 Z"
            fill="currentColor"
            className="text-primary-600"
          />
        </g>
        
        {/* Start point */}
        <circle cx="10" cy="40" r="3" fill="currentColor" className="text-primary-400" />
      </svg>
      
      {showText && (
        <span className={`font-bold ${textSize} text-primary-600`}>
          Trip<span className="text-gray-900">Together</span>
        </span>
      )}
    </div>
  )
}
