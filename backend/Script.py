import os
from reportlab.platypus import SimpleDocTemplate, Paragraph, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import letter

# 🔹 Base path (backend)
BASE_PATH = r"C:\Users\Bhargav M\OneDrive\ドキュメント\OpthaMiss-main\backend"

# 🔹 Output PDF
OUTPUT_PDF = "backend_code_compact.pdf"

# 🔹 Ignore folders
IGNORE_DIRS = {
    "node_modules", ".git", "dist", "build",
    "__pycache__", ".next", "coverage"
}

# 🔹 Only Python files
VALID_EXTENSIONS = {".py"}

# 🔹 Document settings (compact)
doc = SimpleDocTemplate(
    OUTPUT_PDF,
    pagesize=letter,
    leftMargin=20,
    rightMargin=20,
    topMargin=20,
    bottomMargin=20
)

styles = getSampleStyleSheet()

# 🔹 Styles
path_style = ParagraphStyle(
    name="PathStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=7,
    spaceAfter=2
)

code_style = ParagraphStyle(
    name="CodeStyle",
    parent=styles["Code"],
    fontName="Courier",
    fontSize=6,
    leading=7,
    leftIndent=2,
    spaceAfter=4
)

content = []

def is_valid_file(filename):
    return any(filename.endswith(ext) for ext in VALID_EXTENSIONS)

def should_ignore(path):
    return any(ignore in path for ignore in IGNORE_DIRS)

def compress_code(code):
    """Remove extra blank lines"""
    lines = code.split("\n")
    compressed = []
    prev_blank = False

    for line in lines:
        if line.strip() == "":
            if not prev_blank:
                compressed.append(line)
            prev_blank = True
        else:
            compressed.append(line)
            prev_blank = False

    return "\n".join(compressed)

# 🔹 Walk through backend files
for root, dirs, files in os.walk(BASE_PATH):
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

    for file in sorted(files):
        if not is_valid_file(file):
            continue

        full_path = os.path.join(root, file)

        if should_ignore(full_path):
            continue

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                code = f.read()

            code = compress_code(code)
            relative_path = os.path.relpath(full_path, BASE_PATH)

            # 🔹 Add file path
            content.append(Paragraph(f"📄 {relative_path}", path_style))

            # 🔹 Add code
            content.append(Preformatted(code, code_style))

        except Exception as e:
            print(f"Error reading {full_path}: {e}")

# 🔹 Build PDF
doc.build(content)

print("✅ Backend PDF generated:", OUTPUT_PDF)