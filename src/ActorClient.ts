import { ActorConfig, ActorSubclass, AnonymousIdentity } from "@dfinity/agent";
import { InterfaceFactory } from "@dfinity/candid/lib/cjs/idl";
import {
  createActor,
  HttpAgentOptionsSyncIdentity,
  HttpAgentOptionsWithIdentity,
} from "./createActor";
import { PartitionKey, SortKey } from "./CanDBTypes";
import {
  BaseIndexCanisterType,
  IndexCanisterTypeWrapper,
  IndexClient,
} from "./IndexClient";

export interface ActorOptions {
  /**
   * The Actor IDL
   */
  IDL: InterfaceFactory;
  /**
   * Agent options for the ActorClient
   */
  agentOptions: HttpAgentOptionsSyncIdentity;
  /**
   * Actor options for the ActorClient
   */
  actorConfig?: ActorConfig;
}

interface ActorOptionsWithIdentity {
  IDL: InterfaceFactory;
  agentOptions: HttpAgentOptionsWithIdentity;
  actorConfig?: ActorConfig;
}

// All actors must have an skExists() method to be able to use the ActorClient
/**
 * Contains the mimumum viable methods that an actor canister must implement
 *
 * For example, all actors must have an skExists() method to be able to use the ActorClient
 */
export type BaseActorClientType = {
  skExists: (arg_0: string) => Promise<boolean>;
};

// TODO: Look into how I can force the developer to specify these types in the class instantiation (required)
/**
 * The ActorClient allows for a frontend to interface with one or many canisters that share a specific Internet Computer Actor type.
 *
 * @example
 * ```typescript
 * // Example of creating an ActorClient for interfacing with one or many User Actor canisters
 *
 * import { IndexCanister } from "..<path_to>/declarations/index/index.did"; // from generated index canister declaration files
 * import { UserCanister } from "..<path_to>/declarations/user/user.did"; // from generated user canister declaration files
 * import { idlFactory as UserCanisterIDL } from "..<path_to>/declarations/user"; // from generated user canister declaration files
 *
 * const userActorClient = new ActorClient<IndexCanister, UserCanister>({
 *   actorOptions: {
 *     IDL: UserCanisterIDL,
 *     agentOptions: {
 *       host: <insert_host>,
 *       identity: <insert_identity>
 *     },
 *   },
 *   indexClient: <insert_index_client>
 * });
 * ```
 *
 * @typeparam IndexCanisterType the canister interface (generated) for the index canister
 * @typeparam ActorCanisterType the canister interface (generated) for this specific actor client
 */
export class ActorClient<
  IndexCanisterType extends BaseIndexCanisterType = never,
  ActorCanisterType extends BaseActorClientType = never
