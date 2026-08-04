# -*- coding: utf-8 -*-
"""KG이니시스 정기결제(카드사) 심사용 PPT 생성 — MID: infrontbil"""
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

OUT = (
    Path(__file__).resolve().parents[1]
    / "docs"
    / "audit-captures"
    / "card-billing-audit-infrontbil.pptx"
)

BIZ = {
    "상호명": "틸리언",
    "대표자": "장지훈",
    "사업자등록번호": "766-55-00323",
    "연락처": "010-2723-9490",
    "주소": "대구시 동구 안심로188 2층, 3층",
    "통신판매업신고": "제 2022-대구동구-1034 호",
    "사이트": "https://infront.kr",
    "MID": "infrontbil",
}

TEST_ACCOUNT = {
    "이메일": "audit-domestic@infront.kr",
    "비밀번호": "AuditDomestic2026!",
}

PATHS = [
    ("1. 샵 메인 (멤버십 노출)", "https://infront.kr/shop?audit=1"),
    ("2. 멤버십 상품 상세", "https://infront.kr/shop/products/MEMBERSHIP_BASIC?audit=1"),
    ("3. 구독 카드 등록 (정기결제)", "https://infront.kr/shop/billing/register?plan=MEMBERSHIP_BASIC&audit=1"),
    ("4. 구독 완료 / 첫 달 결제", "https://infront.kr/shop/billing/complete?id={subscription_id}&audit=1"),
    ("5. 취소·환불 정책", "https://infront.kr/shop/refund-policy?audit=1"),
    ("6. 이용약관", "https://infront.kr/shop/terms?audit=1"),
]


def set_run(run, size=14, bold=False, color=(30, 30, 30)):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor(*color)
    run.font.name = "Malgun Gothic"


def add_title(slide, text, top=0.25):
    box = slide.shapes.add_textbox(Inches(0.4), Inches(top), Inches(9.2), Inches(0.55))
    tf = box.text_frame
    p = tf.paragraphs[0]
    p.text = text
    set_run(p.runs[0], size=22, bold=True, color=(180, 30, 20))


def add_body(slide, lines, top=0.9, size=13):
    box = slide.shapes.add_textbox(Inches(0.4), Inches(top), Inches(9.2), Inches(6.2))
    tf = box.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line
        p.space_after = Pt(6)
        if p.runs:
            set_run(p.runs[0], size=size, bold=line.startswith("★") or line.startswith("■"))


def add_placeholder(slide, label, left, top, width, height):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE,
        Inches(left),
        Inches(top),
        Inches(width),
        Inches(height),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(245, 245, 245)
    shape.line.color.rgb = RGBColor(200, 200, 200)
    tf = shape.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = label
    set_run(p.runs[0], size=12, color=(120, 120, 120))


