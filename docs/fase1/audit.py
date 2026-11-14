import sys, math, datetime as dt
import pandas as pd
from pyproj import Transformer
from shapely.geometry import LineString, Point

D = sys.argv[1]
rd = lambda n: pd.read_csv(f"{D}/{n}.txt", dtype=str, keep_default_na=False)
stops, trips, st, shp, routes = rd("stops"), rd("trips"), rd("stop_times"), rd("shapes"), rd("routes")
cal, cd = rd("calendar"), rd("calendar_dates")
T = Transformer.from_crs(4326, 32633, always_xy=True)
def hms(s):
    h, m, x = map(int, s.split(":")); return h * 3600 + m * 60 + x

def sec(t): print(f"\n## {t}")

# 1. Integrità referenziale
sec("1. Integrità referenziale")
print("trips senza route:", (~trips.route_id.isin(routes.route_id)).sum())
svc = set(cal.service_id) | set(cd.service_id)
print("trips con service_id sconosciuto:", (~trips.service_id.isin(svc)).sum())
print("trips con shape mancante:", (~trips.shape_id.isin(shp.shape_id)).sum(), "| senza shape_id:", (trips.shape_id == "").sum())
print("stop_times con stop sconosciuto:", (~st.stop_id.isin(stops.stop_id)).sum())
print("stop_times con trip sconosciuto:", (~st.trip_id.isin(trips.trip_id)).sum())
print("trips senza stop_times:", (~trips.trip_id.isin(st.trip_id)).sum())
print("fermate mai usate:", (~stops.stop_id.isin(st.stop_id)).sum(), "su", len(stops))
print("shapes mai usate:", (~shp.shape_id.drop_duplicates().isin(trips.shape_id)).sum())
print("routes senza trips:", routes[~routes.route_id.isin(trips.route_id)][["route_id","route_short_name","route_long_name"]].values.tolist())
print("service_id in calendar_dates ma non in calendar:", sorted(set(cd.service_id) - set(cal.service_id)))
print("route_short_name duplicati:", routes.route_short_name[routes.route_short_name.duplicated(keep=False)].tolist())
print("route_color vuoti:", (routes.route_color == "").sum(), "su", len(routes))

# 2. Tempi e velocità
sec("2. Tempi e velocità")
st["seq"] = st.stop_sequence.astype(int)
st = st.sort_values(["trip_id", "seq"]).reset_index(drop=True)
st["arr"] = st.arrival_time.map(hms); st["dep"] = st.departure_time.map(hms)
print("orari >= 24:00:", (st.arr >= 86400).sum(), "| max:", st.arrival_time.max())
print("arrivo > partenza nella stessa fermata:", (st.arr > st.dep).sum())
sid = stops.set_index("stop_id")
x, y = T.transform(sid.stop_lon.astype(float).values, sid.stop_lat.astype(float).values)
sid["x"], sid["y"] = x, y
st["x"] = st.stop_id.map(sid.x); st["y"] = st.stop_id.map(sid.y)
g = st.groupby("trip_id")
st["dist"] = ((st.x - g.x.shift()) ** 2 + (st.y - g.y.shift()) ** 2) ** 0.5
st["dt"] = st.arr - g.dep.shift()
seg = st.dropna(subset=["dt"]).copy()
print("segmenti:", len(seg), "| tempo negativo:", (seg.dt < 0).sum(), "| tempo zero con >100 m:", ((seg.dt == 0) & (seg.dist > 100)).sum())
seg["kmh"] = seg.dist / seg.dt.where(seg.dt > 0) * 3.6
print("velocità (linea d'aria) p50/p95/max km/h:", seg.kmh.quantile(.5).round(1), seg.kmh.quantile(.95).round(1), seg.kmh.max().round(1))
for lim in (60, 80):
    print(f"segmenti > {lim} km/h:", (seg.kmh > lim).sum())
bad = seg[seg.kmh > 60].merge(trips[["trip_id", "route_id"]], on="trip_id").merge(routes[["route_id", "route_short_name"]], on="route_id")
print(bad[["trip_id", "route_short_name", "stop_id", "dist", "dt", "kmh"]].head(8).round(1).to_string(index=False))
slow = seg[(seg.dt > 0) & (seg.kmh < 2) & (seg.dist > 200)]
print("segmenti < 2 km/h con >200 m:", len(slow))
# shape_dist_traveled vs linea d'aria
sd = st.shape_dist_traveled.astype(float)
sdd = sd - sd.groupby(st.trip_id).shift()
ratio = (sdd / st.dist).replace([float("inf")], float("nan"))
print("shape_dist / linea d'aria p50/p95:", ratio.quantile(.5).round(2), ratio.quantile(.95).round(2), "| shape_dist decrescente:", (sdd < 0).sum())

# 3. Fermate vs shape
sec("3. Distanza fermata-shape")
shp["seq"] = shp.shape_pt_sequence.astype(int)
lines = {}
for sh, grp in shp.sort_values(["shape_id", "seq"]).groupby("shape_id"):
    px, py = T.transform(grp.shape_pt_lon.astype(float).values, grp.shape_pt_lat.astype(float).values)
    lines[sh] = LineString(list(zip(px, py)))
