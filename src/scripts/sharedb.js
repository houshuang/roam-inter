import ShareDBClient from "@chilifrog/sharedb/lib/client";
import WebSocket from "reconnecting-websocket";
import json0 from "@minervaproject/ot-json0";

if (!global.inter) {
  global.inter = {};
}

export const setup = () =>{
    ShareDBClient.types.register(json0.type);
    ShareDBClient.types.defaultType = json0.type;

    const shareDbUrl = "wss://icchilisrv3.epfl.ch/sharedb?null";

    const socket = new WebSocket(shareDbUrl);
    global.inter.connection = new ShareDBClient.Connection(socket);
 } 

global.inter.getStream = (streamname, callback) =>
  new Promise((resolve) => {
    const doc = global.inter.connection.get("rz", streamname);
    doc.subscribe();

    doc.pushChange = (change) => {
      if (!change)  {
        return;
      }
      doc.submitOp({
        p: ["changes", 99999],
        li: change,
      });

    };

    doc.rewrite = (change) => {
      doc.submitOp({
        p: ["changes"],
        oi: change,
      });
    };

    doc.getData = () => doc.data.changes;
    console.log('callback',callback)

    doc.on('op', (op)=>{
      console.log('incoming op', op)
      if(callback) { callback(doc.data.changes)}
    })

    doc.once("load", () => {
      if (!doc.type) {
        console.log("initiating doc");
        doc.create({ changes: [] });
      }
      resolve(doc);
    });
  });
