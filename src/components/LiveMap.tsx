import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { VestWithData } from '../hooks/useVestData';
import type { Gateway } from '../lib/types';
import { STAGE_META } from '../lib/stage';
import { coord, ago } from '../lib/format';
import { useNavigate } from 'react-router-dom';

interface Props {
  vests: VestWithData[];
  gateway: Gateway | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  now: number;
}

function makeIcon(color: string, icon: string, isDanger: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:28px;height:28px;">
      ${isDanger ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.3;animation:danger-pulse 1s ease-in-out infinite;"></div>` : ''}
      <div style="position:absolute;inset:2px;border-radius:50%;background:${color};border:2px solid #0a1c2b;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:bold;">${icon}</div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const GW_ICON = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:3px;background:#1a3650;border:2px solid #f4f1ea;display:flex;align-items:center;justify-content:center;font-size:8px;color:#f4f1ea;font-weight:bold;">GW</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export default function LiveMap({ vests, gateway, selectedId, onSelect, now }: Props) {
  const navigate = useNavigate();

  const positions = vests
    .filter(v => v.state?.lat != null && v.state?.lon != null)
    .map(v => [v.state!.lat!, v.state!.lon!]);

  const center: [number, number] = gateway
    ? [gateway.lat ?? -6.1033, gateway.lon ?? 106.8817]
    : positions[0] ?? [-6.1033, 106.8817];

  return (
    <MapContainer
      center={center}
      zoom={15}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      <TileLayer
        url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        attribution='&copy; OpenSeaMap'
      />

      {/* Gateway marker */}
      {gateway && gateway.lat != null && gateway.lon != null && (
        <Marker position={[gateway.lat, gateway.lon]} icon={GW_ICON}>
          <Popup>
            <div>
              <div className="font-semibold">{gateway.name}</div>
              <div className="text-white/50">{gateway.status ?? '—'}</div>
              <div className="text-white/50">SD: {gateway.sd_ok ? 'OK' : 'Error'} · WiFi: {gateway.wifi_ok ? 'OK' : 'Off'}</div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Vest markers */}
      {vests.map(v => {
        const s = v.state;
        if (!s || s.lat == null || s.lon == null) return null;
        const stage = s.stage;
        const meta = STAGE_META[stage];
        const icon = makeIcon(meta.color, meta.icon, stage === 'danger');
        return (
          <Marker
            key={v.id}
            position={[s.lat, s.lon]}
            icon={icon}
            eventHandlers={{ click: () => { onSelect(v.id); } }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{v.name}</span>
                  <span style={{ color: meta.color }}>{meta.label}</span>
                </div>
                {v.assigned_to && <div className="text-white/60">{v.assigned_to}</div>}
                <div className="mt-1 font-mono text-[10px] text-white/50">{coord(s.lat, s.lon)}</div>
                <div className="text-white/50">{s.status_text}</div>
                <div className="text-white/50">terakhir {ago(s.last_seen_at, now)}</div>
                <button
                  className="mt-1.5 text-xs font-medium text-safe"
                  onClick={() => navigate(`/vest/${v.id}`)}
                >
                  Detail ›
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Position age circles (fading) */}
      {vests.map(v => {
        const s = v.state;
        if (!s || s.lat == null || s.lon == null || !s.pos_fix_at) return null;
        const ageS = Math.floor((now - new Date(s.pos_fix_at).getTime()) / 1000);
        if (ageS < 5) return null;
        const meta = STAGE_META[s.stage];
        const opacity = Math.max(0.05, 0.25 - ageS / 600);
        return (
          <CircleMarker
            key={`age-${v.id}`}
            center={[s.lat, s.lon]}
            radius={Math.min(50, 10 + ageS / 10)}
            pathOptions={{ color: meta.color, fillColor: meta.color, fillOpacity: opacity, weight: 0 }}
          />
        );
      })}
    </MapContainer>
  );
}
