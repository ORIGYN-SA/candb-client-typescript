import { ActorSubclass } from "@dfinity/agent";
import { homedir } from "os";
import { IndexClient } from "../src/IndexClient";

import { IndexCanister } from "../example/src/declarations/index/index.did";
import { idlFactory as IndexCanisterIDL } from "../example/src/declarations/index/index";
import {
  ScanResult,
  UserCanister,
} from "../example/src/declarations/user/user.did";
import { idlFactory as UserCanisterIDL } from "../example/src/declarations/user";
import { ActorClient } from "../src/ActorClient";
import { identityFromSeed, loadWasm } from "../src/ClientUtil";

async function go() {
  const host = "http://127.0.0.1:8000";
  const client = new IndexClient<IndexCanister>({
    IDL: IndexCanisterIDL,
    canisterId: "2fiah-qiaaa-aaaaa-aagdq-cai",
    agentOptions: {
      host,
      identity: await identityFromSeed(
        `${homedir}/.config/dfx/identity/local-testing/seed.txt`
      ),
    },
  });

  console.log("identity", client.getIdentity());
  console.log("text identity", client.getIdentity().getPrincipal().toText());
  console.log("indexActor", client.indexCanisterActor);

  const testRes = await client.indexCanisterActor.getCanistersByPK("test");
  console.log("testRes", testRes);

  const canisterIds = await client.indexCanisterActor.createUser();
  if ([] === canisterIds) {
    return;
  }
  console.log("canisterIds", canisterIds);
  const PK = `user#${client.getIdentity().getPrincipal().toText()}`;
  console.log("PK", PK);
  let meCanisters = await client.getCanistersForPK(PK);
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

  function createSK(count: bigint) {
    return `item#${count}`;
  }
  function createEntities(start: number) {
    const promises = [];
    for (let i = start; i < start + 4; i += 1) {
      const SK = createSK(BigInt(i));
      promises.push(
        userActorClient.update<UserCanister["addEntity"]>(PK, SK, (actor) =>
          actor.addEntity(SK)
        )
      );
    }
    return promises;
  }

  let result = await Promise.allSettled(createEntities(0));
  console.log("result", result);
  meCanisters = await client.getCanistersForPK(PK);
  console.log("meRes", meCanisters);
  meCanisters = await client.getCanistersForPK(PK);
  console.log("meRes", meCanisters);
  result = await Promise.allSettled(createEntities(4));
  console.log("result", result);
  meCanisters = await client.getCanistersForPK(PK);
  console.log("meRes", meCanisters);
  result = await Promise.allSettled(createEntities(2));
  console.log("result", result);
  meCanisters = await client.getCanistersForPK(PK);
  console.log("meRes", meCanisters);
  result = await Promise.allSettled(createEntities(6));
  console.log("result", result);
  meCanisters = await client.getCanistersForPK(PK);
  console.log("meRes", meCanisters);

  const entities = await userActorClient.query<UserCanister["getEntities"]>(
    PK,
    (actor) => actor.getEntities(),
    false
  );
  console.log("entities", entities);
  const mappedEntities = (entities as PromiseFulfilledResult<ScanResult>[]).map(
    (e) => e.value.entities
  );
  console.log("mappedEntities", mappedEntities);
  console.log(
    "length",
    (entities[0] as PromiseFulfilledResult<ScanResult>).value.entities.length
  );

  const response = await userActorClient.query<UserCanister["getPK"]>(
    PK,
    (actor) => actor.getPK()
  );
  console.log("response1", response);

  const cachedResponse = await userActorClient.query<UserCanister["getPK"]>(
    PK,
    (actor) => actor.getPK()
  );
  console.log("cachedResponse", cachedResponse);

  const unCachedResponse = await userActorClient.query<UserCanister["getPK"]>(
    PK,
    (actor) => actor.getPK(),
    false
  );
  console.log("unCachedResponse", unCachedResponse);

  const incrementFunction =
    (i: bigint) =>
    async (userActor: ActorSubclass<UserCanister>): Promise<bigint> =>
      userActor.incrementByNat(i);

  let count = await userActorClient.query<UserCanister["getCount"]>(
    PK,
    (actor) => actor.getCount()
  );

  console.log("count", count);

  const incrementBy5 = incrementFunction(BigInt(5));

  let increment = await userActorClient.update<UserCanister["incrementByNat"]>(
    PK,
    "TODO",
    incrementBy5
  );

  console.log("increment", increment);

  count = await userActorClient.query<UserCanister["getCount"]>(PK, (actor) =>
    actor.getCount()
  );

  console.log("count", count);

  await client.indexCanisterActor.createAdditionalCanisterForUser();
  console.log("canisterIds", await client.getCanistersForPK(PK));

  console.log(
    "counts after creation",
    await userActorClient.query<UserCanister["getCount"]>(PK, (actor) =>
      actor.getCount()
    )
  );

  increment = await userActorClient.update<UserCanister["incrementByNat"]>(
    PK,
    "TODO",
    incrementBy5
  );

  console.log(
    "counts after increment",
    await userActorClient.query<UserCanister["getCount"]>(PK, (actor) =>
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

  let test = await userActorClient.query<UserCanister["test"]>(PK, (actor) =>
    actor.test()
  );
  console.log("test", test);
  console.log("upgrading user canister");

  const wasmPath = `${process.cwd()}/example/.dfx/local/canisters/user/user.wasm`;
  const data = loadWasm(wasmPath);
  await client.indexCanisterActor.upgradeUserCanisters(data);

  test = await userActorClient.query<UserCanister["test"]>(PK, (actor) =>
    actor.test()
  );
  console.log("test", test);

  await client.indexCanisterActor.createAdditionalCanisterForUser();
  test = await userActorClient.query<UserCanister["test"]>(PK, (actor) =>
    actor.test()
  );
  console.log("test", test);

  const indexWasmPath = `${process.cwd()}/example/.dfx/local/canisters/index/index.wasm`;
  const indexData = loadWasm(indexWasmPath);
  console.log("upgrading the index canister");
  try {
    await client.upgradeIndexCanister(indexData);
    console.log("completed upgrading the index canister");
  } catch (err) {
    console.log("error upgrading the index canister", err);
  }

  await client.indexCanisterActor.createAdditionalCanisterForUser();
  test = await userActorClient.query<UserCanister["test"]>(PK, (actor) =>
    actor.test()
  );
  console.log("test", test);

  const delRes = await client.indexCanisterActor.deleteLoggedInUser(); // deleteLoggedInUser();
  console.log("after deleting pk", delRes);
}

go().then(() => console.log("done!"));
