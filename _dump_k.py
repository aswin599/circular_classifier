import json
S = json.load(open("_structure.json"))
print(type(S), S.keys() if isinstance(S, dict) else len(S))
pg = S["pages"][11] if "pages" in S else S[11]
print(type(pg), list(pg.keys()) if isinstance(pg, dict) else len(pg))
for k in pg:
    v = pg[k]
    print(k, type(v).__name__, (len(v) if hasattr(v,"__len__") else v))
