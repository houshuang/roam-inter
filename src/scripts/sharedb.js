import ShareDBClient from "@chilifrog/sharedb/lib/client";
import WebSocket from "reconnecting-websocket";
import json0 from "@minervaproject/ot-json0";

export const setupSharedb = callback => {
  console.log("Setting up sharedb");
  ShareDBClient.types.register(json0.type);
  ShareDBClient.types.defaultType = json0.type;

  const shareDbUrl = "wss://icchilisrv3.epfl.ch/sharedb?null";

  const socket = new WebSocket(shareDbUrl);
  const connection = new ShareDBClient.Connection(socket);
  window.inter.sharedbDoc = connection.get("rz", "roam-inter2");
  console.log(inter.sharedbDoc);
  window.inter.sharedbDoc.subscribe();
  window.inter.sharedbDoc.once("load", () => {
    if (!window.inter.sharedbDoc.type) {
      console.log("initiating doc");
      window.inter.sharedbDoc.create({ changes: [] });
    }
    console.log("ready, callback");
    callback();
  });
};

export const pushChange = change => {
  if (!change || !change.type) {
    return;
  }
  console.log(change);
  window.inter.sharedbDoc.submitOp({
    p: ["changes", 99999],
    li: change
  });
};
