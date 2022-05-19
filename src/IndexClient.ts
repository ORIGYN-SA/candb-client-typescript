import {
  Identity,
  ActorSubclass,
  ActorMethod,
  AnonymousIdentity,
} from "@dfinity/agent";
import { createActor, CreateActorOptions } from "./createActor";
import { PartitionKey } from "./Entity";

/**
 * Steps:
 *
 * 1. Make request with PK to canister manager -> returns canisterIds
 * 2. Make request to canisters with canisterIds
 */

export type BaseIndexCanisterType = {
  getCanistersByPK: (arg_0: string) => Promise<Array<string>>;
};

export type IndexCanisterTypeWrapper<T> = BaseIndexCanisterType & {
  [K in keyof T]: ActorMethod;
};

export interface IndexActorClientProps {
  identity?: Identity;
  indexCanisterOptions: CreateActorOptions;
}

// TODO: Look into how I can force the developer to specify this type in the class instantiation (required)
export class IndexClient<T extends BaseIndexCanisterType = never> {
  identity: Identity;

  indexCanisterActor: ActorSubclass<IndexCanisterTypeWrapper<T>>;

  // caches the canisters of certain pks
  private canisterMap: Map<string, string[]>;

  constructor({ identity, indexCanisterOptions }: IndexActorClientProps) {
    this.identity = identity || new AnonymousIdentity();
    this.indexCanisterActor =
      createActor<IndexCanisterTypeWrapper<T>>(indexCanisterOptions);
    this.canisterMap = new Map<string, string[]>();
  }

  setIdentityAndIndexCanister(identity: Identity) {
    this.identity = identity;
  }

  setIndexCanister(indexCanisterOptions: CreateActorOptions) {
    this.indexCanisterActor =
      createActor<IndexCanisterTypeWrapper<T>>(indexCanisterOptions);
  }

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
}
