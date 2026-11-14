import json,sys
j=json.load(open(sys.argv[1]))
if 'messages' in j and j['messages']: print('MSG',j['messages'])
print('celda',j['geometry']['coordinates'])
for k,v in j['properties']['parameter'].items():
    ks=sorted(v); good=[d for d in ks if v[d] not in (-999,-999.0,None)]
    print(f'{k:22} n={len(good):6}/{len(ks)} primero={good[0] if good else None} ultimo={good[-1] if good else None}')
