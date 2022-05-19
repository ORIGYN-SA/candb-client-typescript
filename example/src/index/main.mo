import CanisterMap "./CanisterMap";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Debug "mo:base/Debug";
import Cycles "mo:base/ExperimentalCycles";

import UserCanister "./user";
import CA "./CanisterActions";
import InterfaceSpec "InterfaceSpec";

shared ({caller = owner}) actor class IndexCanister() = this {
  private let IC: InterfaceSpec.IC = actor "aaaaa-aa";

  stable var pkToCanisterMap = CanisterMap.init();

  type UserCanister = UserCanister.UserCanister;

  public shared query({caller = caller}) func getCanistersByPK(pk: Text): async [Text] {
    Debug.print("canisterMap=" # debug_show(pkToCanisterMap));
    switch(getCanisterIDIfExists(pk)) {
      case null { [] };
      case (?canisterId) { [canisterId] };
    };
  };

  public shared({caller = creator}) func create(userPk: Text): async ?Text {
    let callerPrincipalId = Principal.toText(creator);
    switch(getCanisterIDIfExists(userPk)) {
      // already exists
      case (?canisterId) { 
        Debug.print("already exists, not creating and returning null");
        null 
      };
      // does not exist
      case null { 
        Cycles.add(300_000_000_000);
        let newUserCanister = await UserCanister.UserCanister(userPk);
        let newUserCanisterPrincipal = Principal.fromActor(newUserCanister);
        await CA.updateCanisterSettings({
          canisterId = newUserCanisterPrincipal;
          settings = {
            controllers = ?[owner, Principal.fromActor(this)];
            compute_allocation = ?0;
            memory_allocation = ?0;
            freezing_threshold = ?2592000;
          }
        });

        let newUserCanisterId = Principal.toText(newUserCanisterPrincipal);
        pkToCanisterMap := CanisterMap.put(pkToCanisterMap, userPk, newUserCanisterId);

        ?newUserCanisterId;
      }
    }
  };

  public shared({caller = creator}) func createUser(): async ?Text {
    let callerPrincipalId = Principal.toText(creator);
    let userPk = "user#" # callerPrincipalId;
    switch(getCanisterIDIfExists(userPk)) {
      // already exists
      case (?canisterId) { 
        Debug.print("already exists, not creating and returning null");
        null 
      };
      // does not exist
      case null { 
        Debug.print("creating canister for pk=" # userPk);
        Cycles.add(300_000_000_000);
        let newUserCanister = await UserCanister.UserCanister(userPk);
        let newUserCanisterPrincipal = Principal.fromActor(newUserCanister);
        await CA.updateCanisterSettings({
          canisterId = newUserCanisterPrincipal;
          settings = {
            controllers = ?[owner, Principal.fromActor(this)];
            compute_allocation = ?0;
            memory_allocation = ?0;
            freezing_threshold = ?2592000;
          }
        });

        let newUserCanisterId = Principal.toText(newUserCanisterPrincipal);
        pkToCanisterMap := CanisterMap.put(pkToCanisterMap, userPk, newUserCanisterId);

        ?newUserCanisterId;
      }
    }
  };

  public shared ({ caller = caller }) func delete(key: Text): async ?Principal {
    let callerPrincipalId = Principal.toText(caller);
    switch(getCanisterIDIfExists(key)) {
      case null {
        Debug.print("canister for key=" # key # " does not exist");
        return null;
      };
      case (?canisterId) {
        let canisterPrincipal  = Principal.fromText(canisterId);

        let canister = actor(canisterId): actor { transferCycles: () -> async() };
        await canister.transferCycles();
        await CA.stopCanister(canisterPrincipal);
        await CA.deleteCanister(canisterPrincipal);
        Debug.print("deleted " # canisterId);

        pkToCanisterMap := CanisterMap.delete(pkToCanisterMap, key);

        return ?canisterPrincipal;
      }
    };
  };

  public shared({caller = caller}) func deleteLoggedInUser(): async () {
    let callerPrincipalId = Principal.toText(caller);
    let userPk = "user#" # callerPrincipalId;
    switch(getCanisterIDIfExists(userPk)) {
      case null {
        Debug.print("canister for user with principal=" # callerPrincipalId # " pk=" # userPk # " does not exist");
      };
      case (?canisterId) {
        let canisterPrincipal  = Principal.fromText(canisterId);
        let userActor = actor(canisterId): actor { transferCycles: () -> async() };
        await userActor.transferCycles();
        await CA.stopCanister(canisterPrincipal);
        await CA.deleteCanister(canisterPrincipal);
        Debug.print("deleted " # canisterId);
      }
    };
    pkToCanisterMap := CanisterMap.delete(pkToCanisterMap, userPk);
  };

  func getCanisterIDIfExists(pk: Text): ?Text {
    CanisterMap.get(pkToCanisterMap, pk);
  };
}