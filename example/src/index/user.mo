import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";

import CA "mo:candb/CanisterActions";
import CanDB "mo:candb/CanDB";
import E "mo:candb/Entity";

import Iter "mo:base/Iter";
import Principal "mo:base/Principal";

shared ({ caller = owner }) actor class UserCanister({
  primaryKey: Text;
  scalingOptions: CanDB.ScalingOptions;
}) = this {

  // Initialize CanDB
  stable let db = CanDB.init({
    pk = primaryKey;
    scalingOptions = scalingOptions;
  });

  stable var count = 0;

  public query func getPK(): async Text { db.pk };

  public query func skExists(sk: Text): async Bool { 
    CanDB.skExists(db, sk);
  };

  public shared({ caller = caller }) func transferCycles(): async () {
    if (caller == owner) {
      await CA.transferCycles(caller);
    };
  };

  public query func getCount(): async Nat { count };

  public func incrementByNat(i: Nat): async Nat {
    count += i;
    count;
  }; 

  public func addEntity(sk: Text): async Text {
    let ov = await CanDB.replace(db, {
      sk = sk;
      attributes = [
      ("name", #text("joe")),
      ("age", #int(24)),
      ("isMember", #bool(true)),
      ];
    });

    "pk=" # db.pk # ", sk=" # sk;
  };

  public func getEntities(): async CanDB.ScanResult {
    CanDB.scan(db, {
      skLowerBound = "item#";
      skUpperBound = "item#:";
      limit = 100000;
      ascending = null;
    });
  };

  public func test(): async Text {
    Debug.print("called test for canister=" # debug_show(Principal.toText(Principal.fromActor(this))));
    "test" # primaryKey # ", limit = " # debug_show(scalingOptions.limit) # ".";
  };
}