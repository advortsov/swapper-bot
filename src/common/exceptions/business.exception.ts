export class BusinessException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'BusinessException';
  }
}
