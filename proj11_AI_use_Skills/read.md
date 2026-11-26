# --- sau khi generate skill tren GPU A100
lay ve va nhet vao AI xem dung dc skill không

# --- install
playwright install chromium

# --- run
.\.venv\Scripts\Activate.ps1

- chay benmark
python run_gemini_skills.py --benchmark

- chat tuong tac
python run_gemini_skills.py --chat