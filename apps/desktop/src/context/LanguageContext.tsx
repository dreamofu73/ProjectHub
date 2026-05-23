import React, { createContext, useContext, useState, useEffect } from 'react';
import ko from '../locales/ko';
import en from '../locales/en';
import ja from '../locales/ja';
import zh from '../locales/zh';

export type Language = 'ko' | 'ja' | 'zh' | 'en';

export const defaultTimezones: Record<Language, string> = {
  ko: 'Asia/Seoul',
  ja: 'Asia/Tokyo',
  zh: 'Asia/Shanghai',
  en: 'America/New_York',
};

export const timezoneLabels: Record<string, string> = {
  'Asia/Seoul': 'Asia/Seoul (KST, UTC+9)',
  'Asia/Tokyo': 'Asia/Tokyo (JST, UTC+9)',
  'Asia/Shanghai': 'Asia/Shanghai (CST, UTC+8)',
  'America/New_York': 'America/New_York (EST/EDT, UTC-5/UTC-4)',
  'Europe/London': 'Europe/London (GMT/BST, UTC+0/UTC+1)',
  'UTC': 'UTC (Coordinated Universal Time)',
};

// Project Settings screen strings (merged into the base locale dicts below).
// Reuses existing `save` / `delete` keys already present in every locale.
const projectSettingsTranslations: Record<Language, Record<string, string>> = {
  ko: {
    projectSettingsTitle: '프로젝트 설정',
    taskTypesLabel: '일감 유형 (쉼표로 구분)',
    issueTypesLabel: '이슈 유형 (쉼표로 구분)',
    statusesLabel: '상태 (쉼표로 구분)',
    taskCategoriesLabel: '일감 분류 (쉼표로 구분)',
    taskStatusesLabel: '일감 상태 (쉼표로 구분)',
    customFieldsTitle: '이슈 커스텀 속성',
    customFieldsDesc: '프로젝트 일감에 사용자 정의 속성을 추가할 수 있습니다.',
    fieldNameLabel: '속성명',
    fieldTypeLabel: '유형',
    sortOrderLabel: '정렬순서',
    requiredLabel: '필수',
    fieldNamePlaceholder: '예: severity, estimated_hours',
    addFieldBtn: '속성 추가',
    addingFieldBtn: '추가 중...',
    deleteFieldConfirm: '이 커스텀 속성을 삭제하시겠습니까?',
    fieldTypeInteger: '정수',
    fieldTypeFloat: '실수',
    fieldTypeString: '문자',
    fieldTypeText: '텍스트',
    fieldTypeDate: '날짜',
    fieldTypeTime: '시간',
    fieldTypeBoolean: '불리언',
  },
  en: {
    projectSettingsTitle: 'Project Settings',
    taskTypesLabel: 'Task Types (comma-separated)',
    issueTypesLabel: 'Issue Types (comma-separated)',
    statusesLabel: 'Statuses (comma-separated)',
    taskCategoriesLabel: 'Task Categories (comma-separated)',
    taskStatusesLabel: 'Task Statuses (comma-separated)',
    customFieldsTitle: 'Issue Custom Fields',
    customFieldsDesc: 'You can add custom fields to project tasks.',
    fieldNameLabel: 'Field Name',
    fieldTypeLabel: 'Type',
    sortOrderLabel: 'Sort Order',
    requiredLabel: 'Required',
    fieldNamePlaceholder: 'e.g. severity, estimated_hours',
    addFieldBtn: 'Add Field',
    addingFieldBtn: 'Adding...',
    deleteFieldConfirm: 'Delete this custom field?',
    fieldTypeInteger: 'Integer',
    fieldTypeFloat: 'Float',
    fieldTypeString: 'String',
    fieldTypeText: 'Text',
    fieldTypeDate: 'Date',
    fieldTypeTime: 'Time',
    fieldTypeBoolean: 'Boolean',
  },
  ja: {
    projectSettingsTitle: 'プロジェクト設定',
    taskTypesLabel: 'タスク種別（カンマ区切り）',
    issueTypesLabel: '課題種別（カンマ区切り）',
    statusesLabel: 'ステータス（カンマ区切り）',
    taskCategoriesLabel: 'タスク分類（カンマ区切り）',
    taskStatusesLabel: 'タスクステータス（カンマ区切り）',
    customFieldsTitle: '課題カスタム属性',
    customFieldsDesc: 'プロジェクトのタスクにカスタム属性を追加できます。',
    fieldNameLabel: '属性名',
    fieldTypeLabel: '種別',
    sortOrderLabel: '並び順',
    requiredLabel: '必須',
    fieldNamePlaceholder: '例: severity, estimated_hours',
    addFieldBtn: '属性を追加',
    addingFieldBtn: '追加中...',
    deleteFieldConfirm: 'このカスタム属性を削除しますか？',
    fieldTypeInteger: '整数',
    fieldTypeFloat: '実数',
    fieldTypeString: '文字列',
    fieldTypeText: 'テキスト',
    fieldTypeDate: '日付',
    fieldTypeTime: '時刻',
    fieldTypeBoolean: '真偽値',
  },
  zh: {
    projectSettingsTitle: '项目设置',
    taskTypesLabel: '任务类型（逗号分隔）',
    issueTypesLabel: '问题类型（逗号分隔）',
    statusesLabel: '状态（逗号分隔）',
    taskCategoriesLabel: '任务分类（逗号分隔）',
    taskStatusesLabel: '任务状态（逗号分隔）',
    customFieldsTitle: '问题自定义属性',
    customFieldsDesc: '可以为项目任务添加自定义属性。',
    fieldNameLabel: '属性名',
    fieldTypeLabel: '类型',
    sortOrderLabel: '排序',
    requiredLabel: '必填',
    fieldNamePlaceholder: '例如: severity, estimated_hours',
    addFieldBtn: '添加属性',
    addingFieldBtn: '添加中...',
    deleteFieldConfirm: '确定删除此自定义属性吗？',
    fieldTypeInteger: '整数',
    fieldTypeFloat: '浮点数',
    fieldTypeString: '字符串',
    fieldTypeText: '文本',
    fieldTypeDate: '日期',
    fieldTypeTime: '时间',
    fieldTypeBoolean: '布尔值',
  },
};

