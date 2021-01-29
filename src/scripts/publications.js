import { getBlockWithChildren, insertBlockTreeAsChild } from "./blockHelpers";
import { simpleCompare } from "./btreeDiff";

const blockRegexp = new RegExp("\\(\\((.+?)\\)\\)", "g");
const replaceBlockRef = (string, target) =>
  string.replace(blockRegexp, `((${target}/$1))`);

const trySplit = item => {
  const [first, last] = item.string.split("::");
  if (last) {
    return [last.trim(), item.uid];
  }
};

const getInterAttribute = attr => {
  const rawHits = roamAlphaAPI.q(
    `[:find (pull ?question [:block/uid :block/string]) :where [?question :block/refs ?srPage] [?srPage :node/title "roam/inter/${attr}"] ]`
  );
  const hits = rawHits.map(x => trySplit(x[0]));
  return hits;
};

const actOnChanges = (subname, block, changes, topParent) => {
  (changes.newBlocks || []).forEach(f => {
    window.inter.changes.push({
      subname,
      type: "create",
      block: {
        ...f,
        "parent-uid":
          f["parent-uid"] === topParent ? undefined : f["parent-uid"]
      }
    });
  });
  (changes.updatedBlocks || []).forEach(f => {
    window.inter.changes.push({ subname, type: "update", block: f });
  });
};

const checkPub = pub => {
  const { pubs } = window.inter;
  const existingBlock = pubs[pub];
  if (!existingBlock) {
    return;
  }
  const block = getBlockWithChildren(existingBlock.uid)[0].children;
  if (existingBlock.contents) {
    const changes = simpleCompare(existingBlock.contents, block);
    if (changes.newBlocks.length > 0 || changes.updatedBlocks.length > 0) {
      actOnChanges(pub, existingBlock, changes, existingBlock.uid);
    }
  } else {
    if (block) {
      window.inter.changes.push({
        subname: pub,
        type: "instantiate",
        blockWithChildren: block
      });
    }
  }
  pubs[pub].contents = block;
};

const applyChange = (target, change) => {
  console.log("Applying change", change, " to target ", target);
  if (change.type === "instantiate") {
    const existingBlocks = getBlockWithChildren(target);
    console.log("trying to instantiate", target, change);
    if (!existingBlocks || !existingBlocks.children) {
      insertBlockTreeAsChild(change.blockWithChildren, target, 0, target, str =>
        replaceBlockRef(str, target)
      );
    } else {
      console.warn("Need to instantiate but there are already children");
    }
  } else if (change.type === "update") {
    roamAlphaAPI.updateBlock({
      block: {
        uid: target + "/" + change.block.uid,
        string: replaceBlockRef(change.block.string, target)
      }
    });
  } else if (change.type === "create") {
    roamAlphaAPI.createBlock({
      location: {
        "parent-uid": change.block["parent-uid"]
          ? target + "/" + change.block["parent-uid"]
          : target,
        order: change.block.order
      },
      block: {
        uid: target + "/" + change.block.uid,
        string: replaceBlockRef(change.block.string, target)
      }
    });
  }
};

const checkSub = subuid => {
  const sub = window.inter.subs[subuid];
  if (!sub || !sub.index) {
    console.warn("no sub/sub.index", sub);
  }
  const { changes } = window.inter;
  if (changes.length === sub.index) {
    return;
  }

  // process incoming changes
  changes
    .slice(sub.index, 9999)
    .filter(f => f.subname === sub.subname)
    .forEach(f => {
      applyChange(subuid, f);
    });

  sub.index = changes.length;
};

const checkPublications = () => {
  const pubs = getInterAttribute("publish");
  const subs = getInterAttribute("subscribe");
  const newPubs = pubs.filter(x => !window.inter.pubs[x[0]]);
  if (newPubs.length > 0) {
    console.log("new pubs", newPubs);
  }
  const newSubs = subs.filter(x => !window.inter.subs[x[1]]);
  if (newSubs.length > 0) {
    console.log("new subs", newSubs);
  }
  newSubs.forEach(f => {
    window.inter.subs[f[1]] = {
      interval: setInterval(() => checkSub(f[1]), 200),
      uid: f[1],
      index: 0,
      subname: f[0]
    };
    checkSub(f[1]);
  });
  newPubs.forEach(f => {
    window.inter.pubs[f[0]] = {
      interval: setInterval(() => checkPub(f[0]), 1000),
      uid: f[1]
    };
    checkPub(f[0]);
  });
  const removedPubs = Object.keys(window.inter.pubs).filter(
    f => !pubs.find(z => z[0] === f)
  );
  if (removedPubs.length > 0) {
    console.log("removed pubs", removedPubs);
  }
  removedPubs.forEach(f => {
    if (window.inter.pubs[f]) {
      clearInterval(window.inter.pubs[f].interval);
    }
    delete window.inter.pubs[f];
  });
};

export const setupInterval = () => {
  if (window.inter.interval) {
    console.log("Clearing old interval");
    clearInterval(window.inter.listener);
    Object.keys(window.inter.pubs || {}).forEach(f => {
      clearInterval(window.inter.pubs[f].interval);
    });
    Object.keys(window.inter.subs || {}).forEach(f => {
      clearInterval(window.inter.subs[f].interval);
    });
  }
  console.log("setting up interval");
  window.inter.checkPub = checkPub;
  window.inter.pubs = {};
  window.inter.subs = {};
  window.inter.changes = [];
  checkPublications();
  window.inter.interval = setInterval(checkPublications, 1000);
};
