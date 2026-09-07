node -e "const fs=require('fs'); const p='changes.diff'; fs.writeFileSync(p, fs.readFileSync(p,'utf8').replace(/\u00a0/g,' '));"
git apply --reject --ignore-whitespace changes.diff