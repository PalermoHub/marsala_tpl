import json, numpy as np, pandas as pd
from pyproj import Transformer
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra, connected_components
from scipy.spatial import cKDTree
import os; S=os.environ["FASE1_DIR"]
T=Transformer.from_crs(4326,32633,always_xy=True)
ways=json.load(open(f"{S}/osm/ways.json"))["elements"]
ids={}; xy=[]; a=[]; b=[]
def nid(i,lon,lat):
    if i not in ids: ids[i]=len(ids); xy.append((lon,lat))
    return ids[i]
for w in ways:
    ns=[nid(n,g["lon"],g["lat"]) for n,g in zip(w["nodes"],w["geometry"])]
    a+=ns[:-1]; b+=ns[1:]
xy=np.array(xy); X,Y=T.transform(xy[:,0],xy[:,1]); P=np.c_[X,Y]
a=np.array(a); b=np.array(b); L=np.hypot(P[a,0]-P[b,0],P[a,1]-P[b,1])
n=len(P); G=coo_matrix((np.r_[L,L],(np.r_[a,b],np.r_[b,a])),shape=(n,n)).tocsr()
nc,lab=connected_components(G,directed=False)
big=np.bincount(lab).argmax(); keep=lab==big
print(f"grafo: {n} nodi, {len(a)} archi, componenti {nc}, nodi nella più grande {keep.sum()} ({100*keep.mean():.0f}%)")
stops=pd.read_csv(f"{S}/gtfs-raw/stops.txt"); sx,sy=T.transform(stops.stop_lon.values,stops.stop_lat.values); SP=np.c_[sx,sy]
tree=cKDTree(P[keep]); kidx=np.where(keep)[0]
sd,si=tree.query(SP); sn=kidx[si]
print(f"fermate: distanza dal grafo p50/p95/max m: {np.percentile(sd,50):.0f}/{np.percentile(sd,95):.0f}/{sd.max():.0f} | oltre 100 m: {(sd>100).sum()}")
# campione: nodi del grafo con almeno una fermata entro 800 m in linea d'aria
rng=np.random.default_rng(42)
stree=cKDTree(SP)
cand=kidx[[len(stree.query_ball_point(P[i],800))>0 for i in kidx]]
samp=rng.choice(cand,size=min(600,len(cand)),replace=False)
print("punti campione:",len(samp),"su",len(cand),"candidati")
res=[]
for o in samp:
    d=dijkstra(G,indices=o,limit=2500)
    cd=np.hypot(SP[:,0]-P[o,0],SP[:,1]-P[o,1])
    net=d[sn]+sd; net[np.isinf(d[sn])]=np.inf
    net=np.where(np.isinf(net),np.inf,net)
    cr=cd.argsort()
    near4=[i for i in cr if cd[i]<=800][:4]          # come walkable() in planner.js
    near6=cr[:6]                                       # come nearestStops() in schedule.js
    nr=np.argsort(net)[:6]
    for i in near4: res.append(dict(kind="walk4",ratio=net[i]/cd[i] if net[i]<np.inf else np.nan,over800=net[i]>800,extra_min=(net[i]-cd[i])/1.2/60 if net[i]<np.inf else np.nan,unreach=net[i]==np.inf))
    res.append(dict(kind="near",same1=cr[0]==nr[0],ov6=len(set(cr[:6])&set(nr))/6,nearest_net_over_crow=net[cr[0]]/cd[cr[0]] if cd[cr[0]]>0 else np.nan))
R=pd.DataFrame(res); w=R[R.kind=="walk4"].copy(); nn=R[R.kind=="near"].copy()
w["over800"]=w.over800.astype(float); w["unreach"]=w.unreach.astype(float); nn["same1"]=nn.same1.astype(float); nn["ov6"]=nn.ov6.astype(float); nn["nearest_net_over_crow"]=nn.nearest_net_over_crow.astype(float)
print(f"\nwalkable() (≤800 m in linea d'aria, 4 più vicine): {len(w)} coppie")
print(f"  distanza a piedi / linea d'aria: p50 {w.ratio.median():.2f}  p90 {w.ratio.quantile(.9):.2f}  max {w.ratio.max():.2f}")
print(f"  coppie che a piedi superano gli 800 m: {100*w.over800.mean():.1f}%  | non raggiungibili sulla rete: {100*w.unreach.mean():.1f}%")
print(f"  tempo di cammino sottostimato (min) p50 {w.extra_min.median():.1f}  p90 {w.extra_min.quantile(.9):.1f}  max {w.extra_min.max():.1f}")
print(f"\nnearestStops() (6 più vicine): {len(nn)} punti")
print(f"  la fermata più vicina in linea d'aria è anche la più vicina a piedi: {100*nn.same1.mean():.1f}%")
print(f"  sovrapposizione media delle 6 fermate: {100*nn.ov6.mean():.0f}%")
print(f"  punti con la più vicina in linea d'aria ≥1.5× più lontana a piedi: {100*(nn.nearest_net_over_crow>=1.5).mean():.1f}%")
