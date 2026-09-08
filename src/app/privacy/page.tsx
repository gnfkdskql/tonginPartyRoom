import type { Metadata } from "next";
import { Article, LegalLayout, List } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 서초 시그니처 파티룸",
  description:
    "서초 시그니처 파티룸 개인정보처리방침 — 수집 항목, 이용 목적, 보유 기간 및 이용자 권리 안내.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="개인정보처리방침" updatedAt="2026년 8월 11일">
      <Article title="1. 개인정보의 수집 항목 및 이용 목적">
        <p>
          주식회사 통인엔딩컨시어지(이하 &ldquo;회사&rdquo;)는 공간 대관 서비스
          제공을 위해 필요한 최소한의 개인정보만을 수집합니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-soft">
                <th className="px-4 py-3 text-left font-medium text-ink">구분</th>
                <th className="px-4 py-3 text-left font-medium text-ink">항목</th>
                <th className="px-4 py-3 text-left font-medium text-ink">목적</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="px-4 py-3">필수</td>
                <td className="px-4 py-3">이름, 휴대폰 번호</td>
                <td className="px-4 py-3">예약 확인, 이용 안내, 본인 확인</td>
              </tr>
              <tr className="border-b border-line">
                <td className="px-4 py-3">선택</td>
                <td className="px-4 py-3">요청사항</td>
                <td className="px-4 py-3">이용 준비 및 응대</td>
              </tr>
              <tr className="border-b border-line">
                <td className="px-4 py-3">자동 생성</td>
                <td className="px-4 py-3">결제 기록</td>
                <td className="px-4 py-3">결제 처리, 환불, 거래 기록 보존</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted">
          회사는 카드번호 등 결제 수단 정보를 직접 수집·보관하지 않으며, 결제
          처리는 결제대행사를 통해 이루어집니다.
        </p>
      </Article>

      <Article title="2. 개인정보의 보유 및 이용 기간">
        <List
          items={[
            "예약 정보(이름, 연락처): 이용일로부터 1년간 보유 후 파기합니다.",
            "계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)",
            "대금 결제 및 재화 등의 공급에 관한 기록: 5년 (동법)",
            "소비자의 불만 또는 분쟁 처리에 관한 기록: 3년 (동법)",
          ]}
        />
        <p>
          보유 기간이 경과한 개인정보는 지체 없이 파기하며, 전자적 파일은 복구할
          수 없는 방법으로 삭제합니다.
        </p>
      </Article>

      <Article title="3. 개인정보의 제3자 제공">
        <p>
          회사는 이용자의 개인정보를 제1항에서 고지한 범위를 넘어 이용하거나
          제3자에게 제공하지 않습니다. 다만 다음의 경우는 예외로 합니다.
        </p>
        <List
          items={[
            "이용자가 사전에 동의한 경우",
            "법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우",
          ]}
        />
      </Article>

      <Article title="4. 개인정보 처리의 위탁">
        <p>
          회사는 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 위탁하고
          있으며, 위탁계약 시 개인정보가 안전하게 관리되도록 필요한 사항을
          규정하고 있습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-soft">
                <th className="px-4 py-3 text-left font-medium text-ink">
                  수탁업체
                </th>
                <th className="px-4 py-3 text-left font-medium text-ink">
                  위탁 업무
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="px-4 py-3">토스페이먼츠 주식회사</td>
                <td className="px-4 py-3">결제 처리 및 환불</td>
              </tr>
              <tr className="border-b border-line">
                <td className="px-4 py-3">Supabase, Inc.</td>
                <td className="px-4 py-3">
                  예약 데이터 보관 및 시스템 운영 (국외 이전: 대한민국 리전)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Article>

      <Article title="5. 이용자의 권리와 행사 방법">
        <List
          items={[
            "이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.",
            "권리 행사는 아래 개인정보 보호책임자에게 서면, 전화 또는 전자우편으로 요청하실 수 있으며, 회사는 지체 없이 조치합니다.",
            "다만 법령에서 보존을 의무화한 정보는 삭제 요청에도 불구하고 해당 기간 동안 보관됩니다.",
          ]}
        />
      </Article>

      <Article title="6. 개인정보의 안전성 확보 조치">
        <List
          items={[
            "개인정보에 대한 접근 권한을 최소한의 인원으로 제한하고 있습니다.",
            "예약 정보는 접근 통제 정책이 적용된 데이터베이스에 보관되며, 외부에서 직접 조회할 수 없습니다.",
            "개인정보의 전송 구간은 암호화(HTTPS)하여 보호합니다.",
          ]}
        />
      </Article>

      <Article title="7. 개인정보 보호책임자">
        <dl className="space-y-1.5">
          <Info label="책임자" value="오경옥 (대표)" />
          <Info label="주소" value="서울특별시 서초구 마방로 48, 2층(양재동, 통인빌딩)" />
          <Info label="문의" value="카카오톡 채널 @서초시그니처파티룸" />
        </dl>
        <p className="text-muted">
          개인정보 침해에 관한 상담이 필요한 경우 개인정보침해신고센터(국번없이
          118), 대검찰청 사이버수사과(1301), 경찰청 사이버수사국(182)으로
          문의하실 수 있습니다.
        </p>
      </Article>

      <Article title="8. 개인정보처리방침의 변경">
        <p>
          본 방침의 내용이 추가·삭제·수정될 경우 시행 7일 전부터 웹사이트를 통해
          공지합니다.
        </p>
      </Article>
    </LegalLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
