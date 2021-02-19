import cuid from "cuid";
import { getBlockWithChildren, insertBlockTreeAsChild } from "./blockHelpers";
import { simpleCompare, btreeToBArray } from "./btreeDiff";
import { pushChange } from "./sharedb";
import { checkConvo } from "./convos";

if (!window.inter) {
  window.inter = {};
}
window.inter.dbname = document.location.href.split("/app/")[1].split("/")[0];
const blockRegexp = new RegExp("\\(\\((.+?)\\)\\)", "g");
const dbBlockRegexp = new RegExp(
  `\\(\\(${window.inter.dbname}\\/(.+?)\\)\\)`,
  "g"
);
const pureBlockRegexp = new RegExp("\\(\\(([^/]+?)\\)\\)", "g");

const fixUid = uid => {
  if (!uid) {
    return uid;
  }
  const db = window.inter.dbname;
  const [_, second] = uid.split("/");
  return db + "/" + (second || uid);
};

export const replaceBlockRef = (string, target) =>
  (string || "").replace(pureBlockRegexp, `((${target}/$1))`);

export const cleanBlockRef = string => string.replace(dbBlockRegexp, `(($1))`);

const trySplit = item => {
  const [first, last] = item.string.split("::");
  if (last) {
    return [last.trim(), item.uid];
  }
};

const getInterAttribute = attr => {
  const rawHits = roamAlphaAPI.q(
    `[:find (pull ?question [:block/uid :block/string]) :where [?question :block/refs ?srPage] [?srPage :node/title "${attr}"] ]`
  );
  const hits = rawHits.map(x => trySplit(x[0]));
  return hits;
};

const fixBlockRefDb = block => {
  const db = window.inter.dbname;
  return {
    ...block,
    uid: fixUid(block.uid),
    "parent-uid": fixUid(block["parent-uid"]),
    string: replaceBlockRef(block.string, db)
  };
};

const actOnChanges = (subname, block, changes, topParent, externalRefs) => {
  (changes.newBlocks || []).forEach(f => {
    pushChange({
      subname,
      externalRefs,
      type: "create",
      block: fixBlockRefDb({
        ...f,
        "parent-uid":
          f["parent-uid"] === topParent ? undefined : f["parent-uid"]
      })
    });
  });
  (changes.updatedBlocks || []).forEach(f => {
    pushChange({
      externalRefs,
      subname,
      type: "update",
      block: fixBlockRefDb(f)
    });
  });
};

export const checkPub = pub => {
  const { pubs } = window.inter;
  const existingBlock = pubs[pub];
  if (!existingBlock) {
    console.warn("no pubs[pub] for me", pub);
  }
  const blockWC = getBlockWithChildren(existingBlock.uid, true);

  if (!blockWC) {
    console.warn("no blocks for pub", pub);
    return;
  }

  // really ugly approach but works
  const blockRefs = JSON.stringify(blockWC).match(blockRegexp);
  const blocks = btreeToBArray(blockWC);
  const externalRefs = !blockRefs
    ? []
    : blockRefs
        .map(x => x.slice(2, -2))
        .filter(x => !blocks.find(z => z.uid === x));

  externalRefs.forEach(ex => {
    const search = fixUid(ex);
    if (!window.inter.pubs[search]) {
      console.log("New external ref which needs to be published", ex);
      const [_, second] = ex.split("/");
      const uid = second || ex;

      window.inter.pubs[fixUid(ex)] = {
        interval: setInterval(() => checkPub(fixUid(ex)), 700),
        uid,
        type: "externalRef"
      };
      setTimeout(() => checkPub(fixUid(ex)), 0);
    }
  });

  const block =
    existingBlock.type === "externalRef" ? blockWC : blockWC[0].children;
  if (existingBlock.contents) {
    const changes = simpleCompare(existingBlock.contents, block);
    if (changes.newBlocks.length > 0 || changes.updatedBlocks.length > 0) {
      actOnChanges(
        pub,
        existingBlock,
        changes,
        existingBlock.uid,
        externalRefs
      );
    }
  } else {
    if (block) {
      pushChange({
        subname: pub,
        type: "instantiate",
        blockWithChildren: block,
        externalRefs: externalRefs.map(x => fixUid(x))
      });
    }
  }
  pubs[pub].contents = block;
};