> {
  /**
   * @ignore
   */
  private actorOptions: ActorOptionsWithIdentity;

  /**
   * @ignore
   */
  private indexClient: IndexClient<IndexCanisterTypeWrapper<IndexCanisterType>>;

  constructor(options: {
    /**
     * Options specific to the actor client being instantiated
     */
    actorOptions: ActorOptions;
    /**
     * The {@link IndexClient} connected to the index canister that is associated with this actor
     */
    indexClient: IndexClient<IndexCanisterTypeWrapper<IndexCanisterType>>;
  }) {
    this.actorOptions = {
      ...options.actorOptions,
      agentOptions: {
        ...options.actorOptions.agentOptions,
        identity:
          options.actorOptions.agentOptions.identity || new AnonymousIdentity(),
      },
    };
    this.indexClient = options.indexClient;
  }

  /**
   * @ignore
   */
  private createActorsFromCanisters(
    canisterIds: string[]
  ): ActorSubclass<ActorCanisterType>[] {
    return canisterIds.map((c) =>
      createActor<ActorCanisterType>({
        ...this.actorOptions,
        canisterId: c,
      })
    );
  }

  /**
   * Use to call a query function on all canisters with a specific PK
   *
   * @example
   * ```typescript
   * // Example calling the getPK() method defined on canisters with a specific PK via the User Actor
   *
   * const responses = await userActorClient.query<UserCanister["getPK"]>(
   *   PK,
   *   (actor) => actor.getPK()
   * );
   * ```
   *
   * @type @param F - Type parameter with the IDL actor type and function
   *   For example, userActorClient.request<UserCanister["getPK"]>, where F is UserCanister["getPK"]
   *
   * @param PK - Partition Key
   * @param queryFn - the query function that will be executed on the canister. Takes in an actor and
   *   returns the ReturnType of F
   * @param useCache - whether the index canister needs to be hit again to fetch relevant PK canisters,
   *   or if the request can use the PK to canister cache list to query directly without needing to do so
   *
   * @returns {Promise<PromiseSettledResult<Awaited<ReturnType<F>>[]} - An array of settled promises of
   *   the query ReturnType.
   */
  async query<F extends (...args: any[]) => ReturnType<F>>(
    PK: PartitionKey,
    queryFn: (actor: ActorSubclass<ActorCanisterType>) => ReturnType<F>,
    useCache?: boolean
  ): Promise<PromiseSettledResult<Awaited<ReturnType<F>>>[]> {
    const canisterIds = await this.indexClient.getCanistersForPK(PK, useCache);
    const actors = this.createActorsFromCanisters(canisterIds);
    return Promise.allSettled(actors.map((a) => queryFn(a)));
  }

  /**
   * Note: may remove this function depending on utilization - (originally wrote this to retrieve canister specific metrics for the hackathon demo)
   *
   * Similar to query, but returns a mapping of canisterId to the query result returned by that canister.
   *
   * Important if want canister level information for a pk and don't want to go through the indexing canister. This
   * is because going through the indexing canister would slow it down massively in a large multi-canister application
   *
   * @type @param F - Type parameter with the IDL actor type and function
   *   For example, userActorClient.request<UserCanister["getPK"]>, where F is UserCanister["getPK"]
   *
   * @param PK - Partition Key
   * @param queryFn - the query function that will be executed on the canister. Takes in an actor and
   *   returns the ReturnType of F
   * @param useCache - whether the index canister needs to be hit again to fetch relevant PK canisters,
   *   or if the request can use the PK to canister cache list to query directly without needing to do so
   *
   * @returns - a promise settled result mapping of canisterId to the result of the query (TypeDoc fail - see source code for return type)
   */
  async queryWithCanisterIdMapping<F extends (...args: any[]) => ReturnType<F>>(
    PK: PartitionKey,
    queryFn: (actor: ActorSubclass<ActorCanisterType>) => ReturnType<F>,
    useCache?: boolean
  ): Promise<
    PromiseSettledResult<Awaited<{ [canisterId: string]: ReturnType<F> }>>[]
  > {
    const canisterIds = await this.indexClient.getCanistersForPK(PK, useCache);
    const actors = this.createActorsFromCanisters(canisterIds);
    return Promise.allSettled(
      actors.map((a, i) => ({ [canisterIds[i]]: queryFn(a) }))
    );
  }

  // TODO: ensure that the function passed here is a query function
  /// Use to call a query function on all canisters with a specific PK
  /**
   * Use to call a query function on all canisters with a specific PK, and then to reduce that result
   *
   * @example
   * ```typescript
   * // An example making a query call to a getCount endpoint that returns a count, and then passing a reducer function that will reduce the response from potentially multiple canisters
   *
   * function reducer(acc: bigint, settledResult: PromiseSettledResult<Awaited<bigint>>): bigint {
   *   if (settledResult.status === "rejected") { return acc; };
   *   return acc + settledResult.value;
   * };
   *
   * const reducedResult = await userActorClient.queryReduce<UserCanister["getCount"], bigint>(
   *   PK,
   *   (actor) => actor.getCount(),
   *   reducer,
   *   BigInt(0)
   * );
   *
   * console.log("reduced result", reducedResult);
   * ```
   *
   * @type @param F - Type parameter with the IDL actor type and function
   *   For example, userActorClient.request<UserCanister["getPK"]>, where F is UserCanister["getPK"]
   * @type @param U - Type parameter signifying the return type of the reducer function
   *
   * @param PK - Partition Key
   * @param queryFn - the query function that will be executed on the canister. Takes in an actor and
   *   returns the ReturnType of F
   * @param reducer  - function to reduce the array result of the query function being called on one or more canisters
   * @param initialValue - intial value for the reducer
   * @param useCache - whether the index canister needs to be hit again to fetch relevant PK canisters,
   *   or if the request can use the PK to canister cache list to query directly without needing to do so
   *
   * @returns {Promise<PromiseSettledResult<Awaited<ReturnType<F>>[]} - An array of settled promises of
   *   the query ReturnType.
   *
   * @param PK
   * @param queryFn
   * @param reducer
   * @param initialValue
   * @param useCache
   * @returns
   */
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
    return (await this.query(PK, queryFn, useCache)).reduce(
      reducer,
      initialValue
    );
  }

  // TODO: try to ensure here that the function passed here is an update function
  // TODO: try to ensure that the value being updated is specific with respect to the SK
  //
  // Implementation
  //
  // 1. If multiple canisters with the PK exist, first makes a query call to each canister to see if the SK exists.
  // 2. If the PK + SK exists on a canister, update that canister
  // 3. If the PK + SK does NOT exist on a canister, performs the update (creation) on the most recent (non-full) canister to be spun up
  /**
   * Calls an update method on a single canister actor with the specific PK and SK.
   *
   * If multiple canisters with the PK exist, first makes a query call to each canister to see if the SK exists.
   *
   * @example
   * ```typescript
   * // An example making an update call to an updateUserAttributes endpoint that updates a specific user's attributes
   *
   *
   * let updateUserAttributesResult = await userActorClient.update<UserCanister["updateUserAttributes"]>(
   *   <insert PK>,
   *   <insert SK>,
   *   (actor) => actor.updateUserAttributes(attributes)
   * );
   *
   * console.log("result", updateUserAttributesResult);
   * ```
   *
   * @type @param F - Type parameter with the IDL actor type and function
   *    For example, userActorClient.request<UserCanister["<myUpdateFunction"]>, where F is UserCanister["<myUpdateFunction"]
   *
   * @param pk - partition key
   * @param sk - sort key
   * @param updateFn - update function to be called on the given actor
   * @returns - a promise with the result of the update function
   */
  async update<F extends (...args: any[]) => ReturnType<F>>(
    pk: PartitionKey,
    sk: SortKey,
    updateFn: (actor: ActorSubclass<ActorCanisterType>) => ReturnType<F>
  ): Promise<ReturnType<F>> {
    const canisterIds = await this.indexClient.getCanistersForPK(pk, false);

    // Can fail here if the incorrect primary key is used or if the index canister does not permit access to the PK for the calling principal
    if (canisterIds.length === 0) {
      throw new Error(
        "Unable to update this record. Please ensure the entity you are trying to update has the appropriate primary key (PK)"
      );
    }

    // array to store error multiple messages that could happen when calling multiple canisters
    const errors: string[] = [];

    // for update calls, never use the cache
    const matchingSK = (await this.query(pk, (a) => a.skExists(sk))).reduce(
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
