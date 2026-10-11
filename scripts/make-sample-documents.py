"""
Generates sample compliance-document PDFs for testing "Ask your documents".

These are fictional specimens for exercising the extraction and retrieval
pipeline end to end. Every person, company, ABN, and identifier is invented,
and each page carries a SPECIMEN footer so a generated file can never be
mistaken for a genuine certificate.

The set is chosen to exercise different question shapes:
  - single-page certificates      -> simple field lookups
  - two-page documents            -> page-number citation, page-2 retrieval
  - near-duplicate white cards    -> forces retrieval to disambiguate by name
  - a procedural SWMS             -> answers that are sentences, not fields

    python scripts/make-sample-documents.py [output_dir]
"""

import sys
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = A4
LEFT = 22 * mm
TOP = PAGE_H - 25 * mm

FOOTER = "SPECIMEN - fictional sample generated for software testing. Not a real certificate."


def draw_page(c, lines):
    """Render one page. A line may be a plain string or (style, text)."""
    y = TOP
    for line in lines:
        style, text = line if isinstance(line, tuple) else ("body", line)

        if style == "title":
            c.setFont("Helvetica-Bold", 15)
            y -= 4
        elif style == "heading":
            c.setFont("Helvetica-Bold", 11.5)
            y -= 3
        elif style == "rule":
            c.setLineWidth(0.6)
            c.line(LEFT, y, PAGE_W - LEFT, y)
            y -= 7 * mm
            continue
        elif style == "gap":
            y -= 5 * mm
            continue
        else:
            c.setFont("Helvetica", 10.5)

        c.drawString(LEFT, y, text)
        y -= 6.2 * mm

    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillGray(0.45)
    c.drawString(LEFT, 14 * mm, FOOTER)
    c.setFillGray(0)


def build(path, pages):
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle(path.stem)
    for i, page in enumerate(pages):
        draw_page(c, page)
        if i < len(pages) - 1:
            c.showPage()
    c.save()


def white_card(name, number, issued, expiry, rto, state="New South Wales"):
    return [[
        ("title", "CONSTRUCTION INDUCTION TRAINING CARD"),
        "General Construction Induction (White Card)",
        "Issued under the Work Health and Safety Regulation 2011",
        ("rule", ""),
        f"Card Holder: {name}",
        f"Card Number: {number}",
        f"Date of Issue: {issued}",
        f"Expiry Date: {expiry}",
        f"Issuing RTO: {rto}",
        f"State of Issue: {state}",
        ("gap", ""),
        "This card certifies that the holder has completed CPCWHS1001",
        "Prepare to work safely in the construction industry.",
        "The holder must carry this card on site at all times.",
        "A replacement card must be requested within 30 days of loss.",
    ]]


