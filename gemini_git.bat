@echo off
rem Applies changes.diff copied as text from the Gemini chat.
rem gemini_fix_diff.cjs first undoes the chat damage (non-breaking spaces, CRLF,
rem missing final newline, comment lines turned into "- " bullets).
rem .cjs because this package is "type": "module" and require() is not valid in .js.
node gemini_fix_diff.cjs changes.diff || exit /b 1
git apply --check changes.diff || exit /b 1
git apply changes.diff && echo Applied.
