export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        width="220"
        height="48"
        viewBox="0 0 220 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-auto"
      >
        {/* Main text: EIPsInsight - big, bold, italic */}
        <text
          x="0"
          y="32"
          fontSize="24"
          fontWeight="800"
          fontStyle="italic"
          fill="currentColor"
          fontFamily="'Inter', '-apple-system', 'BlinkMacSystemFont', sans-serif"
          letterSpacing="-0.5"
        >
          EIPsInsight
        </text>
        
        {/* Subtitle: Academy - small */}
        <text
          x="0"
          y="46"
          fontSize="11"
          fontWeight="600"
          fontStyle="italic"
          fill="currentColor"
          fontFamily="'Inter', '-apple-system', 'BlinkMacSystemFont', sans-serif"
          letterSpacing="1.5"
          opacity="0.8"
        >
          ACADEMY
        </text>
      </svg>
    </div>
  );
}
