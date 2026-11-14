# Riferimento indipendente: gtfs-kit (calendario) + pandas. Non usa nulla di js/schedule.js né di build-gtfs.mjs.
import sys, json, random, datetime as dt
import pandas as pd, gtfs_kit as gk
raw, out, n, seed = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
feed = gk.read_feed(raw, dist_units='m')
st = feed.stop_times.copy()
def secs(x): h,m,z=map(int,x.split(':')); return h*3600+m*60+z
st['t'] = st.departure_time.where(st.departure_time!='', st.arrival_time).map(secs)
st['stop_sequence']=st.stop_sequence.astype(int)
st = st.sort_values(['trip_id','stop_sequence'])
st['rank'] = st.groupby('trip_id').cumcount()
st['last'] = st.groupby('trip_id')['rank'].transform('max')
board = st[st['rank'] < st['last']]                      # regola di prodotto: al capolinea d'arrivo non si sale
trips = feed.trips.set_index('trip_id')
D0, D1 = dt.date(2026,5,25), dt.date(2027,7,10)
alld = [(D0+dt.timedelta(d)).strftime('%Y%m%d') for d in range((D1-D0).days+1)]
act = feed.compute_trip_activity(alld).set_index('trip_id')     # trip x data -> 0/1 (calendar + calendar_dates)
actset = {d: (set(act.index[act[d]==1]) if d in act.columns else set()) for d in alld}
print('date con colonna in gtfs-kit:', len(act.columns), 'su', len(alld))
byStop = {sid: g for sid, g in board.groupby('stop_id')}
def ymd(d, k): return (dt.datetime.strptime(d,'%Y%m%d')+dt.timedelta(k)).strftime('%Y%m%d')
def nxt(sid, d, T, limit=6):
    g = byStop.get(sid)
    if g is None: return [], ([], [])
    a0, am1 = actset.get(d,set()), actset.get(ymd(d,-1),set())
    r = []
    for row in g.itertuples():
        if row.trip_id in a0 and row.t >= T: r.append((row.t, row.trip_id, row.rank, 0))
        if row.trip_id in am1 and row.t >= 86400 and row.t-86400 >= T: r.append((row.t-86400, row.trip_id, row.rank, 0))
    r.sort(key=lambda x: x[0])
    items = r[:limit]
    # tutti gli elementi oltre il taglio che pareggiano l'ultimo orario sono equivalenti
    tie = [x for x in r if x[0]==items[-1][0]] if len(r)>limit else []
    tom = []
    if len(r) < limit:
        a1 = actset.get(ymd(d,1),set())
        c = [(row.t,row.trip_id,row.rank,1) for row in g.itertuples() if row.trip_id in a1 and row.t < 86400]
        if c: m = min(x[0] for x in c); tom = [x for x in c if x[0]==m]
    return items+[], (tie, tom)
random.seed(seed)
stops = list(feed.stops.stop_id[feed.stops.stop_id.isin(st.stop_id)])
special = {'20260614','20260615','20260913','20260914','20261031','20261101','20261102','20261208','20261225','20261226','20270101','20270106','20270329','20270501','20270602','20270612','20270613','20270614','20261025','20261026','20270328','20270329'}
cd = pd.read_csv(f"{raw}/calendar_dates.txt", dtype=str); special |= set(cd.date)
special = {x for x in special if x in actset}
sp = sorted(special)
for d in list(sp):
    for k in (-1,1):
        z = ymd(d,k)
        if z in actset: special.add(z)
sp = sorted(special)
deps = board[['stop_id','t']].values.tolist()
Q = []
deps2 = [x for x in deps if x[1] >= 86400]
for i in range(n):
    r = random.random()
    d = random.choice(sp) if random.random()<0.4 else random.choice(alld)
    if r < 0.15 and deps2:
        sid, t = random.choice(deps2); T = max(t-86400+random.choice([-1,0,1]),0)
    elif r < 0.40: sid = random.choice(stops); T = random.randint(0,86399)
    elif r < 0.65: sid = random.choice(stops); T = random.choice([random.randint(22*3600,86399), random.randint(0,4*3600)])
    else:
        sid, t = random.choice(deps); T = t%86400 + random.choice([-1,0,1]); T = min(max(T,0),86399)
    items,(tie,tom) = nxt(sid,d,T)
    Q.append({'stop':sid,'ymd':int(d),'secs':T,
              'exp':[list(x) for x in items],'tie':[list(x) for x in tie],'tom':[list(x) for x in tom]})
json.dump({'q':Q,'order':list(feed.trips.trip_id)}, open(out,'w'))
print(len(Q), 'query; con >=1 risultato:', sum(1 for q in Q if q['exp']), '; vuote:', sum(1 for q in Q if not q['exp']), '; con domani:', sum(1 for q in Q if q['tom']))
