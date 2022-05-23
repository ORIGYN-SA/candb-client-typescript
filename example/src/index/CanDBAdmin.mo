import Buffer "mo:stable-buffer/StableBuffer";
import Array "mo:base/Array";
import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Cycles "mo:base/ExperimentalCycles";
import CA "./CanisterActions"

module {
  public func transferCyclesStopAndDeleteCanisters(canisterIds: [Text]): async () { // [DeletionStatus] {
    let canisterPrincipals = Array.map<Text, Principal>(canisterIds, func(id) {
      Principal.fromText(id);
    });
    let transferResult = await transferAllCycles(canisterIds);
    let stoppedResult = await stopAllCanisters(canisterPrincipals);
    let deletedResult = await deleteAllCanisters(canisterPrincipals);
    try {
      Debug.print("trying to delete again");
      let deletedAgain = await deleteAllCanisters(canisterPrincipals);
      Debug.print("deleted again");
    } catch (err) { Debug.print("error trying to delete twice ")};
    Debug.print("finished deleting canisters");
  };

  public func transferAllCycles(cids: [Text]): async [Text] {
    let actors = Array.map<Text, actor {transferCycles : shared () -> async Text}>(cids, func(id) { 
      actor(id): actor { transferCycles: shared () -> async Text };
    });
    let executingTransferCycles = Buffer.init<async Text>();
    for (a in actors.vals()) {
      Buffer.add<async Text>(executingTransferCycles, a.transferCycles());
    };
    let collectingTransferCycles = Buffer.init<Text>();
    var i = 0;
    label l loop {
      if (i >= executingTransferCycles.count) break l;
      Buffer.add(collectingTransferCycles, await executingTransferCycles.elems[i]);
      i += 1;
    };
    Debug.print("all collections complete"); 

    Buffer.toArray(collectingTransferCycles);
  };

  public func stopAllCanisters(canisterPrincipals: [Principal]): async [Text] {
    let executingStopCanisters = Buffer.init<async Text>();
    for (principal in canisterPrincipals.vals()) {
      Buffer.add<async Text>(executingStopCanisters, CA.stopCanister(principal));
    };
    let collectingStoppedCanisters = Buffer.init<Text>();
    var i = 0;
    label l loop {
      if (i >= executingStopCanisters.count) break l;
      Buffer.add(collectingStoppedCanisters, await executingStopCanisters.elems[i]);
      i += 1;
    };
    Debug.print("all stops complete"); 

    Buffer.toArray(collectingStoppedCanisters);
  };

  public func deleteAllCanisters(canisterPrincipals: [Principal]): async [Text] {
    let executingDeleteCanisters = Buffer.init<async Text>();
    for (principal in canisterPrincipals.vals()) {
      Debug.print("about to start delete for principal=" # Principal.toText(principal));
      Buffer.add<async Text>(executingDeleteCanisters, CA.deleteCanister(principal));
      Debug.print("started delete for principal=" # Principal.toText(principal));
    };
    let collectingDeletedCanisters = Buffer.init<Text>();
    var i = 0;
    label l loop {
      if (i >= executingDeleteCanisters.count) break l;
      Debug.print("awaiting delete for canisterId=" # debug_show(canisterPrincipals[i]));
      Buffer.add(collectingDeletedCanisters, await executingDeleteCanisters.elems[i]);
      Debug.print("completed delete for canisterId=" # debug_show(canisterPrincipals[i]));
      i += 1;
    };
    Debug.print("all deletes complete"); 
    Buffer.toArray(collectingDeletedCanisters);
  };
}