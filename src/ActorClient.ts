import {
  ActorConfig,
  ActorSubclass,
  AnonymousIdentity,
  HttpAgentOptions,
  Identity,
} from "@dfinity/agent";
import { InterfaceFactory } from "@dfinity/candid/lib/cjs/idl";
import { createActor } from "./createActor";
import { Entity, PartitionKey } from "./Entity";
import {
  BaseIndexCanisterType,
  IndexCanisterTypeWrapper,
  IndexClient,
} from "./IndexClient";

interface ActorOptions {
  IDL: InterfaceFactory;
  agentOptions: HttpAgentOptions;
  actorConfig?: ActorConfig;
}

export interface ActorClientProps<I extends BaseIndexCanisterType> {
  identity?: Identity;
  actorOptions: ActorOptions;
  indexClient: IndexClient<IndexCanisterTypeWrapper<I>>;
}

export interface PKCanisters {
  canisterIds: string[]; // last canister is the insert canister (not full)
}

export type BaseActorClientType = {
  skExists: (arg_0: string) => Promise<boolean>;
};

// TODO: Look into how I can force the developer to specify these types in the class instantiation (required)
export class ActorClient<
  IndexCanisterType extends BaseIndexCanisterType = never,
  ActorCanisterType extends BaseActorClientType = never
> {
  identity: Identity;

  actorOptions: ActorOptions;

  indexClient: IndexClient<IndexCanisterTypeWrapper<IndexCanisterType>>;
  // TODO: look into caching the following
  // * responses of various function calls

  constructor({
    identity,
    actorOptions,
    indexClient,
  }: ActorClientProps<IndexCanisterType>) {
    this.identity = identity || new AnonymousIdentity();
    this.actorOptions = actorOptions;
    this.indexClient = indexClient;
  }

  createActorsFromCanisters(
    canisterIds: string[]
  ): ActorSubclass<ActorCanisterType>[] {
    return canisterIds.map((c) =>
      createActor<ActorCanisterType>({
        ...this.actorOptions,
        canisterId: c,
      })
    );
  }

  async request<F extends (...args: any[]) => Promise<any>>(
    PK: PartitionKey,
    queryFn: (actor: ActorSubclass<ActorCanisterType>) => ReturnType<F>,
    useCache?: boolean
  ): Promise<PromiseSettledResult<Awaited<ReturnType<F>>>[]> {
    const canisterIds = await this.indexClient.getCanistersForPK(PK, useCache);
    const actors = canisterIds.map((c) =>
      createActor<ActorCanisterType>({
        ...this.actorOptions,
        canisterId: c,
      })
    );

    return Promise.allSettled(actors.map((a) => queryFn(a)));
  }

  // TODO: ensure that the function passed here is a query function
  async queryReduce<F extends (...args: any[]) => Promise<any>, U>(
    PK: PartitionKey,
    queryFn: (actor: ActorSubclass<ActorCanisterType>) => ReturnType<F>,
    reducer: (
      accumulator: U,
      current: PromiseSettledResult<Awaited<ReturnType<F>>>
    ) => U,
    initialValue: U,
    useCache?: boolean
  ): Promise<U> {
    return (await this.request(PK, queryFn, useCache)).reduce(
      reducer,
      initialValue
    );
  }

  // TODO: try to ensure here that the function passed here is an update function
  // TODO: try to ensure that the value being updated is specific with respect to the SK
  async update<F extends (...args: any[]) => Promise<any>>(
    entity: Entity,
    updateFn: (actor: ActorSubclass<ActorCanisterType>) => ReturnType<F>
  ) {
    const canisterIds = await this.indexClient.getCanistersForPK(entity.PK);

    // Can fail here if the incorrect primary key is used or if the index canister does not permit access to the PK for the calling principal
    if (canisterIds.length === 0) {
      throw new Error(
        "Unable to update this record. Please ensure the entity you are trying to update has the appropriate primary key (PK)"
      );
    }

    // array to store error multiple messages that could happen when calling multiple canisters
    const errors: string[] = [];

    // for update calls, never use the cache
    const matchingSK = (
      await this.request(entity.PK, (a) => a.skExists(entity.SK))
    ).reduce(
      (
        acc,
        settledResult: PromiseSettledResult<
          Awaited<ReturnType<BaseActorClientType["skExists"]>>
        >,
        index
      ) => {
        const canisterId = canisterIds[index];
        if (settledResult.status === "rejected") {
          errors.push(
            `A call to canister: ${canisterId} was rejected due to ${settledResult.reason}`
          );
          return acc;
        }
        if (settledResult.value === true) return acc.concat(canisterId);
        return acc;
      },
      [] as string[]
    );

    if (matchingSK.length > 1) {
      errors.push(
        `Uniqueness constraint violation error. Found multiple occurences of the same PK + SK combination: ${matchingSK}`
      );
    }

    // If any errors exist, throw here before an update is made
    if (errors.length > 0) {
      throw new Error(errors.toString());
    }

    // the canister that the update call will be made to
    const canisterToMakeUpdateCallTo =
      matchingSK.length === 0
        ? // no matching sks meaning that the pk + sk was combination not found, so insert into most recent canister
          canisterIds[canisterIds.length - 1]
        : // otherwise insert into the first (and only) matching canisterId
          matchingSK[0];

    const updateCanisterActor = createActor<ActorCanisterType>({
      ...this.actorOptions,
      canisterId: canisterToMakeUpdateCallTo,
    });

    return updateFn(updateCanisterActor);
  }
}
