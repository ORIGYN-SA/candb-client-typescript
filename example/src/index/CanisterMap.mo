import RBT "mo:stable-rbtree/StableRBTree";
import Text "mo:base/Text";
import I "mo:base/Iter";
import Buffer "mo:stable-buffer/StableBuffer";


module {
  public type CanisterIdList = Buffer.StableBuffer<Text>;
  public type CanisterMap = RBT.Tree<Text, CanisterIdList>; 

  public func init(): CanisterMap { RBT.init<Text, CanisterIdList>() };

  public func get(map: CanisterMap, pk: Text): ?CanisterIdList {
    RBT.get<Text, CanisterIdList>(map, Text.compare, pk);
  };

  public func add(map: CanisterMap, pk: Text, canisterId: Text): CanisterMap {
    func appendToOrCreateBuffer(existingCanisterIdsForPK: ?CanisterIdList): CanisterIdList {
      let canisterIdsBuffer = switch(existingCanisterIdsForPK) {
        case null { Buffer.initPresized<Text>(1) };
        case (?canisterIdsBuffer) { canisterIdsBuffer }
      };
      Buffer.add<Text>(canisterIdsBuffer, canisterId);
      canisterIdsBuffer;
    };
    let (_, newMap) = RBT.update<Text, CanisterIdList>(map, Text.compare, pk, appendToOrCreateBuffer);
    newMap;
  };

  public func delete(map: CanisterMap, pk: Text): CanisterMap {
    RBT.delete<Text, CanisterIdList>(map, Text.compare, pk);
  };

  public func entries(map: CanisterMap): I.Iter<(Text, CanisterIdList)> { RBT.entries(map) }; 
}