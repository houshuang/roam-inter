import ShareDBClient from "@chilifrog/sharedb/lib/client";
import ReconnectingWebSocket from "reconnecting-websocket";
import json0 from "@minervaproject/ot-json0";

export const setupSharedb = () => {
  console.log("Setting up sharedb");
  ShareDBClient.types.register(json0.type);
  ShareDBClient.types.defaultType = json0.type;

  const shareDbUrl = "wss://icchilisrv3.epfl.ch/sharedb?null";

  if (!window.inter.socket) {
    window.inter.socket = new ReconnectingWebSocket(shareDbUrl, null, {
      minConnectionDelay: 1
    });
    window.inter.connection = new ShareDBClient.Connection(window.inter.socket);
  }
};
