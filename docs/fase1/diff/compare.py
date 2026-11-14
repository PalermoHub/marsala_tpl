import sys, json, collections
exp = json.load(open(sys.argv[1]))['q']; act = json.load(open(sys.argv[2])); label = sys.argv[3]
cls = collections.Counter(); ex = collections.defaultdict(list)
def key(x): return (x[0], x[1], x[2])            # secs, trip, pos
for q, a in zip(exp, act):
    E = [tuple(x) for x in q['exp']]; A = [tuple(x) for x in a['items']]
    tie = {key(tuple(x)) for x in q['tie']}
    ok = True; why = None
    if [e[0] for e in E] != [x[0] for x in A]: ok=False; why='orari diversi'
    else:
        # a parità di orario l'ordine è libero: confronto per insiemi, ammesso scambio col pari-orario oltre il taglio
        for t in sorted({e[0] for e in E}):
            se = {key(e) for e in E if e[0]==t}; sa = {key(x) for x in A if x[0]==t}
            if se != sa:
                if t == E[-1][0] and len(sa)==len(se) and sa <= tie: continue
                ok=False; why='corse diverse a parità di orario'; break
    # domani
    TE = {key(tuple(x)) for x in q['tom']}; TA = {key(tuple(x)) for x in a['tom']}
    if ok and len(E) < 6:
        if not TE and not TA: pass
        elif not TA or not TE or not (TA <= TE): ok=False; why='prima partenza di domani'
    c = 'ok' if ok else why
    cls[c]+=1
    if not ok and len(ex[c])<6: ex[c].append((q['stop'],q['ymd'],q['secs'],E[:3],A[:3],sorted(TE)[:2],sorted(TA)[:2]))
print(f"[{label}] query={len(exp)}", dict(cls))
if len(sys.argv)>4: json.dump({k:v for k,v in ex.items()}, open(sys.argv[4],'w'), indent=1, default=str)
bad=[(q['ymd'],q['stop'],q['secs']) for q,a in zip(exp,act) if False]
for k,v in ex.items():
    print(' ',k)
    for e in v[:3]: print('    ',e)
