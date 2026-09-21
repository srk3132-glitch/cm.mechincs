export function TelemetryBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30 dark:opacity-40">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="flightPathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flightPathGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Ambient Flight Motion Trails */}
        <path
          d="M -100 240 Q 300 120, 700 280 T 1500 160 T 2200 350"
          fill="none"
          stroke="url(#flightPathGrad)"
          strokeWidth="1.5"
          strokeDasharray="8 12"
          className="opacity-40"
        />
        <path
          d="M 1800 650 Q 1200 480, 800 600 T 200 450 T -200 620"
          fill="none"
          stroke="url(#flightPathGrad2)"
          strokeWidth="1.5"
          strokeDasharray="6 14"
          className="opacity-30"
        />

        {/* Subtle Telemetry Nodes */}
        <circle cx="280" cy="180" r="3" fill="#3b82f6" className="animate-ping opacity-30" />
        <circle cx="280" cy="180" r="1.5" fill="#3b82f6" opacity="0.6" />

        <circle cx="950" cy="240" r="3" fill="#f59e0b" className="animate-ping opacity-30" />
        <circle cx="950" cy="240" r="1.5" fill="#f59e0b" opacity="0.6" />

        <circle cx="1420" cy="520" r="3" fill="#10b981" className="animate-ping opacity-30" />
        <circle cx="1420" cy="520" r="1.5" fill="#10b981" opacity="0.6" />
      </svg>
    </div>
  );
}
