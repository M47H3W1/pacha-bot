"""Revisa que los enlaces citados en los .md respondan. Uso: python verificar_enlaces.py <carpeta> salida.json"""
import json, re, sys, ssl, pathlib, urllib.request, urllib.error
UA = {"User-Agent": "Mozilla/5.0 research-probe"}
urls = {}
for f in pathlib.Path(sys.argv[1]).rglob("*.md"):
    for u in re.findall(r"https?://[^\s)>`\"'|]+", f.read_text(encoding="utf-8")):
        urls.setdefault(u.rstrip(".,;"), set()).add(str(f.relative_to(sys.argv[1])))
res = []
for u, fs in sorted(urls.items()):
    if "{" in u or u.endswith(("/api/", "/search/", "/v1/", "/v2.0/")):
        res.append(dict(url=u, estado="base de API (no es página)", archivos=sorted(fs))); continue
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={**UA, "Range": "bytes=0-1023"}), timeout=40)
        est = r.status
    except urllib.error.HTTPError as e:
        est = e.code
    except Exception as e:
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40, context=ssl._create_unverified_context()); est = f"{r.status} (certificado SSL inválido)"
        except Exception as e2:
            est = f"ERROR {type(e2).__name__}: {str(e2)[:60]}"
    res.append(dict(url=u, estado=est, archivos=sorted(fs)))
    print(est, u, flush=True)
json.dump(res, open(sys.argv[2], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