pat = st.merge(trips[["trip_id", "shape_id", "route_id"]], on="trip_id").drop_duplicates(["shape_id", "stop_id"])
pat["off"] = [lines[r.shape_id].distance(Point(r.x, r.y)) if r.shape_id in lines else float("nan") for r in pat.itertuples()]
print("coppie (shape, fermata):", len(pat), "| off p50/p95/max m:", pat.off.quantile(.5).round(1), pat.off.quantile(.95).round(1), pat.off.max().round(1))
for lim in (30, 50, 100):
    print(f"fermate a > {lim} m dalla loro shape:", (pat.off > lim).sum())
far = pat[pat.off > 50].merge(routes[["route_id", "route_short_name"]], on="route_id").merge(stops[["stop_id", "stop_name"]], on="stop_id")
print(far.sort_values("off", ascending=False)[["route_short_name", "shape_id", "stop_id", "stop_name", "off"]].head(10).round(0).to_string(index=False))

# 4. Calendario
sec("4. Calendario")
d0, d1 = dt.date(2026, 6, 15), dt.date(2027, 6, 13)
cols = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
def active(day):
    s = day.strftime("%Y%m%d"); out = set()
    for r in cal.itertuples():
        if r.start_date <= s <= r.end_date and getattr(r, cols[day.weekday()]) == "1": out.add(r.service_id)
    for r in cd[cd.date == s].itertuples():
        (out.add if r.exception_type == "1" else out.discard)(r.service_id)
    return out
has = set(trips.service_id)
nos, fer5_fest = [], []
day = d0
while day <= d1:
    a = active(day); n = len(a & has)
    if n == 0: nos.append(day.isoformat())
    s = day.strftime("%Y%m%d")
    if s in set(cd.date) and "FER5_INV_2627" in a and "DOM_INV_2627" in a: fer5_fest.append((day.isoformat(), day.strftime("%a")))
    day += dt.timedelta(1)
print("giorni senza alcun servizio in", d0, "→", d1, ":", nos or "nessuno")
print("giorni con FER5 e DOM attivi insieme (festivo con servizio feriale):", fer5_fest)
trips_per = trips.groupby("service_id").size().to_dict()
print("corse per service_id:", trips_per)
print("service con 0 corse:", [s for s in svc if s not in has])
# festività nazionali italiane nel periodo senza eccezione
easter27 = dt.date(2027, 3, 28)
hol = {dt.date(2026, 8, 15): "Ferragosto", dt.date(2026, 11, 1): "Ognissanti", dt.date(2026, 12, 8): "Immacolata",
       dt.date(2026, 12, 25): "Natale", dt.date(2026, 12, 26): "S.Stefano", dt.date(2027, 1, 1): "Capodanno",
       dt.date(2027, 1, 6): "Epifania", dt.date(2027, 3, 29): "Lunedì dell'Angelo", dt.date(2027, 4, 25): "Liberazione",
       dt.date(2027, 5, 1): "Lavoro", dt.date(2027, 6, 2): "Repubblica", dt.date(2026, 6, 29): "SS Pietro e Paolo (non nazionale)"}
exc = set(cd.date)
for dd, n in sorted(hol.items()):
    s = dd.strftime("%Y%m%d"); a = active(dd) & has
    if d0 <= dd <= d1:
        print(f"{dd} {dd.strftime('%a')} {n:28s} eccezione:{'sì' if s in exc else 'NO':3s} servizi attivi: {sorted(a)}")

# 5. Fermate duplicate / varianti
sec("5. Fermate")
stops["lat"] = stops.stop_lat.astype(float); stops["lon"] = stops.stop_lon.astype(float)
print("stop_code duplicati:", stops.stop_code[stops.stop_code.duplicated(keep=False) & (stops.stop_code != "")].nunique())
print("coordinate duplicate (stessa posizione, id diversi):", stops.duplicated(["stop_lat", "stop_lon"], keep=False).sum())
print("fermate con nome vuoto:", (stops.stop_name.str.strip() == "").sum(), "| con doppi spazi:", stops.stop_name.str.contains("  ").sum())
print("fuori dal riquadro Marsala (lat 37.6-37.9, lon 12.3-12.7):", (~stops.lat.between(37.6, 37.9) | ~stops.lon.between(12.3, 12.7)).sum())
# corse identiche
sig = st.groupby("trip_id").apply(lambda d: tuple(zip(d.stop_id, d.dep)), include_groups=False)
tt = trips.set_index("trip_id").join(sig.rename("sig"))
dup = tt[tt.duplicated(["service_id", "sig"], keep=False)]
print("corse duplicate (stesso servizio, stesse fermate e orari):", len(dup), dup.index.tolist()[:6])
# capolinea vs headsign
last = st.groupby("trip_id").tail(1).set_index("trip_id").stop_id.map(sid.stop_name)
tt["last"] = last
mism = tt[tt.trip_headsign.str.lower().str.strip() != tt["last"].str.lower().str.strip()]
print("corse con headsign diverso dal nome dell'ultima fermata:", len(mism), "su", len(tt))
print(mism[["trip_headsign", "last"]].drop_duplicates().head(6).to_string())
