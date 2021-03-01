export const simulateRoamAction = (ba, action) => {
  if (action.type === "update") {
    ba.find((x) => x.uid === action.uid).string = action.string;
  }
  if (action.type === "remove") {
    const toDeleteIdx = ba.findIndex((x) => x.uid === action.uid);
    const toDelete = ba[toDeleteIdx];
    const changeOrder = ba
      .filter(
        (x) =>
          toDelete["parent-uid"] === x["parent-uid"] && x.order > toDelete.order
      )
      .forEach((f) => (f.order -= 1));
    ba.splice(toDeleteIdx, 1);
  }

  return ba;
};
