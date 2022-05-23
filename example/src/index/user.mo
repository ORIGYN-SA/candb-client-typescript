import Cycles "mo:base/ExperimentalCycles";
import CA "./CanisterActions";
import Debug "mo:base/Debug";
import InterfaceSpec "./InterfaceSpec";

shared ({ caller = owner }) actor class UserCanister(primaryKey: Text) {
  // Initialize CanDB
  // stable let owners = owners; // TODO: put this back in once can blob encode records
  stable let pk = primaryKey;

  stable var count = 0;

  public query func getPK(): async Text { pk };

  public query func skExists(sk: Text): async Bool { false };

  public shared({ caller = caller }) func transferCycles(): async Text {
    if (caller == owner) {
      return await CA.transferCycles(caller);
    };

    "not owner"
  };

  public query func getCount(): async Nat { count };

  public func incrementByNat(i: Nat): async Nat {
    count += i;
    count;
  }; 
}