import type { Metadata } from "next";
import { Article, LegalLayout, List } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "취소 및 환불 규정 | 서초 시그니처 파티룸",
  description:
    "서초 시그니처 파티룸 예약 취소 및 환불 규정 — 환불 기준, 청소 보증금 반환, 환불 절차 안내.",
};

export default function RefundPage() {
  return (
    <LegalLayout title="취소 및 환불 규정" updatedAt="2026년 8월 11일">
      <Article title="제1조 (환불 기준)">
        <p>
          예약 취소 시점에 따라 아래 기준으로 대관료를 환불합니다. 기준일은
          이용 예정일을 기준으로 산정합니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-soft">
                <th className="px-4 py-3 text-left font-medium text-ink">
                  취소 시점
                </th>
                <th className="px-4 py-3 text-left font-medium text-ink">
                  환불 금액
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="px-4 py-3">이용일 8일 전까지</td>
                <td className="px-4 py-3 font-medium text-ink">100% 환불</td>
              </tr>
              <tr className="border-b border-line">
                <td className="px-4 py-3">이용일 7일 전 ~ 당일</td>
                <td className="px-4 py-3">환불 불가</td>
              </tr>
              <tr className="border-b border-line">
                <td className="px-4 py-3">
                  예약 후 2시간 이내 취소
                  <span className="block text-xs text-muted">
                    (이용 당일 예약은 제외)
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-ink">100% 환불</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted">
          위 기준은 대관료에 적용되며, 청소 보증금은 제2조에 따릅니다.
        </p>
      </Article>

      <Article title="제2조 (청소 보증금)">
        <List
          items={[
            "청소 보증금은 예약 시 대관료와 함께 결제되며, 이용 종료 후 시설 확인이 완료되면 전액 환불됩니다.",
            "다음의 경우 보증금의 일부 또는 전액이 차감될 수 있습니다: 정리 미흡, 무단 입실 및 늦은 퇴실, 추가 인원 미고지, 시설 오염 및 파손, 실내 흡연, 냄새가 심한 음식 조리.",
            "차감 사유가 발생한 경우 확인 내용을 안내한 뒤 잔액을 환불합니다.",
            "예약이 취소되어 이용하지 않은 경우, 청소 보증금은 취소 시점과 무관하게 전액 환불됩니다.",
          ]}
        />
      </Article>

      <Article title="제3조 (환불 절차)">
        <List
          items={[
            "환불은 결제하신 수단으로 처리되며, 카드 결제의 경우 카드사 정책에 따라 영업일 기준 3~7일이 소요될 수 있습니다.",
            "예약 취소는 예약번호와 예약자 연락처로 확인 후 처리됩니다.",
            "이용사업자의 사정으로 이용이 불가능해진 경우, 결제 금액 전액을 환불합니다.",
          ]}
        />
      </Article>

      <Article title="제4조 (이용일 변경)">
        <p>
          예약 일시 변경은 잔여 예약 현황에 따라 가능하며, 이용일 8일 전까지
          1회에 한해 무상으로 변경할 수 있습니다. 변경 요청 시점이 제1조의 환불
          불가 기간에 해당하는 경우 변경이 제한될 수 있습니다.
        </p>
      </Article>

      <Article title="제5조 (기타)">
        <p>
          천재지변, 감염병 확산에 따른 정부 방침 등 이용사업자와 이용자
          양측의 책임 없는 사유로 이용이 불가능한 경우에는 상호 협의하여 환불
          또는 일정 변경을 진행합니다.
        </p>
        <p>
          본 규정에 명시되지 않은 사항은 「전자상거래 등에서의 소비자보호에 관한
          법률」 및 관계 법령, 공정거래위원회 고시에 따릅니다.
        </p>
      </Article>
    </LegalLayout>
  );
}
