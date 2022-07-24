# candb-client-typescript

A TypeScript client for CanDB (NodeJS or in browser)

## Installation

(Prior to the alpha) - `npm install candb-client-typescript-dev-testing`

Alpha & post-alpha `npm install candb-client-typescript`

## Documentation

https://www.candb.canscale.dev/client-typescript

## Example

The `test_scripts/doIt.ts` script showcases a "rough" example using the candb-client to interact with a backend
application located in the `example` folder.

This script uses the client to perform a wide variety of operations on the backend canisters including query & update calls, as well as canister creation, upgrades, and deletion.

This specific example uses a key I've generated locally using steps 1-6 of [these instructions](https://forum.dfinity.org/t/using-dfinity-agent-in-node-js/6169/50), and allows one to control the generation of identities locally that interact with any backend application. This can be useful for managing your application or canister fleet with a NodeJS script or application.

## License

candb-client-typescript is distributed under the terms of the Apache License (Version 2.0).

See LICENSE for details.
