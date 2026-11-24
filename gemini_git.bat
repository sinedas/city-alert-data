certutil -decode   .\base64.diff  changes.diff
git apply --reject --ignore-whitespace changes.diff
del base64.diff
del changes.diff
