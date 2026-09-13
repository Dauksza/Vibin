"""Project intelligence: symbol graph + inverted index for semantic grounding."""
from __future__ import annotations
import re
from pathlib import Path

SKIP = {".git", ".forge", "node_modules", "__pycache__", ".venv", "dist", "build"}
SYM = re.compile(r"^\s*(?:def|class)\s+(\w+)|^\s*(?:export\s+)?(?:const|function)\s+(\w+)|^\s*@\w+")
WORD = re.compile(r"[a-zA-Z_][a-zA-Z0-9_]{2,}")

def build_index(root):
    root = Path(root)
    files = {}
    symbols = {}
    for p in root.rglob("*"):
        if any(s in p.parts for s in SKIP) or not p.is_file():
            continue
        if p.suffix not in (".py", ".ts", ".tsx", ".js", ".jsx", ".sql", ".md", ".json", ".html", ".css"):
            continue
        try:
            text = p.read_text(errors="ignore")
        except OSError:
            continue
        rel = str(p.relative_to(root))
        toks = set(w.lower() for w in WORD.findall(text))
        files[rel] = toks
        for line in text.splitlines():
            mm = SYM.match(line)
            if mm:
                sym = next(g for g in mm.groups() if g)
                symbols.setdefault(sym.lower(), []).append(rel)
    return {"files": files, "symbols": symbols}

def query(index, q: str, k=6):
    terms = [t.lower() for t in WORD.findall(q)]
    scores = []
    for rel, toks in index["files"].items():
        s = sum(1 for t in terms if t in toks)
        for t in terms:
            if t in index["symbols"] and rel in index["symbols"][t]:
                s += 3
        if s:
            scores.append((s, rel))
    return [rel for _, rel in sorted(scores, reverse=True)[:k]]
