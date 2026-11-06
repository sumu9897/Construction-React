/**
 * American Financial Associates - Official Agency Monogram & Brandmark.
 * Renders the architectural AFA crimson badge and typography.
 */
export default function Monogram({ className = "h-8", showText = true }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Precision Vector Emblem Badge */}
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto aspect-square shrink-0 rounded-[3px] shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="100" height="100" rx="6" fill="#C8102E" />
        <rect x="5" y="5" width="90" height="90" rx="3" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1.2" />
        
        {/* Architectural Pediment / Apex */}
        <path d="M 22 21 L 50 13 L 78 21" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="26" y1="25" x2="74" y2="25" stroke="#C9BBA2" strokeWidth="1.2" />

        {/* AFA Bold Typography */}
        <text
          x="50"
          y="56"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
          fontSize="26"
          fontWeight="900"
          letterSpacing="1.2"
        >
          AFA
        </text>

        {/* Foundation beam and label */}
        <line x1="18" y1="65" x2="82" y2="65" stroke="#EFE9DD" strokeWidth="1.2" />
        <text
          x="50"
          y="77"
          textAnchor="middle"
          fill="#EFE9DD"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="6.5"
          fontWeight="800"
          letterSpacing="1.2"
        >
          AMERICAN FINANCIAL
        </text>
        <text
          x="50"
          y="87"
          textAnchor="middle"
          fill="#C9BBA2"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="5.5"
          fontWeight="700"
          letterSpacing="1"
        >
          ASSOCIATES · US
        </text>
      </svg>

      {showText && (
        <span className="hidden sm:flex flex-col text-left leading-none tracking-normal select-none">
          <span className="font-sans text-[0.74rem] font-bold uppercase tracking-wider text-bone">
            American Financial
          </span>
          <span className="font-serif text-[0.66rem] italic tracking-widest text-stone mt-0.5">
            Associates · US Agency
          </span>
        </span>
      )}
    </div>
  );
}
