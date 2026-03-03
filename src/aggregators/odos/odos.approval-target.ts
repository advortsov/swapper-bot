import type {
  IApprovalTargetRequest,
  IApprovalTargetResponse,
} from '../../allowance/interfaces/allowance.interface';
import { BusinessException } from '../../common/exceptions/business.exception';

export async function resolveOdosApprovalTarget(input: {
  apiBaseUrl: string;
  assembleEndpointPath: string;
  buildQuotePayload: (params: {
    chain: IApprovalTargetRequest['chain'];
    sellTokenAddress: string;
    buyTokenAddress: string;
    sellAmountBaseUnits: string;
    userAddress: string;
    slippageLimitPercent: number;
  }) => object;
  defaultSlippagePercent: number;
  observeRequest: (method: string, statusCode: string, startedAt: number) => void;
  postJson: (url: URL, body: object) => Promise<{ statusCode: number; body: unknown }>;
  quoteEndpointPath: string;
  request: IApprovalTargetRequest;
  validateAssembleResponse: (body: unknown) => body is { transaction: { to: string } };
  validateQuoteResponse: (body: unknown) => body is { pathId: string };
}): Promise<IApprovalTargetResponse> {
  const quotePayload = input.buildQuotePayload({
    chain: input.request.chain,
    sellTokenAddress: input.request.sellTokenAddress,
    buyTokenAddress: input.request.buyTokenAddress,
    sellAmountBaseUnits: input.request.sellAmountBaseUnits,
    userAddress: input.request.userAddress,
    slippageLimitPercent: input.defaultSlippagePercent,
  });
  const startedAt = Date.now();
  const quoteResponse = await input.postJson(
    new URL(input.quoteEndpointPath, input.apiBaseUrl),
    quotePayload,
  );

  if (!input.validateQuoteResponse(quoteResponse.body)) {
    throw new BusinessException('Odos quote response schema is invalid');
  }

  const assembleResponse = await input.postJson(
    new URL(input.assembleEndpointPath, input.apiBaseUrl),
    {
      userAddr: input.request.userAddress,
      pathId: quoteResponse.body.pathId,
      simulate: false,
    },
  );
  input.observeRequest('POST', assembleResponse.statusCode.toString(), startedAt);

  if (!input.validateAssembleResponse(assembleResponse.body)) {
    throw new BusinessException('Odos assemble response schema is invalid');
  }

  return {
    spenderAddress: assembleResponse.body.transaction.to,
  };
}