const translations: Record<Language, Record<string, string>> = {
  ko: { ...ko, ...projectSettingsTranslations.ko },
  en: { ...en, ...projectSettingsTranslations.en },
  ja: { ...ja, ...projectSettingsTranslations.ja },
  zh: { ...zh, ...projectSettingsTranslations.zh },
};

export function parseUTCDate(dateStr: string | Date | number | undefined | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'number') return new Date(dateStr);
  
  if (typeof dateStr === 'string') {
    // If it's already got timezone indicator, parse directly
    if (dateStr.includes('Z') || dateStr.includes('+') || (dateStr.includes('-') && dateStr.includes('T') && dateStr.match(/[a-zA-Z]/))) {
      return new Date(dateStr);
    }
    // Convert "YYYY-MM-DD HH:MM:SS" (SQLite local format but actually UTC) to standard UTC string
    const isoStr = dateStr.replace(' ', 'T') + 'Z';
    const parsed = new Date(isoStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    return new Date(dateStr);
  }
  return new Date();
}

interface LanguageContextProps {
  language: Language;
  timezone: string;
  setLanguage: (lang: Language) => void;
  setTimezone: (tz: string) => void;
  t: (key: string) => string;
  formatDateTime: (date: string | Date | number | undefined | null, options?: Intl.DateTimeFormatOptions) => string;
  formatDate: (date: string | Date | number | undefined | null, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: string | Date | number | undefined | null, options?: Intl.DateTimeFormatOptions) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'ko';
  });

  const timezone = defaultTimezones[language];

  useEffect(() => {
    localStorage.setItem('language', language);
    localStorage.setItem('timezone', defaultTimezones[language]);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const setTimezone = (_tz: string) => {
    // Timezone is locked to language default. No-op.
  };

  const t = (key: string): string => {
    const dict = translations[language];
    return dict[key] || translations['ko'][key] || key;
  };

  const getLocaleString = () => {
    switch (language) {
      case 'ko': return 'ko-KR';
      case 'ja': return 'ja-JP';
      case 'zh': return 'zh-CN';
      case 'en': return 'en-US';
      default: return 'ko-KR';
    }
  };

  const formatDateTime = (date: string | Date | number | undefined | null, options?: Intl.DateTimeFormatOptions): string => {
    const d = parseUTCDate(date);
    return d.toLocaleString(getLocaleString(), {
      timeZone: timezone,
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    });
  };

  const formatDate = (date: string | Date | number | undefined | null, options?: Intl.DateTimeFormatOptions): string => {
    const d = parseUTCDate(date);
    return d.toLocaleDateString(getLocaleString(), {
      timeZone: timezone,
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      ...options
    });
  };

  const formatTime = (date: string | Date | number | undefined | null, options?: Intl.DateTimeFormatOptions): string => {
    const d = parseUTCDate(date);
    return d.toLocaleTimeString(getLocaleString(), {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      ...options
    });
  };

  return (
    <LanguageContext.Provider value={{
      language,
      timezone,
      setLanguage,
      setTimezone,
      t,
      formatDateTime,
      formatDate,
      formatTime
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
