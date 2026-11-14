# Riferimento indipendente con aggancio al SEGMENTO: UTM 33N (pyproj), shapely per la proiezione, scipy per Dijkstra.
# Uso: python3 walk-ref-segmento.py  (legge dati/walk.json e il fixture dei punti/fermate del test)
import json, re, sys, numpy as np
from pyproj import Transformer
from shapely.geometry import LineString, Point
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
R='/home/coseerobe/GitHub-Clone/coseerobe/marsala_tpl'
j=json.load(open(f'{R}/dati/walk.json')); T=Transformer.from_crs(4326,32633,always_xy=True)
la=np.cumsum(j['la'])/1e5; lo=np.cumsum(j['lo'])/1e5; X,Y=T.transform(lo,la)
e=np.array(j['e']).reshape(-1,2); a=np.cumsum(e[:,0]); b=e[:,1]; m=len(a)
L=np.hypot(X[a]-X[b],Y[a]-Y[b])
G=coo_matrix((np.r_[L,L],(np.r_[a,b],np.r_[b,a])),shape=(len(X),len(X))).tocsr()
mid=np.c_[(X[a]+X[b])/2,(Y[a]+Y[b])/2]
def snap(lat,lon,maxm):
    x,y=T.transform(lon,lat); p=Point(x,y)
    c=np.where(np.hypot(mid[:,0]-x,mid[:,1]-y)<=maxm+L/2+1)[0]
    best=None
    for i in c:
        ls=LineString([(X[a[i]],Y[a[i]]),(X[b[i]],Y[b[i]])]); d=ls.distance(p)
        if best is None or d<best[0]: best=(d,i,ls.project(ls.interpolate(ls.project(p)))/ls.length if ls.length else 0)
    return best if best and best[0]<=maxm else None
src=open(f'{R}/scripts/test.mjs').read()
PY=json.loads(re.search(r'const PY = (\[.*?\]);\n',src,re.S).group(1)); ST=json.loads(re.search(r'const PY_STOPS = (\[.*?\]);\n',src,re.S).group(1))
out=[]
for o in PY:
    s0=snap(o['lat'],o['lon'],150); i,t=s0[1],s0[2]
    d0=np.full(len(X),np.inf); d0[a[i]]=t*L[i]; d0[b[i]]=(1-t)*L[i]
    # Dijkstra multi-sorgente: sorgente fittizia collegata ai due capi
    n=len(X); A=G.tolil(); A.resize((n+1,n+1)); A[n,a[i]]=t*L[i]+1e-9; A[n,b[i]]=(1-t)*L[i]+1e-9
    D=dijkstra(A.tocsr(),directed=True,indices=n)
    res=[]
    for s in o['stops']:
        st=next(x for x in ST if x['id']==s['id']); q=snap(st['lat'],st['lon'],250); k,ts=q[1],q[2]
        d=min(D[a[k]]+ts*L[k],D[b[k]]+(1-ts)*L[k])
        if k==i: d=min(d,abs(ts-t)*L[i])
        res.append({'id':s['id'],'m':round(float(s0[0]+d+q[0]),1)})
    out.append({'lat':o['lat'],'lon':o['lon'],'stops':res})
print(json.dumps(out))
