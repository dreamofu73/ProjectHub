import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * 앵커 요소에서 가장 가까운 클리핑 조상(overflow가 visible이 아닌 요소)을 찾아
 * 그 컨테이너 기준으로 패널이 양쪽에서 잘리지 않는 방향을 결정한다.
 *
 * - spaceLeft < panelWidth → left-0 (오른쪽으로 확장)
 * - spaceRight < panelWidth → right-0 (왼쪽으로 확장)
 * - 양쪽 모두 모자라면 공간이 더 넓은 쪽 선택
 * - 클리핑 조상이 없으면 뷰포트 기준으로 fallback
 */
function findClipAncestor(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const { overflow, overflowX, overflowY } = style;
    if (
      overflow === 'hidden' || overflow === 'auto' || overflow === 'scroll' ||
      overflowX === 'hidden' || overflowX === 'auto' || overflowX === 'scroll' ||
      overflowY === 'hidden' || overflowY === 'auto' || overflowY === 'scroll'
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function useFlipPosition(
  anchorRef: RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  panelWidth = 300,
): string {
  const [align, setAlign] = useState('right-0');

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) return;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const clipEl = findClipAncestor(anchorRef.current);

    // 클리핑 컨테이너가 있으면 그 기준, 없으면 뷰포트 기준
    const containerLeft = clipEl ? clipEl.getBoundingClientRect().left : 0;
    const containerRight = clipEl
      ? clipEl.getBoundingClientRect().right
      : window.innerWidth;

    const spaceLeft = anchorRect.left - containerLeft;
    const spaceRight = containerRight - anchorRect.right;

    if (spaceLeft >= panelWidth) {
      // 왼쪽에 충분한 공간 → 기본 right-0 (왼쪽으로 펼침)
      setAlign('right-0');
    } else if (spaceRight >= panelWidth) {
      // 오른쪽에 충분한 공간 → left-0 (오른쪽으로 펼침)
      setAlign('left-0');
    } else {
      // 양쪽 모두 모자라면 더 넓은 쪽 선택
      setAlign(spaceLeft >= spaceRight ? 'right-0' : 'left-0');
    }
  }, [isOpen, panelWidth]);

  return align;
}
