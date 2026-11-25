"""Regenerate web/data.js from Instagram_Analytics_cleaned.csv.

Run from the project root:
    python web/build_data.py
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Instagram_Analytics_cleaned.csv")
OUT = os.path.join(ROOT, "web", "data.js")

rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
months = sorted({r["post_date"][:7] for r in rows})
media = ["reel", "image", "carousel"]
category = sorted({r["content_category"] for r in rows})
traffic = sorted({r["traffic_source"] for r in rows})
account = ["brand", "creator"]
dow = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
bucket = ["low", "medium", "high", "viral"]

mi = {v: i for i, v in enumerate(months)}
mdi = {v: i for i, v in enumerate(media)}
ci = {v: i for i, v in enumerate(category)}
ti = {v: i for i, v in enumerate(traffic)}
ai = {v: i for i, v in enumerate(account)}
di = {v: i for i, v in enumerate(dow)}
bi = {v: i for i, v in enumerate(bucket)}

data = []
for r in rows:
    data.append([
        mi[r["post_date"][:7]], mdi[r["media_type"]], ci[r["content_category"]],
        ti[r["traffic_source"]], ai[r["account_type"]], 1 if r["has_call_to_action"] == "True" else 0,
        int(r["post_hour"]), di[r["day_of_week"]], int(r["likes"]), int(r["comments"]),
        int(r["shares"]), int(r["saves"]), int(r["reach"]), int(r["impressions"]),
        round(float(r["engagement_rate"]), 6), int(r["followers_gained"]),
        int(r["caption_length"]), int(r["hashtags_count"]), bi[r["performance_bucket_label"]],
        r["post_date"],
    ])

payload = {
    "months": months, "media": media, "category": category, "traffic": traffic,
    "account": account, "dow": dow, "bucket": bucket, "rows": data,
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.IG=")
    json.dump(payload, f, separators=(",", ":"))
    f.write(";")
print("wrote", OUT, round(os.path.getsize(OUT) / 1024 / 1024, 2), "MB", len(data), "rows")
