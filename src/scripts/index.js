import RoamClient from "roam-client";
import json0 from "ot-json0";
import ShareDBClient from "sharedb/lib/client";

ShareDBClient.types.register(json0.type);
ShareDBClient.types.defaultType = json0.type;

const shareDbUrl = "wss://chilifrog.epfl.ch";

const socket = new ReconnectingWebSocket(shareDbUrl, null, {
  minConnectionDelay: 1
});
const connection = new ShareDBClient.Connection(socket);
window.R = RoamClient;
window.c = connection;
console.log("Roam/Inter loaded");