DOCUMENTS = {
    "White Card - Jordan Mercer.pdf": white_card(
        "Jordan Mercer", "WC-4471-2290", "2023-03-14", "2027-03-14",
        "Safeworks Training Australia (RTO 41288)",
    ),
    "White Card - Tomas Beck.pdf": white_card(
        "Tomas Beck", "WC-1180-4417", "2022-06-02", "2026-06-02",
        "Gateway Skills Group (RTO 30117)",
    ),
    "White Card - Yusra Haddad.pdf": white_card(
        "Yusra Haddad", "WC-9034-2210", "2024-02-19", "2028-02-19",
        "Gateway Skills Group (RTO 30117)",
    ),

    "High Risk Work Licence - Amara Nguyen.pdf": [[
        ("title", "LICENCE TO PERFORM HIGH RISK WORK"),
        "SafeWork New South Wales",
        ("rule", ""),
        "Licence Holder: Amara Nguyen",
        "Licence Number: HRW-7781-3345",
        "Date of Birth: 1991-08-02",
        "Date of Issue: 2021-11-20",
        "Expiry Date: 2026-11-20",
        ("gap", ""),
        ("heading", "Classes Authorised"),
        "LF - Forklift Truck",
        "LO - Order Picking Forklift Truck",
        ("gap", ""),
        "Conditions: Corrective lenses must be worn while operating.",
        "This licence remains the property of SafeWork NSW and must be",
        "produced on request by an inspector.",
    ]],

    "Public Liability Certificate - Northside Civil.pdf": [
        [
            ("title", "CERTIFICATE OF CURRENCY"),
            "Broadmoor Underwriting Group Pty Ltd",
            ("rule", ""),
            "Insured: Northside Civil Contracting Pty Ltd",
            "ABN: 62 114 887 002",
            "Policy Number: BLU-PL-889231",
            "Class of Policy: Broadform Public and Products Liability",
            ("gap", ""),
            ("heading", "Period of Insurance"),
            "From: 2025-07-01 at 4:00pm",
            "To: 2026-07-01 at 4:00pm",
            ("gap", ""),
            "Limit of Indemnity: AUD 20,000,000 any one occurrence",
            "Products Liability Aggregate: AUD 20,000,000 any one period of insurance",
        ],
        [
            ("title", "SCHEDULE OF EXCESSES AND CONDITIONS"),
            ("rule", ""),
            "Standard Excess: AUD 2,500 each and every claim",
            "Excess for claims arising from hot works: AUD 10,000 each and every claim",
            ("gap", ""),
            "Interested Parties Noted: Northside Development Trust",
            "Territorial Limits: Australia and New Zealand",
            ("gap", ""),
            ("heading", "Endorsement 4 - Hot Works Warranty"),
            "Hot works must cease no less than 60 minutes before the site is",
            "vacated, and a fire watch must be maintained for that period.",
            "Cover is excluded for any claim arising from hot works carried out",
            "without a completed hot works permit.",
            ("gap", ""),
            "This certificate is issued as a matter of information only and",
            "confers no rights upon the certificate holder.",
        ],
    ],

    "SWMS - Tower Crane Lift Operations.pdf": [
        [
            ("title", "SAFE WORK METHOD STATEMENT"),
            "Activity: Tower Crane Lift Operations",
            ("rule", ""),
            "Document Number: SWMS-TC-014",
            "Revision: 3",
            "Date Prepared: 2025-02-10",
            "Prepared By: Priya Raman, Site Safety Manager",
            "Review Due: 2026-02-10",
            ("gap", ""),
            "Principal Contractor: Northside Civil Contracting Pty Ltd",
            "Site: Lot 14 Harbour Street, Sydney",
            ("gap", ""),
            ("heading", "High Risk Construction Work Categories Applicable"),
            "- Work involving a risk of a person falling more than 2 metres",
            "- Work in an area with movement of powered mobile plant",
            "- Work involving structural alterations requiring temporary support",
        ],
        [
            ("title", "CONTROL MEASURES"),
            ("rule", ""),
            "Maximum wind speed for lifting operations is 36 kilometres per hour",
            "measured at the jib. All lifting must stop above this threshold and",
            "the load must be landed.",
            ("gap", ""),
            "Exclusion zone: a minimum radius of 1.5 times the load radius must be",
            "barricaded and marked, with a spotter stationed at each access point.",
            ("gap", ""),
            "Dogman and crane operator must maintain continuous two-way radio",
            "contact on channel 14. If radio contact is lost the lift is to be",
            "aborted and the load landed at the nearest safe position.",
            ("gap", ""),
            "Pre-start inspection of slings and shackles is required at the start",
            "of every shift and recorded in the lifting gear register.",
        ],
    ],

    "Workers Compensation - Southbank Fitout.pdf": [[
        ("title", "WORKERS COMPENSATION INSURANCE"),
        "Certificate of Currency",
        ("rule", ""),
        "Employer: Southbank Fitout Group Pty Ltd",
        "ABN: 41 903 552 118",
        "Policy Number: WC-QLD-4410982",
        "Insurer: WorkCover Queensland",
        ("gap", ""),
        ("heading", "Period of Cover"),
        "From: 2025-10-01",
        "To: 2026-09-30",
        ("gap", ""),
        "Declared Wages for Period: AUD 3,420,000",
        "Industry Classification: 32410 - Building Installation Services",
        ("gap", ""),
        "Claims must be lodged within 6 months of the date of injury.",
    ]],

    "Asbestos Awareness - Daniel Okafor.pdf": [[
        ("title", "STATEMENT OF ATTAINMENT"),
        "CPCCDE3014 Remove non-friable asbestos",
        ("rule", ""),
        "Student Name: Daniel Okafor",
        "Student Identifier: SI-2298-7741",
        "Completion Date: 2024-09-05",
        "Expiry Date: 2029-09-05",
        "Registered Training Organisation: Southbank Safety Institute (RTO 90210)",
        ("gap", ""),
        "Assessment Outcome: Competent",
        ("gap", ""),
        "This statement of attainment covers non-friable asbestos removal only.",
        "Friable asbestos removal requires a Class A licence and is not",
        "authorised by this qualification.",
    ]],
}


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "sample-documents")
    out.mkdir(parents=True, exist_ok=True)

    for filename, pages in DOCUMENTS.items():
        path = out / filename
        build(path, pages)
        print(f"  {filename}  ({len(pages)} page{'s' if len(pages) > 1 else ''}, {path.stat().st_size // 1024} KB)")

    print(f"\n{len(DOCUMENTS)} PDFs written to {out.resolve()}")


if __name__ == "__main__":
    main()
