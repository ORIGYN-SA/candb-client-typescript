import RBT "mo:stable-rbtree/StableRBTree";
import Text "mo:base/Text";
import I "mo:base/Iter";


module {
  type CanisterMap = RBT.Tree<Text, Text>; 

  public func init(): CanisterMap { RBT.init<Text, Text>() };

  public func get(map: CanisterMap, pk: Text): ?Text {
    RBT.get<Text, Text>(map, Text.compare, pk);
  };

  public func put(map: CanisterMap, pk: Text, canisterId: Text): CanisterMap {
    RBT.put<Text, Text>(map, Text.compare, pk, canisterId);
  };

  public func delete(map: CanisterMap, pk: Text): CanisterMap {
    RBT.delete<Text, Text>(map, Text.compare, pk);
  };

  public func entries(map: CanisterMap): I.Iter<(Text, Text)> { RBT.entries(map) }; 
}