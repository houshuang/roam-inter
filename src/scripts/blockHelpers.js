import cuid from "cuid";

// takes a tree of blocks, and sorts them recursively, using the order key
export const sortBlockTree = (btree, recur = 0) => {
  if (btree) {
    const res = btree.sort((x, y) => x.order - y.order);
    const newRes = res.map(
      x =>
        x.children ? { ...x, children: sortBlockTree(x.children, recur++) } : x
    );
    return newRes;
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
export const getBlockWithChildren = uid => {
  if (!uid) {
    console.error("No uid");
    return;
  }
  uid = uid.replace("((", "").replace("))", "");
  const blocks = roamAlphaAPI.q(
    `[ :find (pull ?e [ :node/title :block/string :block/uid :block/parent-uid :block/children :block/order :block/time {:block/children ...} ]) :where [?e :block/uid "${uid}"]]`
  );
  return sortBlockTree(blocks[0]);
};

// takes a title string and returns a tree of blocks, sorted
export const getPageWithChildren = title => {
  const blocks = roamAlphaAPI.q(
    `[ :find (pull ?e [ :node/title :block/string :block/uid :block/children :block/order :block/time {:block/children ...} ]) :where [?e :node/title "${title}"]]`
  );
  return sortBlockTree(blocks[0]);
};

export const insertBlockTreeAsChild = (
  btree,
  parentUid,
  order,
  target,
  processString
) => {
  parentUid = parentUid.replace("((", "").replace("))", "");
  if (!btree || btree.length === 0) {
    return;
  }
  btree.forEach((node, i) => {
    const nodeId = target ? target + "/" + node.uid : cuid();
    let str = node.title || node.string;
    if (str && processString) {
      str = processString(str);
    }
    console.log(str);
    if (!str) {
      console.warn(node);
    } else {
      roamAlphaAPI.createBlock({
        location: { "parent-uid": parentUid, order: i + order },
        block: { string: node.string || node.title, uid: nodeId }
      });
    }
    insertBlockTreeAsChild(node.children, nodeId, 0, target, processString);
  });
};
