import type { Metadata } from "next";
import { Article, LegalLayout, List } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "이용약관 | 서초 시그니처 파티룸",
  description: "서초 시그니처 파티룸 공간 대관 서비스 이용약관.",
};

export default function TermsPage() {
  return (
    <LegalLayout title="이용약관" updatedAt="2026년 8월 11일">
      <Article title="제1조 (목적)">
        <p>
          본 약관은 주식회사 통인엔딩컨시어지(이하 &ldquo;회사&rdquo;)가
          운영하는 서초 시그니처 파티룸의 공간 대관 서비스(이하
          &ldquo;서비스&rdquo;) 이용과 관련하여 회사와 이용자의 권리, 의무 및
          책임사항을 규정함을 목적으로 합니다.
        </p>
      </Article>

      <Article title="제2조 (정의)">
        <List
          items={[
            "「서비스」란 회사가 운영하는 파티룸 공간을 이용자가 예약하여 일정 시간 사용하는 것을 말합니다.",
            "「이용자」란 본 약관에 동의하고 서비스를 예약·이용하는 자를 말합니다.",
            "「예약」이란 이용자가 공간, 일시, 인원을 지정하고 결제를 완료하여 이용 권리를 확정하는 행위를 말합니다.",
          ]}
        />
      </Article>

      <Article title="제3조 (예약 및 결제)">
        <List
          items={[
            "예약은 회사가 정한 절차에 따라 온라인으로 신청하며, 결제가 완료된 시점에 확정됩니다.",
            "이용 요금은 공간, 요일, 이용 시간대에 따라 다르며, 예약 시점에 안내된 금액이 적용됩니다.",
            "기준 인원을 초과하는 경우 1인당 추가 요금이 부과되며, 최대 인원을 초과하여 이용할 수 없습니다.",
            "청소 보증금은 대관료와 함께 결제되며, 이용 종료 후 시설 확인을 거쳐 환불됩니다.",
            "결제 수단은 신용·체크카드 및 간편결제이며, 결제 대행사의 정책에 따릅니다.",
          ]}
        />
      </Article>

      <Article title="제4조 (취소 및 환불)">
        <p>
          예약 취소와 환불은 별도로 정한{" "}
          <a href="/refund/" className="underline hover:text-ink">
            취소 및 환불 규정
          </a>
          에 따릅니다.
        </p>
      </Article>

      <Article title="제5조 (이용자의 의무)">
        <p>이용자는 서비스 이용 시 다음 사항을 준수해야 합니다.</p>
        <List
          items={[
            "예약한 인원과 시간을 준수하며, 사전 고지 없이 인원을 초과하지 않습니다.",
            "실내에서 흡연하지 않으며, 화기를 사용하지 않습니다.",
            "시설과 비품을 선량한 관리자의 주의로 사용하고, 이용 후 기본적인 정리를 합니다.",
            "타인에게 피해를 주는 과도한 소음을 발생시키지 않습니다.",
            "관계 법령을 위반하는 행위 및 미풍양속에 반하는 목적으로 공간을 사용하지 않습니다.",
            "회사의 사전 동의 없이 예약 권리를 제3자에게 양도하거나 재판매하지 않습니다.",
          ]}
        />
      </Article>

      <Article title="제6조 (책임의 제한)">
        <List
          items={[
            "이용자의 고의 또는 과실로 시설·비품이 훼손된 경우, 이용자는 그 손해를 배상할 책임이 있습니다.",
            "회사는 이용자가 공간 내에 두고 간 물품의 분실·도난에 대해 책임지지 않습니다.",
            "이용자 간 또는 이용자와 제3자 간에 발생한 분쟁에 대해 회사는 개입하지 않으며 책임을 지지 않습니다.",
            "천재지변 등 불가항력으로 서비스를 제공할 수 없는 경우 회사는 책임을 지지 않으며, 해당 예약은 전액 환불합니다.",
          ]}
        />
      </Article>

      <Article title="제7조 (이용 제한)">
        <p>
          회사는 이용자가 제5조의 의무를 중대하게 위반한 경우 이용을 중단시킬 수
          있으며, 이 경우 잔여 시간에 대한 환불은 이루어지지 않습니다.
        </p>
      </Article>

      <Article title="제8조 (약관의 변경)">
        <p>
          회사는 관계 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며,
          변경 시 시행일과 변경 내용을 웹사이트에 게시합니다. 변경된 약관은
          시행일부터 적용됩니다.
        </p>
      </Article>

      <Article title="제9조 (분쟁의 해결)">
        <p>
          본 약관에 관한 분쟁은 대한민국 법을 준거법으로 하며, 분쟁이 발생한
          경우 회사의 본점 소재지를 관할하는 법원을 관할 법원으로 합니다.
        </p>
      </Article>

      <Article title="사업자 정보">
        <dl className="space-y-1.5">
          <Info label="상호" value="서초시그니처파티룸" />
          <Info label="대표자" value="오경옥" />
          <Info label="주소" value="서울특별시 서초구 마방로 48, 2층(양재동, 통인빌딩)" />
          <Info label="사업자등록번호" value="294-46-01320" />
          <Info label="통신판매업신고번호" value="제 2026-서울서초-3142 호" />
        </dl>
      </Article>
    </LegalLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
