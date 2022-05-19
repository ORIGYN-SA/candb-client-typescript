import { IndexClient } from "./IndexClient";

import { IndexCanister } from "../example/src/declarations/index/index.did";
import { idlFactory as IndexCanisterIDL } from "../example/src/declarations/index";
import { UserCanister } from "../example/src/declarations/user/user.did";
import { idlFactory as UserCanisterIDL } from "../example/src/declarations/user";
import { ActorClient } from "./ActorClient";

async function go() {
  // const identity = new AnonymousIdentity();
  const host = "http://127.0.0.1:8000";
  const client = new IndexClient<IndexCanister>({
    indexCanisterOptions: {
      IDL: IndexCanisterIDL,
      canisterId: "xub3y-eqaaa-aaaaa-aaawq-cai",
      agentOptions: {
        host,
      },
    },
  });

  console.log("identity", client.identity);
  console.log("indexActor", client.indexCanisterActor);

  const testRes = await client.indexCanisterActor.getCanistersByPK("test");
  console.log("testRes", testRes);

  const canisterIds = await client.indexCanisterActor.createUser();
  if ([] === canisterIds) {
    return;
  }
  console.log("canisterIds", canisterIds);
  const PK = `user#${client.identity.getPrincipal().toText()}`;
  const meCanisters = await client.getCanistersForPK(PK);
  console.log("meRes", meCanisters);

  const userActorClient = new ActorClient<IndexCanister, UserCanister>({
    actorOptions: {
      IDL: UserCanisterIDL,
      agentOptions: {
        host: "http://127.0.0.1:8000",
      },
    },
    indexClient: client,
  });

  const response = await userActorClient.request<UserCanister["getPK"]>(
    PK,
    (actor) => actor.getPK()
  );
  console.log("response1", response);

  const cachedResponse = await userActorClient.request<UserCanister["getPK"]>(
    PK,
    (actor) => actor.getPK()
  );
  console.log("cachedResponse", cachedResponse);

  const unCachedResponse = await userActorClient.request<UserCanister["getPK"]>(
    PK,
    (actor) => actor.getPK(),
    false
  );
  console.log("unCachedResponse", unCachedResponse);

  const delRes = await client.indexCanisterActor.deleteLoggedInUser();
  console.log("after deleting pk", delRes);
}

go().then(() => console.log("done!"));
