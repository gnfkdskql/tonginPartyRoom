/**
 * 토스페이먼츠 결제 연동 (정적 사이트용, 리다이렉트 방식)
 *
 * 흐름:
 *  1) 예약 생성(create_reservation) → 예약번호 code + 서버계산 금액
 *  2) requestTossPayment() 로 토스 결제창 호출 (orderId = 예약번호)
 *  3) 성공 시 /booking/success 로 리다이렉트 (paymentKey·orderId·amount 쿼리)
 *  4) success 페이지가 Edge Function(confirm-payment)에 승인 요청
 *
 * 클라이언트 키(NEXT_PUBLIC_TOSS_CLIENT_KEY)는 공개되어도 안전한 값이다.
 * 시크릿 키는 절대 프론트에 두지 않고 Edge Function 환경변수로만 쓴다.
 */
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

export type TossPaymentArgs = {
  orderId: string; // 예약번호(code)
  orderName: string; // 예: "서초 시그니처 파티룸 · 6F 루프탑"
  amount: number; // 총 결제금액(원)
  customerName: string;
  customerMobilePhone?: string; // 숫자만
};

/**
 * 토스 결제창을 띄운다. 성공/실패 시 브라우저가 해당 URL로 리다이렉트되므로
 * 이 함수는 정상 흐름에서 반환되지 않는다(리다이렉트로 페이지가 바뀜).
 */
export async function requestTossPayment(args: TossPaymentArgs): Promise<void> {
  if (!CLIENT_KEY) {
    throw new Error(
      "결제 설정이 완료되지 않았습니다. (NEXT_PUBLIC_TOSS_CLIENT_KEY 누락)",
    );
  }

  const tossPayments = await loadTossPayments(CLIENT_KEY);
  // 비회원 결제: customerKey 대신 ANONYMOUS
  const payment = tossPayments.payment({ customerKey: "ANONYMOUS" });

  const origin = window.location.origin;
  await payment.requestPayment({
    method: "CARD",
    amount: { currency: "KRW", value: args.amount },
    orderId: args.orderId,
    orderName: args.orderName,
    successUrl: `${origin}/booking/success/`,
    failUrl: `${origin}/booking/fail/`,
    customerName: args.customerName,
    ...(args.customerMobilePhone
      ? { customerMobilePhone: args.customerMobilePhone }
      : {}),
    card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false },
  });
}

/** 결제 승인 Edge Function 엔드포인트 (배포 함수명과 일치해야 함) */
export function confirmPaymentEndpoint(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${url}/functions/v1/confirm-payment`;
}
