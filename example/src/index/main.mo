import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Principal "mo:base/Principal";
import Text "mo:base/Text";

import UserCanister "./user";

import Buffer "mo:stable-buffer/StableBuffer";
import CanisterMap "mo:candb/CanisterMap";
import CA "mo:candb/CanisterActions";
import Admin "mo:candb/CanDBAdmin";
import Utils "mo:candb/Utils";

shared ({caller = owner}) actor class IndexCanister() = this {
  stable var pkToCanisterMap = CanisterMap.init();

  public shared query({caller = caller}) func getCanistersByPK(pk: Text): async [Text] {
    getCanisterIdsIfExists(pk);
  };

  func createUserCanister(pk: Text, controllers: ?[Principal]): async Text {
    Debug.print("creating new user canister with pk=" # pk);
    Cycles.add(300_000_000_000);
    let newUserCanister = await UserCanister.UserCanister({
      partitionKey = pk;
      scalingOptions = {
        autoScalingHook = autoScaleUserServiceCanister;
        sizeLimit = #count(3);
      };
      owners = ?[owner, Principal.fromActor(this)];
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

  public shared({caller = caller}) func autoScaleUserServiceCanister(pk: Text): async Text {
    if (Utils.callingCanisterOwnsPK(caller, pkToCanisterMap, pk)) {
      Debug.print("creating an additional canister for pk=" # pk);
      await createUserCanister(pk, ?[owner, Principal.fromActor(this)])
    } else {
      throw Error.reject("not authorized");
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

  public shared({ caller = caller }) func upgradeUserCanisters(wasmModule: Blob): async Admin.UpgradePKRangeResult {
    await Admin.upgradeCanistersInPKRange({
      canisterMap = pkToCanisterMap;
      lowerPK = "user#"; 
      upperPK = "user#:"; 
      limit = 5;
      wasmModule = wasmModule;
      scalingOptions = {
        autoScalingHook = autoScaleUserServiceCanister;
        sizeLimit = #count(20);
      };
      owners = ?[owner, (Principal.fromActor(this))];
    });
  };
}