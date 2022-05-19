import Cycles "mo:base/ExperimentalCycles";
import CA "./CanisterActions";
import Debug "mo:base/Debug";
import InterfaceSpec "./InterfaceSpec";

shared ({ caller = owner }) actor class UserCanister(primaryKey: Text) {
  // Initialize CanDB
  // stable let owners = owners; // TODO: put this back in once can blob encode records
  stable let pk = primaryKey;

  public query func getPK(): async Text { pk };

  public query func skExists(): async Bool { false };

  public shared({ caller = caller }) func transferCycles(): async () {
    if (caller == owner) {
      await CA.transferCycles(caller);
    }
  }
}