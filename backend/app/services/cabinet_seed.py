"""Add labelled sample PDFs without replacing uploaded company documents."""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Application, ApplicationDocument, CompanyDocument, User


def demo_pdf(label: str, inn: str) -> bytes:
    text = f"BT /F1 18 Tf 55 760 Td (DEMONSTRATION DOCUMENT) Tj 0 -32 Td /F1 12 Tf ({label}) Tj 0 -24 Td (Company INN: {inn}) Tj 0 -24 Td (Sample data for the credit cabinet. Not a legal document.) Tj ET".encode("ascii")
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>", b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", b"<< /Length " + str(len(text)).encode() + b" >>\nstream\n" + text + b"\nendstream"]
    data = bytearray(b"%PDF-1.4\n"); offsets = [0]
    for index, item in enumerate(objects, 1):
        offsets.append(len(data)); data.extend(f"{index} 0 obj\n".encode() + item + b"\nendobj\n")
    xref = len(data); data.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        data.extend(f"{offset:010d} 00000 n \n".encode())
    data.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(data)


async def seed_cabinet_documents(db: AsyncSession) -> None:
    users = (await db.scalars(select(User).where(User.email.in_(["client1@example.com", "client2@example.com", "client3@example.com"])))).all()
    templates = [("company", "Демо — карточка компании.pdf", "Сведения о компании", "Company card"), ("statement", "Демо — выписка по счёту.pdf", "Последние 6 месяцев · пример", "Account statement"), ("finance", "Демо — финансовая отчётность.pdf", "Отчётный период: 2025 год · пример", "Financial report")]
    for user in users:
        if user.company is None:
            continue
        documents = (await db.scalars(select(CompanyDocument).where(CompanyDocument.owner_id == user.id, CompanyDocument.is_current.is_(True)))).all()
        for kind, filename, period, label in templates:
            if any(document.kind == kind for document in documents):
                continue
            content = demo_pdf(label, user.company.inn)
            document = CompanyDocument(id=str(uuid4()), owner_id=user.id, kind=kind, filename=filename, period=period, content=content, size=len(content), is_current=True)
            db.add(document); documents.append(document)
        await db.flush()
        applications = (await db.scalars(select(Application).where(Application.client_id == user.id, Application.status != "DRAFT", Application.documents_confirmed_at.is_(None)))).all()
        for application in applications:
            existing = await db.scalar(select(ApplicationDocument).where(ApplicationDocument.application_id == application.id).limit(1))
            if existing is None:
                db.add_all([ApplicationDocument(application_id=application.id, document_id=document.id) for document in documents])
                application.documents_confirmed_at = application.submitted_at or datetime.now(timezone.utc)
    await db.commit()
