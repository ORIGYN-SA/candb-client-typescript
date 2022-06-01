import {
  Identity,
  ActorSubclass,
  ActorMethod,
  ManagementCanisterRecord,
  AnonymousIdentity,
  ActorConfig,
} from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { InterfaceFactory } from "@dfinity/candid/lib/cjs/idl";
import managementCanisterIDL from "./management_idl";
import {
  createActor,
  CreateActorOptions,
  HttpAgentOptionsSyncIdentity,
  HttpAgentOptionsWithIdentity,
} from "./createActor";
import { PartitionKey } from "./CanDBTypes";

/**
 * Contains the mimumum viable methods that an index canister must implement
 */
export interface BaseIndexCanisterType {
  getCanistersByPK: (arg_0: string) => Promise<Array<string>>;
}

/**
 * Type wrapper to ensure that each of the methods of the IndexCanister is of type ActorMethod
 *
 * @typeparam IndexCanisterType - the canister interface (generated) for the index canister. This is automatically passed through by the IndexCanisterType param specified in the IndexClient class constructor
 */
export type IndexCanisterTypeWrapper<IndexCanisterType> =
  BaseIndexCanisterType & {
    [K in keyof IndexCanisterType]: ActorMethod;
  };

export type IndexClientOptions = CreateActorOptions;

// TODO: Look into how I can force the developer to specify this type in the class instantiation (require the type to be specified)
/**
 * Client used to interact with the CanDB Index Canister
 *
 * @example
 * ```
 * import { IndexClient } from 'candb-client-typescript';
 * import { IndexCanister } from "../project/src/declarations/index/index.did"; // from generated index canister declaration files
 * import { idlFactory as MyIndexCanisterIDL } from "../project/src/declarations/index"; // from generated index canister declaration files
 *
 * const indexClient = new IndexClient<IndexCanister>({
 *   IDL: IndexCanisterIDL,
 *   canisterId: <insert_index_canister_id>,
 *   agentOptions: {
 *     host: <insert_host>,
 *     identity: <insert_identity>
 *   },
 * });
 * ```
 *
 */
export class IndexClient<
  IndexCanisterType extends BaseIndexCanisterType = never
> {
  /**
   * @ignore
   */
  private indexCanisterId: string;

  /**
   * @ignore
   */
  private agentOptions: HttpAgentOptionsWithIdentity;

  /**
   * @ignore
   * cache of PK to list of canisterIds
   */
  private canisterMap: Map<string, string[]>;

  /**
   * Actor used for directly calling methods of the index canister
   */
  indexCanisterActor: ActorSubclass<
    IndexCanisterTypeWrapper<IndexCanisterType>
  >;

  constructor(options: {
    /**
     * The IDL of the index canister, should match the {@link IndexCanisterType}
     */
    IDL: InterfaceFactory;
    /**
     * The canisterId of the index canister
     */
    canisterId: string;
    /**
     * HttpAgent options for interfacing with the index canister
     */
    agentOptions: HttpAgentOptionsSyncIdentity;
    /**
     * Optional actor configuration for interfacing with the index canister
     */
    actorConfig?: ActorConfig;
  }) {
    this.indexCanisterId = options.canisterId;
    this.agentOptions = {
      ...options.agentOptions,
      identity: options.agentOptions.identity || new AnonymousIdentity(),
    };
    this.indexCanisterActor =
      createActor<IndexCanisterTypeWrapper<IndexCanisterType>>(options);
    this.canisterMap = new Map<string, string[]>();
  }

  /**
   *
   * @returns {Identity} returns the identity used by the {@link IndexClient}
   */
  getIdentity(): Identity {
    return this.agentOptions.identity;
  }

  /**
   * Retrieves a list of canisterIds associated with the provided PK
   *
   * @param PK The partition key
   * @param useCache The IndexClient stores a cache of PK to list of canisterIds. By default, the cache is not used and requests are made to the index canister. It is not recommended to use the cache when making update calls
   * @returns {string[]}
   */
  async getCanistersForPK(
    PK: PartitionKey,
    useCache: boolean = false
  ): Promise<string[]> {
    const canisterIds =
      useCache === true
        ? this.canisterMap.get(PK) ||
          (await this.indexCanisterActor.getCanistersByPK(PK))
        : await this.indexCanisterActor.getCanistersByPK(PK);
    this.canisterMap.set(PK, canisterIds);
    return canisterIds;
  }

  /**
   * Upgrades the index canister
   *
   * Calls the management canister `install_code` method with mode = upgrade and the provided wasm and arguments
   *
   * @param wasmModule The "Blob-ified" wasm module that will upgrade the index canister
   * @param args any arguments to be passed along with the upgrade
   * @returns {Promise<undefined>}
   */
  upgradeIndexCanister(
    wasmModule: number[],
    args: number[] = []
  ): Promise<undefined> {
    return createActor<ManagementCanisterRecord>({
      IDL: managementCanisterIDL,
      canisterId: "aaaaa-aa",
      agentOptions: this.agentOptions,
    }).install_code({
      mode: { upgrade: null },
      canister_id: Principal.fromText(this.indexCanisterId),
      wasm_module: wasmModule,
      arg: args,
    });
  }
}