def main():
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]

    # --- Slide 1: 사전 요건 ---
    s = prs.slides.add_slide(blank)
    add_title(s, "★ 정기결제 카드사 심사 — 사이트 사전 요건 (MID: infrontbil)")
    add_body(
        s,
        [
            "1) 상품 등록 필수 사항",
            "  - 실제 판매 서비스 노출 필수 (베이직 멤버십 9,900원/월)",
            "  - 정확한 가격·상품 설명·배송/교환/반품/취소/환불 정책 기재",
            "  - 0원/샘플/TEST 상품·고객 직접입력 가격 방식 사용 안 함",
            "  - 회원제: 심사용 TEST 로그인 정보(ID/PW) 전달",
            "  - 비실물(컨텐츠) 서비스 → 이용기간 명시 (월 단위 구독)",
            "",
            "2) 사이트 하단 상점정보 필수 표기",
            f"  - 상호명: {BIZ['상호명']} / 사업자등록번호: {BIZ['사업자등록번호']}",
            f"  - 대표자: {BIZ['대표자']} / 연락처: {BIZ['연락처']}",
            f"  - 사업장주소: {BIZ['주소']}",
            f"  - 통신판매신고번호: {BIZ['통신판매업신고']}",
            "  - Footer: 이용약관 · 개인정보처리방침 · 통신판매신고번호",
            "",
            "3) 판매 책임 문구 (메인/푸터)",
            "  - 틸리언에서 운영하는 사이트에서 판매되는 모든 상품은 틸리언에서 책임지고 있습니다.",
            "  - 민원 담당자: 장지훈 / 연락처: 010-2723-9490",
        ],
        size=12,
    )

    # --- Slide 2: 캡처 방법 ---
    s = prs.slides.add_slide(blank)
    add_title(s, "★ 결제경로 PPT 작성 방법 (정기결제)")
    add_body(
        s,
        [
            "1. 사이트 상단에 URL 주소 보이게 화면 캡처",
            "   - 모든 경로 페이지에 ?audit=1 (또는 &audit=1) 붙여 URL 바 표시",
            "",
            "2. 사이트 하단정보",
            "   - 사업자정보 5가지 + 통신판매신고번호 보이게 스크롤 후 캡처",
            "",
            "3. 최종 결제 금액 = 결제창 금액 동일 (원화 O / 달러 X)",
            "   - 등록·청구 금액: 9,900원 (KRW)",
            "",
            "4. 결제창 캡처",
            "   - 정기결제(빌링키 발급) 결제창",
            "   - 카드번호 / 유효기간 / 주민번호(또는 생년월일) 입력창",
            "",
            f"■ 심사용 계정: {TEST_ACCOUNT['이메일']} / {TEST_ACCOUNT['비밀번호']}",
            f"■ 서비스 URL: {BIZ['사이트']}",
            f"■ 빌링 MID: {BIZ['MID']}",
        ],
        size=13,
    )

    # --- Slide 3: 사업자·테스트 계정 ---
    s = prs.slides.add_slide(blank)
    add_title(s, "사업자정보 · 심사용 계정 · 정기결제 상품")
    add_body(
        s,
        [
            "■ 사업자정보",
            *[f"  - {k}: {v}" for k, v in BIZ.items()],
            "",
            "■ 심사용 TEST 계정 (회원제)",
            f"  - ID(이메일): {TEST_ACCOUNT['이메일']}",
            f"  - PW: {TEST_ACCOUNT['비밀번호']}",
            "",
            "■ 정기결제 상품",
            "  - 상품명: 베이직 멤버십 (MEMBERSHIP_BASIC)",
            "  - 가격: 9,900원 / 월",
            "  - 결제주기: 매월 1일 자동청구",
            "  - 최초결제: 카드 등록 후 첫 달 즉시 청구 가능",
            "  - 제공내용: 월 5건 검품·포장 무료 + 무료 방문 픽업 1회",
            "  - 이용기간: 월 단위 (해지 시 익월부터 청구 중단)",
            "  - 해지: 서비스 내 해지 또는 고객센터 010-2723-9490",
        ],
        size=12,
    )

    # --- Slides 4-7: 경로 캡처 자리 ---
    capture_slides = [
        (
            "결제경로 ① — 샵 메인 / 멤버십 구독 섹션",
            PATHS[0][1],
            "캡처: /shop 멤버십 구독 카드 + URL 바 + 하단 사업자정보",
        ),
        (
            "결제경로 ② — 상품 설명 / 이용기간 / 환불 안내",
            PATHS[1][1],
            "캡처: 비실물 서비스 설명·월 이용기간·환불/해지 안내 포함",
        ),
        (
            "결제경로 ③ — 구독 신청 · 자동결제 고지 · 동의",
            PATHS[2][1],
            "캡처: 금액 9,900원·매월 1일·해지방법·필수 동의 체크",
        ),
        (
            "결제경로 ④ — 금액 일치 + KG 빌링 결제창",
            PATHS[2][1] + " → 카드 등록하기",
            "캡처: 화면 금액 9,900원 = 결제창 9,900원 (KRW)\n결제창: 카드번호/유효기간/주민번호(생년월일) 입력창",
        ),
    ]
    for title, url, note in capture_slides:
        s = prs.slides.add_slide(blank)
        add_title(s, title)
        add_body(s, [f"URL: {url}", "", note, "", "(아래에 실제 화면 캡처를 붙여 넣어 주세요)"], top=0.85, size=12)
        add_placeholder(s, "[ 화면 캡처 영역 ]", 0.5, 2.4, 9.0, 4.5)

    # --- Slide: 완료/해지 ---
    s = prs.slides.add_slide(blank)
    add_title(s, "결제경로 ⑤ — 등록 완료 · 첫 달 결제 · 해지 안내")
    add_body(
        s,
        [
            f"URL: {PATHS[3][1]}",
            "",
            "캡처 포인트",
            "  - 카드 등록 완료 안내",
            "  - 매월 1일 자동청구 안내",
            "  - 첫 달 즉시 결제 버튼 (9,900원)",
            "  - 해지 방법 안내",
            "",
            "(아래에 실제 화면 캡처를 붙여 넣어 주세요)",
        ],
        top=0.85,
        size=12,
    )
    add_placeholder(s, "[ 화면 캡처 영역 ]", 0.5, 3.2, 9.0, 3.8)

    # --- Slide: 환불 ---
    s = prs.slides.add_slide(blank)
    add_title(s, "취소/환불 규정 (필수)")
    add_body(
        s,
        [
            f"URL: {PATHS[4][1]}",
            "",
            "■ 멤버십 구독(정기결제) 환불·해지 요지",
            "  ① 월 단위 선불 자동결제(빌링)",
            "  ② 월 구독료 9,900원 · 매월 1일 자동 청구",
            "  ③ 해지 신청 익월부터 청구 중단",
            "  ④ 이미 결제된 당월 요금 환불 불가",
            "  ⑤ 해지: 서비스 내 해지 또는 고객센터(010-2723-9490)",
            "",
            "상세 조항: /shop/refund-policy 제3조 (멤버십 구독 — 정기결제)",
            "",
            "(아래에 환불 정책 페이지 캡처를 붙여 넣어 주세요)",
        ],
        top=0.85,
        size=12,
    )
    add_placeholder(s, "[ 환불정책 캡처 영역 ]", 0.5, 3.8, 9.0, 3.2)

    # --- Final: 경로 요약 ---
    s = prs.slides.add_slide(blank)
    add_title(s, "정기결제 경로 요약 · 회신용")
    lines = [
        f"MID: {BIZ['MID']} (KG이니시스 빌링)",
        f"도메인: {BIZ['사이트']}",
        "",
        "■ 결제 경로 (순서)",
    ]
    for label, url in PATHS:
        lines.append(f"  {label}")
        lines.append(f"     {url}")
    lines += [
        "",
        "■ API (참고)",
        "  POST /api/shop/billing/prepare  — 빌링키 발급 준비",
        "  POST /api/shop/billing/callback — 빌링키 수신·구독 ACTIVE",
        "  POST /api/shop/billing/charge   — Rebill 첫 달/수동 청구",
        "  GET  /api/cron/shop-billing     — 매월 자동청구",
        "",
        "■ 첨부: 본 PPT + 캡처 이미지 + 심사용 계정",
    ]
    add_body(s, lines, size=11)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(f"WROTE {OUT}")


if __name__ == "__main__":
    main()
