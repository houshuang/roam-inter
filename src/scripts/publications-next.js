import cuid from "cuid";
import { getBlockWithChildren, insertBlockTreeAsChild } from "./blockHelpers";
import {
  simpleCompare,
  btreeToBArray,
  barrayToBMap,
  bPullTreeToBArray,
} from "./btreeDiff";
import { pushChange } from "./sharedb";

if (!window.inter) {
  window.inter = {};
}

window.inter.pubs = [];

const cancelAllPubs = () => {};

const trySplit = (item) => {
  const [first, last] = item[":block/string"].split("::");
  if (last) {
    return [last.trim(), item[":block/uid"]];
  }
};

const getInterAttribute = (attr) => {
  const rawHits = roamAlphaAPI.q(
    `[:find (pull ?question [:block/uid :block/string]) :where [?question :block/refs ?srPage] [?srPage :node/title "roam/inter/${attr}"] ]`
  );
  const hits = rawHits.map((x) => trySplit(x[0]));
  return hits;
};

const updatePub = (title, doc, after) => {
  const data = doc.data.tree;
  const newData = barrayToBMap(bPullTreeToBArray([after]));
  const newBlocks = Object.keys(newData).filter((x) => !data[x]);
  const delBlocks = Object.keys(data).filter((x) => !newData[x]);
  const updateString = Object.keys(data).filter(
    (x) => newData[x] && data[x].string !== newData[x].string
  );
  const updateOrder = Object.keys(data).filter(
    (x) => newData[x] && data[x].order !== newData[x].order
  );
  const updateParentUid = Object.keys(data).filter(
    (x) => newData[x] && data[x]["parent-uid"] !== newData[x]["parent-uid"]
  );

  const ops = newBlocks
    .map((x) => ({ p: ["tree", x], oi: newData[x] }))
    .concat(delBlocks.map((x) => ({ p: ["tree", x], od: true })))
    .concat(
      updateString.map((x) => ({
        p: ["tree", x, "string"],
        oi: newData[x].string,
      }))
    )
    .concat(
      updateOrder.map((x) => ({
        p: ["tree", x, "order"],
        oi: newData[x].order,
      }))
    )
    .concat(
      updateParentUid.map((x) => ({
        p: ["tree", x, "parent-uid"],
        oi: newData[x]["parent-uid"],
      }))
    );
  console.log(ops);
  ops.forEach((op) => doc.submitOp(op));
};

const createPub = ([title, uid]) => {
  console.log("Creating pub ", title);
  const blockWC = barrayToBMap(btreeToBArray(getBlockWithChildren(uid, false)));
  const doc = window.inter.connection.get(
    "inter",
    window.inter.dbname + "/" + title
  );
  doc.subscribe();
  doc.once("load", () => {
    if (!doc.type) {
      doc.create({ tree: blockWC || {} });
    }
    window.inter.pubs[title] = { doc, uid, title };

    window.roamAlphaAPI.data.addPullWatch(
      "[:block/children :block/string :block/uid :block/order {:block/children ...}]",
      `[:block/uid "${uid}"]`,
      (_, after) => updatePub(title, doc, after)
    );
  });
};

const updatedPubs = (after) => {
  if (!after) {
    cancelAllPubs();
  }
  if (after[":block/_refs"]) {
    const pubs = after[":block/_refs"].map((pub) => trySplit(pub));
    console.log({ after, pubs });
    const newPubs = pubs.filter((x) => x && !window.inter.pubs[x[0]]);
    newPubs.forEach((pub) => createPub(pub));
  }
};

// todo also need to do initial sweep!
export const setup = () => {
  roamAlphaAPI.data.addPullWatch(
    "[{:block/_refs [:block/string :block/uid]}]",
    '[:node/title "publication"]',
    (_, after) => updatedPubs(after)
  );
  const pubs = getInterAttribute("publication");
  pubs.forEach((x) => createPub(x));
};
