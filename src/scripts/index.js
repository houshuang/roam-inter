import json0 from "@minervaproject/ot-json0";
import ShareDBClient from "@chilifrog/sharedb/lib/client";
import ReconnectingWebSocket from "reconnecting-websocket";
import { btree, btreeBlock, btreeBlock2 } from "./zettel";
import { btreeDiff } from "./btreeDiff";
import cuid from "cuid";

const setup = () => {
  ShareDBClient.types.register(json0.type);
  ShareDBClient.types.defaultType = json0.type;

  const shareDbUrl = "wss://icchilisrv3.epfl.ch/sharedb?null";

  const socket = new ReconnectingWebSocket(shareDbUrl, null, {
    minConnectionDelay: 1
  });
  const connection = new ShareDBClient.Connection(socket);
  global.c = connection;
  global.rc = client;
};

// takes a tree of blocks, and sorts them recursively, using the order key
const sortBlockTree = (btree, recur = 0) => {
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
const blocksToMarkdown = (blocks, indent = 0) => {
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
const getBlockWithChildren = uid => {
  uid = uid.replace("((", "").replace("))", "");
  const blocks = roamAlphaAPI.q(
    `[ :find (pull ?e [ :node/title :block/string :block/uid :block/parent-uid :block/children :block/order :block/time {:block/children ...} ]) :where [?e :block/uid "${uid}"]]`
  );
  return sortBlockTree(blocks[0]);
};

// takes a title string and returns a tree of blocks, sorted
const getPageWithChildren = title => {
  const blocks = roamAlphaAPI.q(
    `[ :find (pull ?e [ :node/title :block/string :block/uid :block/children :block/order :block/time {:block/children ...} ]) :where [?e :node/title "${title}"]]`
  );
  return sortBlockTree(blocks[0]);
};

const insertBlockTreeAsChild = (btree, parentUid, order) => {
  parentUid = parentUid.replace("((", "").replace("))", "");
  if (!btree || btree.length === 0) {
    return;
  }
  btree.forEach((node, i) => {
    const nodeId = cuid();
    const str = node.title || node.string;
    if (!str) {
      console.warn(node);
    } else {
      roamAlphaAPI.createBlock({
        location: { "parent-uid": parentUid, order: i + order },
        block: { string: node.string || node.title, uid: nodeId }
      });
    }
    insertBlockTreeAsChild(node.children, nodeId, 0);
  });
};

// setup();
// tryStuff();
//
// const a = sortBlockTree(btree[0][0].children);
// console.dir(a, { depth: null, colors: true });
// console.log(blocksToMarkdown(a));
global.inter = {};
global.inter.blocksToMarkdown = blocksToMarkdown;
global.inter.getPageWithChildren = getPageWithChildren;
global.inter.getBlockWithChildren = getBlockWithChildren;
global.inter.insertBlockTreeAsChild = insertBlockTreeAsChild;
