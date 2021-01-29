import { btree, btreeBlock, btreeBlock2 } from "./zettel";
import { btreeDiff, btreeToBArray, bArrayToBtree } from "./btreeDiff";
import { setupSharedb, connection } from "./sharedb";
import { setupInterval } from "./publications";
import {
  blocksToMarkdown,
  getPageWithChildren,
  getBlockWithChildren,
  insertBlockTreeAsChild
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

setupSharedb(() => {
  setupInterval();
});
