import { btree, btreeBlock, btreeBlock2 } from "./zettel";
import { btreeDiff, btreeToBArray, bArrayToBtree } from "./btreeDiff";
import { setupSharedb, connection } from "./sharedb";
// import { setupInterval } from "./publications";
import { setup } from "./publications-next";
import { setupConstants } from "./blockHelpers";
import {
  blocksToMarkdown,
  getPageWithChildren,
  getBlockWithChildren,
  insertBlockTreeAsChild,
} from "./blockHelpers";

if (!global.inter) {
  global.inter = {};
}

global.inter.blocksToMarkdown = blocksToMarkdown;
global.inter.getPageWithChildren = getPageWithChildren;
global.inter.getBlockWithChildren = getBlockWithChildren;
global.inter.insertBlockTreeAsChild = insertBlockTreeAsChild;
global.inter.btreeDiff = btreeDiff;
global.inter.btreeToBArray = btreeToBArray;
global.inter.bArrayToBtree = bArrayToBtree;

window.roamAlphaAPI.data.removePullWatch(); // for now, during testing
setupSharedb(() => {
  setupConstants();
  setup();
});
