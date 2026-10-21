// Bağımlılık eklemeden kullanılan küçük çizgi ikon seti (24×24, stroke = currentColor).
type P = { className?: string };
const base = (path: React.ReactNode, className = "h-4 w-4") => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {path}
  </svg>
);

export const IconCalendar = ({ className }: P) => base(<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>, className);
export const IconGauge = ({ className }: P) => base(<><path d="M4.5 16.5a8 8 0 1 1 15 0" /><path d="M12 12l4-3" /><circle cx="12" cy="12" r="1" /></>, className);
export const IconFuel = ({ className }: P) => base(<><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M3.5 20h12M5 10h9" /><path d="M14 8h1.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-2.5-2.5" /></>, className);
export const IconGear = ({ className }: P) => base(<><circle cx="6" cy="6" r="1.6" /><circle cx="12" cy="6" r="1.6" /><circle cx="18" cy="6" r="1.6" /><circle cx="6" cy="18" r="1.6" /><circle cx="12" cy="18" r="1.6" /><path d="M6 7.6v8.8M12 7.6v8.8M18 7.6V12H6" /></>, className);
export const IconCar = ({ className }: P) => base(<><path d="M3.5 15.5V12l2-5h13l2 5v3.5" /><path d="M3.5 15.5h17v2h-17z" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /><path d="M5.5 12h13" /></>, className);
export const IconBolt = ({ className }: P) => base(<path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" />, className);
export const IconPalette = ({ className }: P) => base(<><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-1.9-.5-1.2.3-2.6 1.7-2.6H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.3 16.7 3.5 12 3.5z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15" cy="8" r="1" /></>, className);
export const IconShield = ({ className }: P) => base(<><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6L12 3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>, className);
export const IconCamera = ({ className }: P) => base(<><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.5" /></>, className);
export const IconChat = ({ className }: P) => base(<><path d="M4 18.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H8L4 18.5z" /><path d="M8.5 9h7M8.5 12h4.5" /></>, className);
export const IconDoc = ({ className }: P) => base(<><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z" /><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5" /></>, className);
export const IconArrowRight = ({ className }: P) => base(<path d="M5 12h14M13 6l6 6-6 6" />, className);
export const IconCheck = ({ className }: P) => base(<path d="M5 12.5l4.5 4.5L19 7.5" />, className);
export const IconPin = ({ className }: P) => base(<><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>, className);
export const IconClock = ({ className }: P) => base(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>, className);
export const IconWhatsApp = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2zm5.8 14.08c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.76-1.09-4.5-3.92-4.64-4.1-.13-.18-1.1-1.47-1.1-2.81 0-1.33.7-1.99.95-2.26.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.24.56.79 1.92.86 2.06.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.89 1.04.93 1.92 1.22 2.19 1.35.27.14.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.61-.14.25.09 1.59.75 1.86.89.27.14.45.2.52.32.07.11.07.66-.17 1.33z" />
  </svg>
);
