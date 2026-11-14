import sys, pandas as pd
D=sys.argv[1]
rd=lambda n: pd.read_csv(f"{D}/{n}.txt",dtype=str,keep_default_na=False)
trips,st,routes=rd("trips"),rd("stop_times"),rd("routes")
hms=lambda s:(lambda a:int(a[0])*3600+int(a[1])*60+int(a[2]))(s.split(":"))
st["seq"]=st.stop_sequence.astype(int); st=st.sort_values(["trip_id","seq"])
st["t"]=st.arrival_time.map(hms); st["sd"]=st.shape_dist_traveled.astype(float)
g=st.groupby("trip_id")
st["dt"]=g.t.diff(); st["dd"]=g.sd.diff()
seg=st.dropna(subset=["dt"]); seg=seg[seg.dd>0]
seg=seg.assign(kmh=seg.dd/seg.dt.where(seg.dt>0)*3.6)
fa=seg[seg.trip_id.str.match(r"^\d+_[A-Z]_\d_\d+$")]
print("formato A: segmenti",len(fa),"| km/h p1/p50/p99:",fa.kmh.quantile([.01,.5,.99]).round(2).tolist(),"| quota entro 23.9–24.1:",round(((fa.kmh>23.9)&(fa.kmh<24.1)).mean(),3))
# corse di formato A: velocità media corsa, per route, quante esattamente 24.0
tt=st.groupby("trip_id").agg(dur=("t",lambda s:s.max()-s.min()),len=("sd",lambda s:s.max()-s.min()))
tt["kmh"]=tt.len/tt.dur*3.6
tt=tt.join(trips.set_index("trip_id").route_id).join(routes.set_index("route_id").route_short_name,on="route_id")
a=tt[tt.index.str.match(r"^\d+_[A-Z]_\d_\d+$")]
print("formato A: corse",len(a),"| con media 24.0±0.15 km/h:",int(((a.kmh-24).abs()<0.15).sum()))
print(a.groupby("route_short_name").kmh.agg(lambda s:f"{(abs(s-24)<0.15).sum()}/{len(s)}").to_dict())
other=tt[~tt.index.str.match(r"^\d+_[A-Z]_\d_\d+$")]
print("altri formati: corse",len(other),"| con media 24.0±0.15:",int(((other.kmh-24).abs()<0.15).sum()))
