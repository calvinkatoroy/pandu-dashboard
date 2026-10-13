import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
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
  html: `<div style="width:22px;height:22px;border-radius:4px;background:#12293d;border:2px solid #f4f1ea;display:flex;align-items:center;justify-content:center;font-size:9px;color:#f4f1ea;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.5);">GW</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapController({
  vests,
  gateway,
  selectedId,
}: {
  vests: VestWithData[];
  gateway: Gateway | null;
  selectedId: number | null;
}) {
  const map = useMap();

  // Focus map when selected vest changes
  useEffect(() => {
    if (!selectedId) return;
    const v = vests.find(item => item.id === selectedId);
    if (v?.state?.lat != null && v?.state?.lon != null) {
      map.panTo([v.state.lat, v.state.lon], { animate: true });
    }
  }, [selectedId, vests, map]);

  function fitAll() {
    const latLngs: [number, number][] = [];
    if (gateway?.lat != null && gateway?.lon != null) {
      latLngs.push([gateway.lat, gateway.lon]);
    }
    vests.forEach(v => {
      if (v.state?.lat != null && v.state?.lon != null) {
        latLngs.push([v.state.lat, v.state.lon]);
      }
    });

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } else if (gateway?.lat != null && gateway?.lon != null) {
      map.setView([gateway.lat, gateway.lon], 15);
    }
  }

  return (
    <div className="leaflet-top leaflet-left !top-3 !left-3 z-[1000] pointer-events-auto">
      <button
        onClick={fitAll}
        title="Pusatkan peta ke seluruh titik Vest dan Gateway"
        className="rounded-lg border border-white/10 bg-ink-800/90 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/80 shadow-md backdrop-blur transition hover:bg-ink-700 hover:text-white"
      >
        ⤢ Fit Semua
      </button>
    </div>
  );
}

export default function LiveMap({ vests, gateway, selectedId, onSelect, now }: Props) {
  const navigate = useNavigate();

  const positions = vests
    .filter(v => v.state?.lat != null && v.state?.lon != null)
    .map(v => [v.state!.lat!, v.state!.lon!] as [number, number]);

  const center: [number, number] = gateway
    ? [gateway.lat ?? -6.1033, gateway.lon ?? 106.8817]
    : positions[0] ?? [-6.1033, 106.8817];

  // Identifikasi vest tanpa posisi (NOFIX) sesuai PLAN §6.1
  const noFixVests = vests.filter(
    v => v.active && v.state && (v.state.lat == null || v.state.lon == null) && v.state.stage !== 'inactive'
  );

  return (
    <div className="relative h-full w-full">
      {/* NOFIX indicator banner */}
      {noFixVests.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto flex items-center gap-2 rounded-full border border-caution/40 bg-ink-900/90 px-3 py-1 text-xs text-caution shadow-lg backdrop-blur">
          <span>⚠</span>
          <span>
            {noFixVests.map(v => v.name).join(', ')}: posisi belum tersedia (NOFIX)
          </span>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={15}
        className="h-full w-full"
        zoomControl={false}
      >
        <MapController vests={vests} gateway={gateway} selectedId={selectedId} />

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
              <div className="min-w-[140px]">
                <div className="font-semibold text-white">{gateway.name}</div>
                <div className="font-mono text-[10px] text-white/50">{coord(gateway.lat, gateway.lon)}</div>
                <div className="mt-1 text-xs text-white/60">Status: {gateway.status ?? 'online'}</div>
                <div className="text-[11px] text-white/40">
                  SD: {gateway.sd_ok ? 'OK' : 'Error'} · WiFi: {gateway.wifi_ok ? 'OK' : 'Off'}
                </div>
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
                    <span className="font-semibold text-white">{v.name}</span>
                    <span style={{ color: meta.color }} className="text-xs font-bold">{meta.label}</span>
                  </div>
                  {v.assigned_to && <div className="text-xs text-white/60">{v.assigned_to}</div>}
                  <div className="mt-1 font-mono text-[10px] text-white/50">{coord(s.lat, s.lon)}</div>
                  <div className="text-xs text-white/70">{s.status_text}</div>
                  <div className="text-[10px] text-white/40">terakhir {ago(s.last_seen_at, now)}</div>
                  <button
                    className="mt-2 text-xs font-semibold text-safe hover:underline"
                    onClick={() => navigate(`/vest/${v.id}`)}
                  >
                    Buka Detail Penuh ›
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
    </div>
  );
}
