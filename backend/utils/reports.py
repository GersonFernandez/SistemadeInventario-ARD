import io
from datetime import datetime
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.drawing.image import Image as XLImage
from openpyxl.utils import get_column_letter, column_index_from_string


def _resolve_logo_path():
    """Resolve institutional logo path from known project locations."""
    backend_root = Path(__file__).resolve().parents[1]
    repo_root = backend_root.parent
    candidates = [
        backend_root / 'logo.jpeg',
        backend_root / 'logo.jpg',
        backend_root / 'logo.png',
        repo_root / 'logo.jpeg',
        repo_root / 'logo.jpg',
        repo_root / 'logo.png',
        repo_root / 'frontend' / 'src' / 'assets' / 'logo.jpeg',
        repo_root / 'frontend' / 'src' / 'assets' / 'logo.png',
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return str(candidate)
    return None


def _fit_box(width, height, max_width, max_height):
    """Scale dimensions to fit inside a bounding box while preserving aspect ratio."""
    if not width or not height:
        return max_width, max_height
    scale = min(max_width / float(width), max_height / float(height))
    return width * scale, height * scale


def _build_pdf_response(title, headers, rows, include_signatures=False, signature_names=None, metadata_lines=None):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    elements = []
    heading_style = styles['Heading1']
    heading_style.alignment = TA_CENTER
    subheading_style = styles['Heading2']
    subheading_style.alignment = TA_CENTER
    normal_center_style = styles['Normal']
    normal_center_style.alignment = TA_CENTER

    logo_path = _resolve_logo_path()
    header_logo = None
    if logo_path:
        try:
            header_logo = Image(logo_path)
            fitted_width, fitted_height = _fit_box(
                getattr(header_logo, 'imageWidth', 0),
                getattr(header_logo, 'imageHeight', 0),
                min(doc.width, 240),
                80,
            )
            header_logo.drawWidth = fitted_width
            header_logo.drawHeight = fitted_height
            header_logo.hAlign = 'CENTER'
        except Exception:
            # If image parsing fails, continue report generation without logo.
            header_logo = None

    header_text = [
        Paragraph("ARMADA DE REPÚBLICA DOMINICANA", heading_style),
        Paragraph("TALLER DE ELECTRÓNICA, ARD", heading_style),
        Paragraph(title, subheading_style),
        Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", normal_center_style),
    ]
    if header_logo:
        elements.append(header_logo)
        elements.append(Spacer(1, 8))
    elements.extend(header_text)

    if metadata_lines:
        elements.append(Spacer(1, 10))
        for line in metadata_lines:
            elements.append(Paragraph(line, normal_center_style))
    elements.append(Spacer(1, 20))

    data = [headers] + rows
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f3f4f6')),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(table)

    if include_signatures:
        elements.append(Spacer(1, 28))
        delivered_name = (signature_names or {}).get('delivered_by', '')
        received_name = (signature_names or {}).get('received_by', '')
        signature_headers = ['Entregado por', 'Recibido por']
        signature_rows = [[delivered_name, received_name], ['______________________________', '______________________________']]
        sig_table = Table([signature_headers] + signature_rows, colWidths=[280, 280])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(sig_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer


def _build_excel_response(title, headers, rows):
    buffer = io.BytesIO()
    wb = Workbook()
    ws = wb.active
    # Excel no permite estos caracteres en el nombre del sheet
    safe_title = title.replace('/', '-').replace('\\', '-').replace(':', '-').replace('*', '-').replace('?', '-').replace('[', '-').replace(']', '-')[:31]
    ws.title = safe_title

    logo_path = _resolve_logo_path()
    first_title_row = 1
    title_start_column = 'A'
    if logo_path:
        try:
            img = XLImage(logo_path)
            fitted_width, fitted_height = _fit_box(img.width, img.height, 240, 80)
            img.width = fitted_width
            img.height = fitted_height
            ws.add_image(img, 'A1')
            title_start_column = 'A'
            first_title_row = 5
            ws.row_dimensions[1].height = 25
            ws.row_dimensions[2].height = 25
            ws.row_dimensions[3].height = 25
            ws.row_dimensions[4].height = 25
        except Exception:
            first_title_row = 1
            title_start_column = 'A'

    end_column_index = max(len(headers), column_index_from_string(title_start_column) + 3)
    end_column = get_column_letter(end_column_index)
    ws.merge_cells(f"{title_start_column}{first_title_row}:{end_column}{first_title_row}")
    ws[f'{title_start_column}{first_title_row}'] = "ARMADA DE REPÚBLICA DOMINICANA"
    ws[f'{title_start_column}{first_title_row}'].font = Font(bold=True, size=14)
    ws[f'{title_start_column}{first_title_row}'].alignment = Alignment(horizontal='center')

    ws.merge_cells(f"{title_start_column}{first_title_row + 1}:{end_column}{first_title_row + 1}")
    ws[f'{title_start_column}{first_title_row + 1}'] = "TALLER DE ELECTRÓNICA, ARD"
    ws[f'{title_start_column}{first_title_row + 1}'].font = Font(bold=True, size=12)
    ws[f'{title_start_column}{first_title_row + 1}'].alignment = Alignment(horizontal='center')

    ws.merge_cells(f"{title_start_column}{first_title_row + 2}:{end_column}{first_title_row + 2}")
    ws[f'{title_start_column}{first_title_row + 2}'] = title
    ws[f'{title_start_column}{first_title_row + 2}'].font = Font(bold=True, size=12)
    ws[f'{title_start_column}{first_title_row + 2}'].alignment = Alignment(horizontal='center')

    ws.merge_cells(f"{title_start_column}{first_title_row + 3}:{end_column}{first_title_row + 3}")
    ws[f'{title_start_column}{first_title_row + 3}'] = f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    ws[f'{title_start_column}{first_title_row + 3}'].alignment = Alignment(horizontal='center')

    header_row = first_title_row + 6
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col, value=header)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill(start_color='1E3A5F', end_color='1E3A5F', fill_type='solid')
        cell.alignment = Alignment(horizontal='center')

    for row_idx, row in enumerate(rows, header_row + 1):
        for col_idx, value in enumerate(row, 1):
            ws.cell(row=row_idx, column=col_idx, value=value)

    for col in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(col)].width = 20

    wb.save(buffer)
    buffer.seek(0)
    return buffer


def build_report(title, headers, rows, format='pdf', include_signatures=False, signature_names=None, metadata_lines=None):
    if format == 'pdf':
        return _build_pdf_response(
            title,
            headers,
            rows,
            include_signatures=include_signatures,
            signature_names=signature_names,
            metadata_lines=metadata_lines,
        )
    elif format == 'excel':
        return _build_excel_response(title, headers, rows)
    raise ValueError("Format must be 'pdf' or 'excel'")
