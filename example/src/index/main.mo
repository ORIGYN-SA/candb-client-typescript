import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import Cycles "mo:base/ExperimentalCycles";
import Text "mo:base/Text";
import Buffer "mo:stable-buffer/StableBuffer";

import UserCanister "./user";

import CanisterMap "mo:candb/CanisterMap";
import CA "mo:candb/CanisterActions";
import Admin "mo:candb/CanDBAdmin";

shared ({caller = owner}) actor class IndexCanister() = this {
  stable var pkToCanisterMap = CanisterMap.init();

  public shared query({caller = caller}) func getCanistersByPK(pk: Text): async [Text] {
    getCanisterIdsIfExists(pk);
  };

  func createUserCanister(pk: Text, controllers: ?[Principal]): async Text {
    Debug.print("creating new user canister with pk=" # pk);
    Cycles.add(300_000_000_000);
    let newUserCanister = await UserCanister.UserCanister({
      primaryKey = pk;
      scalingOptions = {
        autoScalingCanisterId = Principal.toText(Principal.fromActor(this));
        limitType = #count;
        limit = 3;
      }
    });
    let newUserCanisterPrincipal = Principal.fromActor(newUserCanister);
    await CA.updateCanisterSettings({
      canisterId = newUserCanisterPrincipal;
      settings = {
        controllers = controllers;
        compute_allocation = ?0;
        memory_allocation = ?0;
        freezing_threshold = ?2592000;
      }
    });

    let newUserCanisterId = Principal.toText(newUserCanisterPrincipal);
    pkToCanisterMap := CanisterMap.add(pkToCanisterMap, pk, newUserCanisterId);

    newUserCanisterId;
  };

  func callingCanisterOwnsPK(caller: Principal, pk: Text): Bool {
    Debug.print("called calling canister owns pk");
    switch(CanisterMap.get(pkToCanisterMap, pk)) {
      case null { false };
      case (?canisterIdsBuffer) {
        for (canisterId in canisterIdsBuffer.elems.vals()) {
          if (Principal.toText(caller) == canisterId) {
            return true;
          }
        };
        return false;
      }
    }
  }; 

  public shared({caller = caller}) func createAdditionalCanisterForPK(pk: Text): async Text {
    Debug.print("creating additional canister for PK=" # pk);
    if (not callingCanisterOwnsPK(caller, pk)) {
      Debug.trap("error, called by non-controller=" # debug_show(caller));
    };
    
    if (Text.startsWith(pk, #text("user#"))) {
      await createUserCanister(pk, ?[owner, Principal.fromActor(this)]);
    } else {
      Debug.trap("error: create case not covered");
    };
  };

  public shared({caller = creator}) func createAdditionalCanisterForUser(): async Text {
    let callerPrincipalId = Principal.toText(creator);
    let userPk = "user#" # callerPrincipalId;
    await createUserCanister(userPk, ?[owner, Principal.fromActor(this)]);
  };

  public shared({caller = creator}) func createUser(): async ?Text {
    let callerPrincipalId = Principal.toText(creator);
    let userPk = "user#" # callerPrincipalId;
    let canisterIds = getCanisterIdsIfExists(userPk);
    // does not exist
    if (canisterIds == []) {
      ?(await createUserCanister(userPk, ?[owner, Principal.fromActor(this)]));
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
      // can choose to use this statusMap for to detect failures and prompt retries if desired 
      let statusMap = await Admin.transferCyclesStopAndDeleteCanisters(canisterIds);
      pkToCanisterMap := CanisterMap.delete(pkToCanisterMap, userPk);
    };
  };

  func getCanisterIdsIfExists(pk: Text): [Text] {
    switch(CanisterMap.get(pkToCanisterMap, pk)) {
      case null { [] };
      case (?canisterIdsBuffer) { Buffer.toArray(canisterIdsBuffer) } 
    }
  };

  public shared({ caller = caller }) func upgradeUserCanisters(wasmModule: Blob): async [(Text, Admin.InterCanisterActionResult)] {
    await Admin.upgradeCanistersInPKRange(
      pkToCanisterMap,
      "user#", 
      "user#:", 
      5,
      wasmModule,
      {
        autoScalingCanisterId = Principal.toText(Principal.fromActor(this));
        limit = 20;
        limitType = #count;
      }
    );
  };
}