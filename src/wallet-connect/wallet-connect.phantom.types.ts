export interface IPhantomConnectPayload {
  public_key: string;
  session: string;
}

export interface IPhantomSignedTransactionPayload {
  transaction: string;
}
