import cuid from "cuid";
import { getBlockWithChildren, insertBlockTreeAsChild } from "./blockHelpers";
import {
  simpleCompare,
  btreeToBArray,
  barrayToBMap,
  bPullTreeToBArray,
} from "./btreeDiff";
import { pushChange } from "./sharedb";
import { orderBy, cloneDeep, sum, throttle } from "lodash";

if (!window.inter) {
  window.inter = {};
}

const blockRegexp = new RegExp("\\(\\((.+?)\\)\\)", "g");

window.inter.pubs = {};
window.inter.subs = {};

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

const updatePub = (title, doc, rawWc, rawNewData) => {
  if (!window.inter.pubs[title]) {
    console.log("Pub already removed, cancelling update", title);
    return;
  }
  const data = doc.data.tree;
  const wc = inter.pubs[title].isBlockRef
    ? rawWc
    : rawWc && rawWc[":block/children"]
    ? rawWc[":block/children"]
    : [];
  const newData = rawNewData || barrayToBMap(bPullTreeToBArray(wc));
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

  // Deal with external block-refs
  const blockRefs = JSON.stringify(newData).match(blockRegexp);
  const blocks = Object.keys(newData);
  const externalRefs = !blockRefs
    ? []
    : blockRefs
        .map((x) => x.slice(2, -2))
        .filter((x) => !blocks.find((z) => z.uid === x));

  externalRefs.forEach((ex) => {
    if (!window.inter.pubs[ex]) {
      createPub([ex, ex, true]);
    }
  });

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
  ops.forEach((op) => doc.submitOp(op));
};

const createPub = ([title, rawUid, isBlockRef]) => {
  console.log("Creating pub ", title);
  let uid = rawUid;
  const linkTitle = title.trim().match(/^\[\[(.+)\]\]$/);
  if (linkTitle) {
    try {
      const block = window.roamAlphaAPI.pull(
        "[:block/uid]",
        `[:node/title "${linkTitle[1]}"]`
      );
      uid = block[":block/uid"];
    } catch (e) {
      console.error(e);
      window.alert(
        `Cannot publish non-existant page ${linkTitle[1]}. Please deactivate the publication (remove a colon), create page, and activate again`
      );
      return;
    }
  }
  const wcRaw = getBlockWithChildren(uid, false);
  const wc = isBlockRef
    ? wcRaw
    : wcRaw && wcRaw[0] && wcRaw[0].children
    ? wcRaw[0].children
    : [];
  const blockWC = barrayToBMap(btreeToBArray(wc));

  const qualifiedTitle = linkTitle
    ? `[[${window.inter.dbname}/${linkTitle[1]}]]`
    : window.inter.dbname + "/" + title;

  const doc = window.inter.connection.get("inter", qualifiedTitle);
  doc.subscribe();
  doc.once("load", () => {
    if (!doc.type) {
      doc.create({
        tree: blockWC || {},
      });
    }
    const callback = throttle((_, after) => updatePub(title, doc, after), 5000);
    window.inter.pubs[title] = { doc, uid, title, callback, isBlockRef };
    updatePub(title, doc, _, blockWC);
    console.log({ wcRaw, wc, blockWC });

    window.roamAlphaAPI.data.addPullWatch(
      "[:block/children :block/string :block/uid :block/order {:block/children ...}]",
      `[:block/uid "${uid}"]`,
      callback
    );
  });
};

