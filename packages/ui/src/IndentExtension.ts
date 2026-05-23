import { Extension } from '@tiptap/core';
import type { CommandProps } from '@tiptap/core';

export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'blockquote'],
      indentSize: 20,
      maxIndent: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const paddingLeft = element.style.paddingLeft;
              return paddingLeft ? parseInt(paddingLeft, 10) / this.options.indentSize : 0;
            },
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.indent) {
                return {};
              }
              return {
                style: `padding-left: ${attributes.indent * this.options.indentSize}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }: CommandProps) => {
          const { selection } = state;
          let hasChanged = false;
          tr.doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              const indent = Math.min((node.attrs.indent || 0) + 1, this.options.maxIndent);
              if (indent !== node.attrs.indent) {
                if (dispatch) {
                  tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
                }
                hasChanged = true;
              }
            }
          });
          return hasChanged;
        },
      outdent:
        () =>
        ({ tr, state, dispatch }: CommandProps) => {
          const { selection } = state;
          let hasChanged = false;
          tr.doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              const indent = Math.max((node.attrs.indent || 0) - 1, 0);
              if (indent !== node.attrs.indent) {
                if (dispatch) {
                  tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
                }
                hasChanged = true;
              }
            }
          });
          return hasChanged;
        },
    };
  },
});
