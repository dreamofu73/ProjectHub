import { useEffect, useState } from 'react';

/**
 * 값 변경이 `delay`(ms) 동안 멈춘 뒤에만 반영되는 디바운스 값을 반환합니다.
 * 검색어 입력처럼 매 키 입력마다 무거운 필터/정렬·요청이 실행되는 것을 막을 때 사용합니다.
 */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
