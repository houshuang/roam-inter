// from  https://github.com/dvargas92495/roam-js-extensions/blob/c9206c6268b2150cc3134de304bf4cac8e71fc67/src/entry-helpers.ts
export const blockRefRegex = new RegExp("\\(\\((..........?)\\)\\)", "g");
export const resolveRefs = (text: string): string => {
  return text.replace(blockRefRegex, (_, blockUid) => {
    const reference = getTextByBlockUid(blockUid);
    return reference || blockUid;
  });
};
