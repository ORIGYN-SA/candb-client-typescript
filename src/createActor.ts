import {
  Actor,
  ActorConfig,
  ActorSubclass,
  AnonymousIdentity,
  HttpAgent,
  HttpAgentOptions,
  Identity,
} from "@dfinity/agent";
import { InterfaceFactory } from "@dfinity/candid/lib/cjs/idl";
import fetch from "node-fetch";

/**
 * Gets the appropriate fetch for the given environment (i.e. browser, node)
 *
 * @ignore
 * @returns fetch
 */
function getDefaultFetch() {
  if (typeof window !== "undefined") {
    // Browser context
    if (window.fetch) {
      const defaultFetch = window.fetch.bind(window);
      return defaultFetch;
    }
    throw new Error(
      "Fetch implementation was not available. You appear to be in a browser context, but window.fetch was not present."
    );
  } else if (typeof global !== "undefined") {
    return fetch as unknown as typeof globalThis.fetch;
  }

  // @ts-ignore
  const self: Window & typeof globalThis = this;
  if (typeof self !== "undefined") {
    if (self.fetch) {
      return self.fetch;
    }
  }

  throw new Error(
    "Fetch implementation was not available. Please provide fetch to the HttpAgent constructor, or ensure it is available in the window or global context."
  );
}

export interface HttpAgentOptionsSyncIdentity extends HttpAgentOptions {
  identity?: Identity;
}

export interface HttpAgentOptionsWithIdentity extends HttpAgentOptions {
  identity: Identity;
}

export interface CreateActorOptions {
  IDL: InterfaceFactory;
  canisterId: string;
  agentOptions: HttpAgentOptionsSyncIdentity;
  actorConfig?: ActorConfig;
}

export function createActor<T>({
  IDL,
  canisterId,
  agentOptions,
  actorConfig,
}: CreateActorOptions): ActorSubclass<T> {
  const agent = new HttpAgent({
    fetch: getDefaultFetch(),
    ...agentOptions,
    identity: agentOptions.identity || new AnonymousIdentity(),
  });

  if (process.env.NODE_ENV !== "production") {
    agent.fetchRootKey().catch((err) => {
      console.warn(
        "Unable to fetch root key. Check to ensure that your local replica is running"
      );
      console.error(err);
    });
  }

  return Actor.createActor<T>(IDL, {
    agent,
    canisterId,
    ...actorConfig,
  });
}