const applyChange = (target, change) => {
  if (change.externalRefs) {
    change.externalRefs.filter(x => !window.inter.subs[x]).forEach(f => {
      const [_, second] = f.split("/");
      if (second === window.inter.dbname) {
        return;
      }
      const parentUid = cuid();
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": window.inter.depot, order: 0 },
        block: { string: f, uid: parentUid }
      });
      window.inter.subs[f] = {
        interval: setInterval(() => checkSub(f), 500),
        uid: parentUid,
        index: 0,
        subname: f
      };
      setTimeout(() => checkSub(f), 0);
    });
  }

  console.log("Applying change", change, " to target ", target);
  if (change.type === "instantiate") {
    const existingBlocks = getBlockWithChildren(target);
    console.log("trying to instantiate", target, change);
    if (!existingBlocks || !existingBlocks.children) {
      insertBlockTreeAsChild(change.blockWithChildren, target, 0);
    } else {
      console.warn("Need to instantiate but there are already children");
    }
  } else if (change.type === "update") {
    roamAlphaAPI.updateBlock({
      block: {
        uid: change.block.uid,
        string: cleanBlockRef(change.block.string)
      }
    });
  } else if (change.type === "create") {
    roamAlphaAPI.createBlock({
      location: {
        "parent-uid": change.block["parent-uid"]
          ? change.block["parent-uid"]
          : target,
        order: change.block.order
      },
      block: {
        uid: change.block.uid,
        string: cleanBlockRef(change.block.string)
      }
    });
  }
};

export const checkSub = subname => {
  const sub = window.inter.subs[subname];
  // if (!sub || !sub.index) {
  //   console.warn("no sub/sub.index", sub);
  //   return;
  // }
  const changes = window.inter.sharedbDoc.data.changes;
  if (changes.length === sub.index) {
    return;
  }

  // process incoming changes
  changes
    .slice(sub.index, 9999)
    .filter(f => f.subname === sub.subname)
    .forEach(f => {
      applyChange(sub.uid, f);
    });

  sub.index = changes.length;
};

export const checkPublications = () => {
  const pubs = getInterAttribute("pub");
  const subs = getInterAttribute("sub");
  const convos = getInterAttribute("conversation");

  const newConvos = convos.filter(x => !window.inter.convos[x[0]]);
  if (newConvos.length > 0) {
    console.log("new convos", newConvos);
  }
  const newPubs = pubs.filter(x => !window.inter.pubs[x[0]]);
  if (newPubs.length > 0) {
    console.log("new pubs", newPubs);
  }
  const newSubs = subs.filter(x => !window.inter.subs[x[0]]);
  if (newSubs.length > 0) {
    console.log("new subs", newSubs);
  }
  newSubs.forEach(f => {
    window.inter.subs[f[0]] = {
      interval: setInterval(() => checkSub(f[0]), 500),
      uid: f[1],
      index: 0,
      subname: f[0]
    };
    checkSub(f[0]);
  });

  newConvos.forEach(f => {
    window.inter.convos[f[0]] = {
      interval: setInterval(() => checkConvo(f[0]), 500),
      uid: f[1],
      index: 0,
      subname: f[0]
    };
    checkConvo(f[0]);
  });

  newPubs.forEach(f => {
    window.inter.pubs[f[0]] = {
      interval: setInterval(() => checkPub(f[0]), 500),
      uid: f[1]
    };
    checkPub(f[0]);
  });
  const removedPubs = Object.keys(window.inter.pubs).filter(
    f =>
      !pubs.find(z => z[0] === f) &&
      window.inter.pubs[f].type !== "externalRef" &&
      window.inter.pubs[f].type !== "convo"
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
  window.inter.convos = {};
  window.inter.checkConvo = checkConvo;
  checkPublications();
  window.inter.interval = setInterval(checkPublications, 500);
};
