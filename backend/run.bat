@echo off
echo Starting Taskerrand Backend Server...
echo.
cd /d %~dp0
call venv\Scripts\activate.bat
python main.py
pause

