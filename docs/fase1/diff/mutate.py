# Crea una variante SINTETICA del feed con orari oltre 24:00 e un servizio presente solo in calendar_dates.
import sys, shutil, os, pandas as pd
src, dst = sys.argv[1], sys.argv[2]
shutil.rmtree(dst, ignore_errors=True); shutil.copytree(src, dst)
st = pd.read_csv(f"{dst}/stop_times.txt", dtype=str, keep_default_na=False)
def s(x): h,m,z=map(int,x.split(':')); return h*3600+m*60+z
def f(v): return f"{v//3600:02d}:{v%3600//60:02d}:{v%60:02d}"
first = st.groupby('trip_id').departure_time.first().map(s)
shift = set(first[first >= 17*3600].index)          # corse serali spostate di +6h => superano la mezzanotte
for col in ('arrival_time','departure_time'):
    m = st.trip_id.isin(shift); st.loc[m,col] = st.loc[m,col].map(lambda x: f(s(x)+6*3600))
# una corsa con partenza esattamente alle 24:00:00 (caso limite del confronto >= 86400)
tid = sorted(shift)[0]; m = st.trip_id==tid
off = 86400 - s(st.loc[m,'departure_time'].iloc[0])
for col in ('arrival_time','departure_time'): st.loc[m,col] = st.loc[m,col].map(lambda x: f(s(x)+off))
st.to_csv(f"{dst}/stop_times.txt", index=False)
print("corse spostate +6h:", len(shift), "max", st.departure_time.max())
