import cuid from "cuid";
import { replaceBlockRef, cleanBlockRef } from "./publications";

// takes a tree of blocks, and sorts them recursively, using the order key
export const sortBlockTree = (btree, recur = 0, addDBName) => {
  if (btree) {
    const res = btree.sort((x, y) => x.order - y.order);
    const newRes = res.map(
      x =>
        x.children
          ? { ...x, children: sortBlockTree(x.children, recur++, addDBName) }
          : x
    );
    if (addDBName) {
      const db = window.inter.dbname;
      return newRes.map(x => {
        x.uid = db + "/" + x.uid;
        x.string = replaceBlockRef(x.string, db);
        return x;
      });
    } else {
      return newRes;
    }
  }
};

// takes a sorted tree of blocks, and renders it as simple Markdown with hierarchical bullets
export const blocksToMarkdown = (blocks, indent = 0) => {
  if (!blocks || blocks.length === 0) {
    return "";
  }
  const md = blocks.reduce(
    (acc, x) =>
      `${acc}${"  ".repeat(indent * 2)}- ${x.string ||
        x.title}\n${blocksToMarkdown(x.children, indent + 1)}`,
    ""
  );
  return md;
};

// takes a block uid and returns a tree of blocks, sorted
export const getBlockWithChildren = (uid, addDBName) => {
  if (!uid) {
    console.error("No uid");
    return;
  }
  uid = uid.replace("((", "").replace("))", "");
  const blocks = roamAlphaAPI.q(
    `[ :find (pull ?e [ :node/title :block/string :block/uid :block/parent-uid :block/children :block/order :block/time {:block/children ...} ]) :where [?e :block/uid "${uid}"]]`
  );
  return sortBlockTree(blocks[0], 0, addDBName);
};

// takes a title string and returns a tree of blocks, sorted
export const getPageWithChildren = title => {
  const blocks = roamAlphaAPI.q(
    `[ :find (pull ?e [ :node/title :block/string :block/uid :block/children :block/order :block/time {:block/children ...} ]) :where [?e :node/title "${title}"]]`
  );
  const res = sortBlockTree(blocks[0]);
  return res;
};

export const setupConstants = () => {
  const blocks = roamAlphaAPI.q(
    `[ :find (pull ?e [ :node/title :block/uid ]) :where [?e :node/title "roam/inter/depot"]]`
  );
  if (blocks.length === 0) {
    roamAlphaAPI.createPage({
      page: { title: "roam/inter/depot", uid: "roam/inter/depot" }
    });
    window.inter.depot = "roam/inter/depot";
  } else {
    window.inter.depot = blocks[0][0].uid;
    window.inter.dbname = document.location.href
      .split("/app/")[1]
      .split("/")[0];
  }
};

export const insertBlockTreeAsChild = (btree, parentUid, order) => {
  parentUid = parentUid.replace("((", "").replace("))", "");
  if (!btree || btree.length === 0) {
    return;
  }
  btree.forEach((node, i) => {
    const nodeId = node.uid;
    let str = node.title || node.string;
    if (!str) {
      console.warn(node);
    } else {
      roamAlphaAPI.createBlock({
        location: { "parent-uid": parentUid, order: i + order },
        block: { string: cleanBlockRef(node.string || node.title), uid: nodeId }
      });
    }
    insertBlockTreeAsChild(node.children, nodeId, 0);
  });
};
