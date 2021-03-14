import cuid from "cuid";
import { getBlockWithChildren, insertBlockTreeAsChild } from "./blockHelpers";
import {
  simpleCompare,
  btreeToBArray,
  barrayToBMap,
  bPullTreeToBArray,
} from "./btreeDiff";
import { pushChange } from "./sharedb";
import { cloneDeep } from "lodash";

if (!window.inter) {
  window.inter = {};
}

window.inter.pubs = [];
window.inter.subs = [];

const cancelAllPubs = () => {};

const trySplit = (item) => {
  const [first, last] = (item[":block/string"] || item["string"]).split("::");
  if (last) {
    return [last.trim(), item[":block/uid"] || item.uid];
  }
};

const getInterAttribute = (attr) => {
  const rawHits = roamAlphaAPI.q(
    `[:find (pull ?question [:block/uid :block/string]) :where [?question :block/refs ?srPage] [?srPage :node/title "${attr}"] ]`
  );
  const hits = rawHits.map((x) => trySplit(x[0]));
  return hits.filter((x) => Array.isArray(x));
};

const updatePub = (title, doc, rawWc) => {
  const data = doc.data.tree;
  const wc = rawWc && rawWc[":block/children"] ? rawWc[":block/children"] : [];
  const newData = barrayToBMap(bPullTreeToBArray(wc));
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
      updateParentUid.map((x) =>
        newData[x]["parent-uid"]
          ? {
              p: ["tree", x, "parent-uid"],
              oi: newData[x]["parent-uid"],
            }
          : { p: ["tree", x, "parent-uid"], od: true }
      )
    );
  console.log("Applying ops for publication", title, ops);
  ops.forEach((op) => doc.submitOp(op));
};

const createPub = ([title, uid]) => {
  console.log("Creating pub ", title);
  const wcRaw = getBlockWithChildren(uid, false);
  const wc = wcRaw && wcRaw[0] && wcRaw[0].children ? wcRaw[0].children : [];
  const blockWC = barrayToBMap(btreeToBArray(wc));
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

const updateSub = (doc, uid) => {
  if (!doc.data || !doc.data.tree) {
    return;
  }

  const newData = doc.data.tree;
  const wcRaw = getBlockWithChildren(uid, false);
  const wc = wcRaw && wcRaw[0] && wcRaw[0].children ? wcRaw[0].children : [];
  const data = barrayToBMap(btreeToBArray(wc));
  console.log({ data, newData });
  const newBlocks = Object.keys(newData)
    .filter((x) => !data[x])
    .map((x) => newData[x]);
  const delBlocks = Object.keys(data)
    .filter((x) => !newData[x])
    .map((x) => data[x]);
  const updateString = Object.keys(data)
    .filter((x) => newData[x] && data[x].string !== newData[x].string)
    .map((x) => newData[x]);
  const updateOrder = Object.keys(data)
    .filter((x) => newData[x] && data[x].order !== newData[x].order)
    .map((x) => newData[x]);
  const moveBlocks = Object.keys(data)
    .filter(
      (x) => newData[x] && data[x]["parent-uid"] !== newData[x]["parent-uid"]
    )
    .map((x) => newData[x]);
  console.log({
    newBlocks,
    delBlocks,
    updateString,
    updateOrder,
    moveBlocks,
  });

  let orderedNewBlocks = [];
  const oldUids = Object.keys(data).map((x) => data[x].uid);

  // let's first see which blocks we can place with no problems
  newBlocks.forEach((block, i) => {
    if (!block["parent-uid"] || oldUids.includes(block["parent-uid"])) {
      orderedNewBlocks.push(block);
      block.hasBeenOrdered = true;
    }
  });
  console.log("first ordered", orderedNewBlocks);

  // if there are blocks remaining, let's deal with them recursively
  let i = 0;
  while (newBlocks.filter((x) => !x.hasBeenOrdered).length > 0) {
    i++;
    // Just to avoid infinite loops if we make some mistakes, or data is poorly structured
    if (i > 2) {
      console.error(
        "Too many iterations trying to determine insertion order of new blocks"
      );
      break;
    }
    const newUids = orderedNewBlocks.map((x) => x.uid);
    console.log("we have", newUids);
    newBlocks
      .filter((x) => !x.hasBeenOrdered)
      .forEach((block, i) => {
        if (newUids.includes(block["parent-uid"])) {
          orderedNewBlocks.push(block);
          block.hasBeenOrdered = true;
        } else {
          console.log("Still no match", block);
        }
      });
  }

  orderedNewBlocks.forEach((block) => {
    const blockSpecs = {
      location: {
        "parent-uid": block["parent-uid"] || uid,
        order: block.order,
      },
      block: { string: block.string || "", uid: block.uid },
    };

    try {
      window.roamAlphaAPI.createBlock(blockSpecs);
    } catch (e) {}
  });

  updateString.forEach((block) => {
    roamAlphaAPI.updateBlock({
      block: { uid: block.uid, string: block.string || "" },
    });
  });

  moveBlocks.forEach((block) => {
    console.log("moving block", block);
    roamAlphaAPI.moveBlock({
      block: { uid: block.uid },
      location: {
        "parent-uid": block["parent-uid"] || uid,
        order: block.order,
      },
    });
  });

  delBlocks.forEach((block) => {
    roamAlphaAPI.deleteBlock({
      block: { uid: block.uid },
    });
  });
};

const createSub = ([title, uid]) => {
  console.log("Creating sub ", title);
  if (title.split("/")[0] === window.inter.dbname) {
    window.alert("Cannot subscribe to publications from your own database");
    return;
  }

  const doc = window.inter.connection.get("inter", title);
  doc.subscribe();
  doc.once("load", () => {
    updateSub(doc, uid);
    doc.on("op", () => updateSub(doc, uid));
  });
  window.inter.subs[title] = { doc, uid, title };
};

const updatedPubs = (after) => {
  if (!after) {
    return;
  }
  if (after[":block/_refs"]) {
    const pubs = after[":block/_refs"].map((pub) => trySplit(pub));
    const newPubs = pubs.filter(
      (x) => x && Array.isArray(x) && !window.inter.pubs[x[0]]
    );
    newPubs.forEach((pub) => createPub(pub));
  }
};

const updatedSubs = (after) => {
  if (!after) {
    return;
  }
  if (after[":block/_refs"]) {
    const subs = after[":block/_refs"].map((sub) => trySplit(sub));
    const newSubs = subs.filter(
      (x) => x && Array.isArray(x) && !window.inter.subs[x[0]]
    );
    newSubs.forEach((sub) => createSub(sub));
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

  roamAlphaAPI.data.addPullWatch(
    "[{:block/_refs [:block/string :block/uid]}]",
    '[:node/title "subscription"]',
    (_, after) => updatedSubs(after)
  );
  const subs = getInterAttribute("subscription");
  subs.forEach((x) => createSub(x));
};
