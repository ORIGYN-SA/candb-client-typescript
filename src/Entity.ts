export type PartitionKey = string;
export type SortKey = string;
export type AttributeKey = string;

type AttributeValuePrimitive = string | number | boolean;
type AttributeValueList = AttributeValuePrimitive[];
export type AttributeValue = AttributeValueList | AttributeValuePrimitive;

export type Entity = {
  PK: PartitionKey;
  SK: SortKey;
  Attributes: { [AttributeKey: AttributeKey]: AttributeValue };
};
