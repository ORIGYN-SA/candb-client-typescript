import { readFileSync } from "fs";
import { Ed25519KeyIdentity, Secp256k1KeyIdentity } from "@dfinity/identity";

const hdkey = require("hdkey");
const bip39 = require("bip39");
const pemfile = require("pem-file");

/**
 * Returns an identity in JavaScript that matches a dfx identity. This identity is produced from a quill generated seed phrase
 * 
 * @param seedPhrasePath path to the identity seedphrase
 * @returns {Promise<Secp256k1KeyIdentity>} Returns the identity of the seed phrase
 * 
 * @example
 * ```typescript
 * import { homedir } from 'os';
 * 
 * let identity = await identityFromSeed(`${homedir}/.config/dfx/identity/local-testing/seed.txt`);
 * ```
 * 
 * **Note:** This function is meant to be run locally in a NodeJS context
 * 
 * Implementation follows from https://forum.dfinity.org/t/using-dfinity-agent-in-node-js/6169/49
 * 
 * Steps (Before using)
 * 
 * 1. Navigate to my .dfx identities → ~/.config/.dfx/identity
 * 2. Create a new identity → mkdir local-testing; cd local-testing
 * 3. Download quill since keysmith is now deprecated.
 * 4. Test that quill is installed correctly → quill
 * 5. Look up how to generate a key → quill generate --help
 * 6. Generate a key and seed file → quill generate --pem-file identity.pem --seed-file seed.txt 
 * 7. Now running the identityFromSeed() function and dfx identity get-principal should return the same identity! Yay!
 * 
 * **Note:** If you run this an have NodeJS version 17+, you will receive the following error coming from the hdkey library import → Error: error:0308010C:digital envelope routines::unsupported. The possible solutions for getting around this are here, the easiest of which is downgrading to node 16. (@kpeacock/sdk team can you provide a node 17+ solution? :slightly_smiling_face: )
    Now running the above node script and dfx identity get-principal should return the same identity! Yay!
 */
export async function identityFromSeed(
  seedPhrasePath: string
): Promise<Secp256k1KeyIdentity> {
  const phrase = readFileSync(seedPhrasePath).toString().trim();
  const seed = await bip39.mnemonicToSeed(phrase);
  const root = hdkey.fromMasterSeed(seed);
  const addrnode = root.derive("m/44'/223'/0'/0/0");

  return Secp256k1KeyIdentity.fromSecretKey(addrnode.privateKey);
}

/**
 * Imports a dfx generated pem file as an identity
 *
 * @param pemFilePath path to the identiy.pem file
 * @returns {Ed25519KeyIdentity} Returns the identity of the pem file
 *
 * @example
 * ```typescript
 * import { homedir } from 'os';
 *
 * let identity = await identityFromPemFile(`${homedir}/.config/dfx/identity/local-testing/identity.pem`);
 * ```
 *
 * code credit to @ZenVoich's solution here -> https://forum.dfinity.org/t/using-dfinity-agent-in-node-js/6169/55
 */
export function identityFromPemFile(pemFilePath: string): Ed25519KeyIdentity {
  const rawKey = readFileSync(pemFilePath).toString();
  const buf = pemfile.decode(rawKey);
  if (buf.length !== 85) {
    throw new Error(`expecting byte length 85 but got ${buf.length}`);
  }
  const secretKey = Buffer.concat([buf.slice(16, 48), buf.slice(53, 85)]);
  return Ed25519KeyIdentity.fromSecretKey(secretKey);
}

/**
 * Loads wasm as a Blob from a .wasm file path so that it can be passed to an install_code method
 *
 * @param wasmPath - path to the wasm file
 * @returns the Uint8Array "Blob-ified" wasm, ready to go for canister upgrades!
 */
export function loadWasm(wasmPath: string): number[] {
  return [...new Uint8Array(readFileSync(wasmPath))];
}
