import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeight = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'listItem'],
      defaultLineHeight: '1.5',
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: this.options.defaultLineHeight,
            parseHTML: element => element.style.lineHeight || this.options.defaultLineHeight,
            renderHTML: attributes => {
              if (!attributes.lineHeight || attributes.lineHeight === this.options.defaultLineHeight) {
                return {};
              }
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight: (lineHeight: string) => ({ tr, state, dispatch }) => {
        const { selection } = state;
        let hasChanged = false;
        tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            if (node.attrs.lineHeight !== lineHeight) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight });
              }
              hasChanged = true;
            }
          }
        });
        return hasChanged;
      },
      unsetLineHeight: () => ({ tr, state, dispatch }) => {
        const { selection } = state;
        let hasChanged = false;
        tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            if (node.attrs.lineHeight !== this.options.defaultLineHeight) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: this.options.defaultLineHeight });
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