const updateSub = (title, doc, uid) => {
  if (!doc.data || !doc.data.tree || !window.inter.subs[title]) {
    console.log(
      "No data in doc, or sub already removed, cancelling update",
      title
    );
    return;
  }

  const timeout = window.inter.subs[title].timeout;
  if (timeout) {
    clearTimeout(timeout);
  }

  const newData = doc.data.tree;

  const wcRaw = getBlockWithChildren(uid, false);
  const wc = wcRaw && wcRaw[0] && wcRaw[0].children ? wcRaw[0].children : [];
  const data = barrayToBMap(btreeToBArray(wc));
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

  // check external refs
  const blocks = Object.keys(newData);
  const hasBlockRefs = newBlocks.concat(updateString).reduce((acc, x) => {
    const blockrefs = x.string.match(blockRegexp);
    if (blockrefs) {
      console.log({ blockrefs });
      blockrefs
        .map((x) => x.slice(2, -2))
        .forEach((bref) => {
          if (!acc[bref]) {
            acc[bref] = [];
          }
          acc[bref].push(x);
        });
    }
    return acc;
  }, {});

  const externalRefs = Object.keys(hasBlockRefs).filter(
    (x) => !blocks.find((z) => z.uid === x)
  );

  const externalDb = title.split("/")[0].replace("[[", "");
  externalRefs.forEach((ex) => {
    const subName = `${externalDb}/${ex}`;
    if (!window.inter.subs[subName]) {
      createSub([subName, ex, true, hasBlockRefs[ex]]);
    }
  });

  // set timeout here in case we crash
  if (
    sum(
      [newBlocks, delBlocks, updateString, updateOrder, moveBlocks].map(
        (x) => x.length
      )
    ) > 0
  ) {
    inter.subs[title].timeout = window.setTimeout(
      () => updateSub(title, doc, uid),
      65 * 1000
    );
  }

  let orderedNewBlocks = [];
  const oldUids = Object.keys(data).map((x) => data[x].uid);

  // let's first see which blocks we can place with no problems
  newBlocks.forEach((block, i) => {
    if (!block["parent-uid"] || oldUids.includes(block["parent-uid"])) {
      orderedNewBlocks.push(block);
      block.hasBeenOrdered = true;
    }
  });

  // if there are blocks remaining, let's deal with them recursively
  let i = 0;
  while (newBlocks.filter((x) => !x.hasBeenOrdered).length > 0) {
    i++;
    // Just to avoid infinite loops if we make some mistakes, or data is poorly structured
    if (i > 30) {
      console.error(
        "Too many iterations trying to determine insertion order of new blocks"
      );
      break;
    }
    const newUids = orderedNewBlocks.map((x) => x.uid);
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
    } catch (e) {
      console.error("When creating ", blockSpecs, e);
    }
  });

  updateString.forEach((block) => {
    roamAlphaAPI.updateBlock({
      block: { uid: block.uid, string: block.string || "" },
    });
  });

  moveBlocks.forEach((block) => {
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

  const updateParents = new Set(
    updateOrder.map((block) => block["parent-uid"])
  );
  updateParents.forEach((parent) => {
    const children = Object.keys(newData)
      .filter((x) => newData[x]["parent-uid"] === parent)
      .map((x) => newData[x]);
    const sortedChildren = orderBy(children, "order");

    roamAlphaAPI.data.block.reorderBlocks({
      location: { "parent-uid": parent || uid },
      blocks: sortedChildren.map((x) => x.uid),
    });
  });
};

const createSub = ([title, rawUid, isBlockRef, blockRefCallbacks]) => {
  let uid = rawUid;
  console.log("Creating sub ", title);
  if (title.split("/")[0] === window.inter.dbname) {
    window.alert("Cannot subscribe to publications from your own database");
    return;
  }

  if (isBlockRef) {
    uid = roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": window.inter.depot, order: 0 },
      block: { string: title, uid },
    });
  }

  const linkTitle = title.trim().match(/^\[\[(.+)\]\]$/);
  if (linkTitle) {
    try {
      const block = window.roamAlphaAPI.pull(
        "[:block/uid]",
        `[:node/title "${linkTitle[1]}"]`
      );
      uid = block[":block/uid"];
    } catch (e) {
      console.log("Creating new page ", linkTitle[1]);
      uid = roamAlphaAPI.util.generateUID();
      roamAlphaAPI.createPage({ page: { title: linkTitle[1], uid } });
    }
  }

  const doc = window.inter.connection.get("inter", title);
  doc.subscribe();
  doc.once("load", () => {
    updateSub(title, doc, uid);
    doc.on(
      "op",
      throttle(() => updateSub(title, doc, uid), 5000)
    );

    if (blockRefCallbacks) {
      window.setTimeout(() => {
        blockRefCallbacks.forEach((bref) => {
          roamAlphaAPI.updateBlock({
            block: { uid: bref.uid, string: bref.string + " " },
          });
        }, 500);
      });
    }
  });
  window.inter.subs[title] = { doc, uid, title, isBlockRef };
};

const updatedPubs = (after) => {
  const pubs = after ? after[":block/_refs"].map((pub) => trySplit(pub)) : [];
  const newPubs = pubs.filter(
    (x) => x && Array.isArray(x) && !window.inter.pubs[x[0]]
  );
  const pubIds = pubs.map((x) => x[0]);
  const removedPubs = Object.keys(window.inter.pubs).filter(
    (x) => !pubIds.includes(x) && !window.inter.pubs[x].isBlockRef
  );

  console.log("Removed Pubs", removedPubs);
  removedPubs.forEach((pub) => {
    const toRemove = window.inter.pubs[pub];
    toRemove.doc.destroy();

    window.roamAlphaAPI.data.removePullWatch(
      "[:block/children :block/string :block/uid :block/order {:block/children ...}]",
      `[:block/uid "${toRemove.uid}"]`,
      toRemove.callback
    );
    delete window.inter.pubs[pub];
  });

  newPubs.forEach((pub) => createPub(pub));
};

const updatedSubs = (after) => {
  const subs = after ? after[":block/_refs"].map((sub) => trySplit(sub)) : [];
  const newSubs = subs.filter(
    (x) => x && Array.isArray(x) && !window.inter.subs[x[0]]
  );

  const subIds = subs.map((x) => x[0]);
  const removedSubs = Object.keys(window.inter.subs).filter(
    (x) => !subIds.includes(x) && !window.inter.subs[x].isBlockRef
  );
  console.log("Removed Subs", removedSubs);
  removedSubs.forEach((sub) => {
    const toRemove = window.inter.subs[sub];
    toRemove.doc.destroy();
    delete window.inter.subs[sub];
  });

  newSubs.forEach((sub) => createSub(sub));
};

// sets up pullwatch for pubs and subs, and then does initial sweep for both
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
