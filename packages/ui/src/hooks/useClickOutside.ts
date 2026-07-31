import { useEffect, useRef, type RefObject } from 'react';

/**
 * 주어진 ref들이 가리키는 요소 바깥을 마우스로 누르면 handler를 호출한다.
 * ref 배열은 렌더마다 새로 생성되어도 무해하다(ref.current를 이벤트 시점에 지연 참조).
 */
export function useClickOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  handler: () => void,
  enabled = true
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      for (const ref of refs) {
        if (ref.current && ref.current.contains(target)) return;
      }
      handlerRef.current();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
    // refs는 이벤트 시점에 지연 참조하므로 의도적으로 deps에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
