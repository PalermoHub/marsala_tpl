import json, sys, collections, datetime as dt
FEST={20261208,20261225,20270101,20270106,20270329,20270602}
def nd(y): d=dt.datetime.strptime(str(y),'%Y%m%d')+dt.timedelta(1); return int(d.strftime('%Y%m%d'))
for tag in ('real','syn'):
    exp=json.load(open(f'diff/exp-{tag}.json'))['q']; A=json.load(open(f'diff/act-{tag}.json')); B=json.load(open(f'diff/act-{tag}--no-holiday-fix.json'))
    c=collections.Counter(); other=[]
    for q,a,b in zip(exp,A,B):
        if a==b: continue
        d=q['ymd']; lbl=None
        if d in FEST: lbl='data = festivo FER5'
        elif nd(d) in FEST: lbl='"domani" = festivo FER5 (query il giorno prima)'
        elif d-0 in {20270330}: lbl='?'
        else:
            # giorno dopo la festività con spillover da ieri? (nessun orario >24h nel feed reale)
            lbl='ALTRO'; other.append((q['stop'],d,q['secs']))
        c[lbl]+=1
    print(tag,dict(c),other[:5])
    # esercizio post-mezzanotte
    spill=sum(1 for q in exp if any(x[0]!=x[0] for x in q['exp']))
    n_y=0
    for q,a in zip(exp,A):
        pass
