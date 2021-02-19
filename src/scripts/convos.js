import { pushChange } from "./sharedb";
import { getBlockWithChildren, insertBlockTreeAsChild } from "./blockHelpers";
import { checkPub, checkSub } from "./publications";
import cuid from "cuid";

export const checkConvo = subname => {
  const sub = window.inter.convos[subname];
  const changes = window.inter.sharedbDoc.data.changes;

  const pubchannel = subname + "-" + window.inter.dbname;
  // publish own sub
  if (!sub.published) {
    const blocks = getBlockWithChildren(sub.uid);
    console.log(blocks.children);
    window.inter.convos[subname].published = true;
    if (!blocks.children) {
      window.inter.convos[subname].published = true;
      pushChange({
        subname,
        type: "joinConvo",
        name: window.inter.dbname
      });

      // create block and publish
      const id = cuid();
      roamAlphaAPI.createBlock({
        location: { "parent-uid": sub.uid, order: 0 },
        block: { string: window.inter.dbname + " -- ONLY TYPE HERE", uid: id }
      });
      const id2 = cuid();
      roamAlphaAPI.createBlock({
        location: { "parent-uid": id, order: 0 },
        block: { string: "Edit me", uid: id2 }
      });

      // set up publishing for that uid
      const name = pubchannel;
      window.inter.pubs[name] = {
        interval: setInterval(() => checkPub(name), 700),
        uid: id,
        type: "convo"
      };
      checkPub(name);
    }
  }

  if (changes.length === sub.index) {
    return;
  }

  // process incoming changes
  changes
    .slice(sub.index, 9999)
    .filter(f => f.subname === sub.subname)
    .forEach(f => {
      if (f.type === "joinConvo" && f.name !== window.inter.dbname) {
        // insert block and set up subscription

        const id = cuid();
        roamAlphaAPI.createBlock({
          location: { "parent-uid": sub.uid, order: 0 },
          block: { string: f.name, uid: id }
        });
        const name = subname + "-" + f.name;
        window.inter.subs[name] = {
          interval: setInterval(() => checkSub(name), 500),
          uid: id,
          index: 0,
          subname: name
        };
        checkSub(name);
      }
    });

  sub.index = changes.length;
  window.inter.convos[subname].published = true;
};
