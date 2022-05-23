import CanisterMap "./CanisterMap";
import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import Cycles "mo:base/ExperimentalCycles";
import Buffer "mo:stable-buffer/StableBuffer";

import UserCanister "./user";
import CA "./CanisterActions";
import Admin "./CanDBAdmin";

shared ({caller = owner}) actor class IndexCanister() = this {
  stable var pkToCanisterMap = CanisterMap.init();

  public shared query({caller = caller}) func getCanistersByPK(pk: Text): async [Text] {
    Debug.print("canisterMap=" # debug_show(pkToCanisterMap));
    getCanisterIdsIfExists(pk);
  };

  public shared({caller = creator}) func createAdditionalCanisterForUser(): async Text {
    let callerPrincipalId = Principal.toText(creator);
    let userPk = "user#" # callerPrincipalId;
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
    pkToCanisterMap := CanisterMap.add(pkToCanisterMap, userPk, newUserCanisterId);

    newUserCanisterId;
  };

  public shared({caller = creator}) func createUser(): async ?Text {
    let callerPrincipalId = Principal.toText(creator);
    let userPk = "user#" # callerPrincipalId;
    let canisterIds = getCanisterIdsIfExists(userPk);
    // does not exist
    if (canisterIds == []) {
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
      pkToCanisterMap := CanisterMap.add(pkToCanisterMap, userPk, newUserCanisterId);

      ?newUserCanisterId;

    // already exists
    } else {
      Debug.print("already exists, not creating and returning null");
      null 
    };
  };

  public shared({caller = caller}) func deleteLoggedInUser(): async () {
    let callerPrincipalId = Principal.toText(caller);
    let userPk = "user#" # callerPrincipalId;
    let canisterIds = getCanisterIdsIfExists(userPk);
    if (canisterIds == []) {
      Debug.print("canister for user with principal=" # callerPrincipalId # " pk=" # userPk # " does not exist");
    } else {
      await Admin.transferCyclesStopAndDeleteCanisters(canisterIds);
    };
    pkToCanisterMap := CanisterMap.delete(pkToCanisterMap, userPk);
  };

  func getCanisterIdsIfExists(pk: Text): [Text] {
    switch(CanisterMap.get(pkToCanisterMap, pk)) {
      case null { [] };
      case (?canisterIdsBuffer) { Buffer.toArray(canisterIdsBuffer) } 
    }
  };
}