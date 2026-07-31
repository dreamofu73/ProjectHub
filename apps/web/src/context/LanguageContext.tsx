// Shim — 공용 구현은 packages/shared/src/hooks/LanguageContext.tsx (A4 공유화).
export {
  LanguageProvider,
  useLanguage,
  defaultTimezones,
  timezoneLabels,
  parseUTCDate,
} from 'shared/hooks/LanguageContext';
export type { Language } from 'shared/hooks/LanguageContext';
