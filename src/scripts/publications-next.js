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

const updatePub = (title, doc, after) => {
  console.log("updating ", title);
  const data = doc.data.tree;
  console.log(after);
  const newData = barrayToBMap(bPullTreeToBArray([after]));
  console.log(data, newData);
  const newBlocks = Object.keys(newData).filter((x) => !data[x]);
  const delBlocks = Object.keys(data).filter((x) => !newData[x]);
  const updateString = Object.keys(data).filter(
    (x) => newData[x] && data[x].string !== newData[x].string
  );
  const updateOrder = Object.keys(data).filter(
    (x) => newData[x] && data[x].order !== newData[x].order
  );

  console.log({ newBlocks, delBlocks, updateString, updateOrder });
  const ops = newBlocks
    .map((x) => ({ p: ["tree", x], oi: newData[x] }))
    .concat(delBlocks.map((x) => ({ p: ["tree", x], od: x })))
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
    );
  console.log(ops);

  ops.forEach((op) => doc.submitOp(op));
};

const createPub = ([title, uid]) => {
  const blockWC = barrayToBMap(btreeToBArray(getBlockWithChildren(uid, false)));
  console.log(blockWC);
  const doc = window.inter.connection.get(
    "inter",
    window.inter.dbname + "/" + title
  );
  doc.subscribe();
  doc.once("load", () => {
    if (!doc.type) {
      console.log("initiating doc");
      doc.create({ tree: blockWC || {} });
    }
    console.log(doc);
    console.log("ready, callback");
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
    const newPubs = pubs.filter((x) => !window.inter.pubs[x[0]]);
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
};

// {":block/children":[{":block/children":[{":block/string":"all reads are logged to a central server"},{":block/string":"easily see who else have taken notes"},{":block/string":"easily import PDF"},{":block/string":"download and open a PDF on a specific pagef"}],":block/string":"Scrobblr ((https://www.youtube.com/watch?v=O5LgG_K3y8A&ab_channel=StianH%C3%A5klev))"}],":block/string":"Videos"}"
// iwindow
//   .roamAlphaAPI
//   .data
//   .addPullWatch(
//   	"[:block/children :block/string {:block/children ...}]",
//     '[:block/uid "02-21-2021"]',
//      function a(before, after) { console.log("before", before, "after", after);)
