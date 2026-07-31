import OrderedList from '@tiptap/extension-ordered-list';
import BulletList from '@tiptap/extension-bullet-list';

const orderedListTypeMap: Record<string, string> = {
  'A': 'upper-alpha',
  'a': 'lower-alpha',
  'I': 'upper-roman',
  'i': 'lower-roman',
};

const bulletListStyleMap: Record<string, string> = {
  square: 'square',
  circle: 'circle',
  disc: 'disc',
};

/** ol에 type 속성(1/A/a/I/i)을 유지하고 list-style-type으로 렌더링 */
export const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: '1',
        parseHTML: element => element.getAttribute('type') || '1',
        renderHTML: attributes => {
          if (!attributes.type || attributes.type === '1') {
            return {};
          }
          const listStyle = orderedListTypeMap[attributes.type] || 'decimal';
          return {
            type: attributes.type,
            style: `list-style-type: ${listStyle}; list-style-position: outside;`,
          };
        },
      },
    };
  },
});

/** ul에 불릿 모양(square/circle/disc/임의 문자)을 유지 */
export const CustomBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: 'disc',
        parseHTML: element => {
          const inline = element.style.listStyleType || '';
          if (!inline) return 'disc';
          const unquoted = inline.replace(/^['"]|['"]$/g, '');
          return bulletListStyleMap[unquoted] || bulletListStyleMap[inline] || inline || 'disc';
        },
        renderHTML: attributes => {
          if (!attributes.style || attributes.style === 'disc') {
            return {};
          }
          const val = attributes.style;
          const needsQuotes = val.length === 1 || !bulletListStyleMap[val];
          const cssValue = needsQuotes ? `"${val}"` : val;
          return {
            style: `list-style-type: ${cssValue}; list-style-position: outside;`,
          };
        },
      },
    };
  },
});
