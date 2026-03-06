import net from "net";

const user = "postgres.swsveygecsdalkkcufbx";
const db   = "postgres";
const regions = [
  "ap-south-1","ap-southeast-1","ap-southeast-2","ap-northeast-1",
  "us-east-1","us-west-1","eu-west-1","eu-central-1","ca-central-1","sa-east-1"
];

function probe(region) {
  return new Promise((resolve) => {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const c = net.createConnection(6543, host, () => {
      const params = `user\x00${user}\x00database\x00${db}\x00\x00`;
      const len = 4 + 4 + Buffer.byteLength(params);
      const buf = Buffer.alloc(len);
      buf.writeInt32BE(len, 0);
      buf.writeInt32BE(196608, 4); // protocol 3.0
      buf.write(params, 8, "utf8");
      c.write(buf);
    });
    let data = Buffer.alloc(0);
    c.on("data", (d) => { data = Buffer.concat([data, d]); c.destroy(); });
    c.on("close", () => {
      const str = data.toString("utf8");
      if (str.includes("Tenant or user not found")) {
        resolve({ region, status: "WRONG_REGION" });
      } else if (str.includes("FATAL") || str.includes("password") || str.includes("auth")) {
        resolve({ region, status: "FOUND - needs auth", raw: str.slice(0,120) });
      } else if (data.length > 0) {
        resolve({ region, status: "RESPONDED", raw: data.toString("hex").slice(0,80) });
      } else {
        resolve({ region, status: "NO_DATA" });
      }
    });
    c.on("error", (e) => resolve({ region, status: "ERR: " + e.message }));
    setTimeout(() => { c.destroy(); resolve({ region, status: "TIMEOUT" }); }, 4000);
  });
}

const results = await Promise.all(regions.map(probe));
for (const r of results) {
  const icon = r.status.startsWith("FOUND") ? "✅" : r.status === "WRONG_REGION" ? "❌" : "⚠️";
  console.log(`${icon}  ${r.region.padEnd(18)} ${r.status}`);
  if (r.raw) console.log(`     └─ ${r.raw.replace(/\n/g," ")}`);
}
