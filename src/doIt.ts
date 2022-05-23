import { ActorSubclass } from "@dfinity/agent";
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
      canisterId: "t6rzw-2iaaa-aaaaa-aaama-cai",
      agentOptions: {
        host,
      },
    },
  });

  console.log("identity", client.identity);
  console.log("text identity", client.identity.getPrincipal().toText());
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
        host,
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

  const incrementFunction =
    (i: bigint) =>
    async (userActor: ActorSubclass<UserCanister>): Promise<bigint> => userActor.incrementByNat(i);

  let count = await userActorClient.request<UserCanister["getCount"]>(
    PK,
    (actor) => actor.getCount()
  );

  console.log("count", count);

  const incrementBy5 = incrementFunction(BigInt(5));

  let increment = await userActorClient.update<UserCanister["incrementByNat"]>(
    { PK, SK: "TODO", Attributes: {} },
    incrementBy5
  );

  console.log("increment", increment);

  count = await userActorClient.request<UserCanister["getCount"]>(PK, (actor) =>
    actor.getCount()
  );

  console.log("count", count);

  await client.indexCanisterActor.createAdditionalCanisterForUser();
  console.log("canisterIds", await client.getCanistersForPK(PK));

  console.log(
    "counts after creation",
    await userActorClient.request<UserCanister["getCount"]>(PK, (actor) =>
      actor.getCount()
    )
  );

  increment = await userActorClient.update<UserCanister["incrementByNat"]>(
    { PK, SK: "TODO", Attributes: {} },
    incrementBy5
  );

  console.log(
    "counts after increment",
    await userActorClient.request<UserCanister["getCount"]>(PK, (actor) =>
      actor.getCount()
    )
  );

  function reducer(
    acc: bigint,
    settledResult: PromiseSettledResult<Awaited<bigint>>
  ): bigint {
    if (settledResult.status === "rejected") {
      return acc;
    } 
      return acc + settledResult.value;
    
  }

  const reduce = await userActorClient.queryReduce<
    UserCanister["getCount"],
    bigint
  >(PK, (actor) => actor.getCount(), reducer, BigInt(0));

  console.log("reduced result", reduce);

  const delRes = await client.indexCanisterActor.deleteLoggedInUser(); // deleteLoggedInUser();
  console.log("after deleting pk", delRes);
}

go().then(() => console.log("done!"));
