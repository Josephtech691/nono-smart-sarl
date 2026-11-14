import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Yaounde, Cameroun - centre par defaut
export const YAOUNDE_CENTER = [3.848, 11.502];

const PIN_COLORS = {
  brand: '#279C5A',
  pine: '#0F3D2C',
  amber: '#D97706',
};

function pinIcon(color = 'brand') {
  const hex = PIN_COLORS[color] || PIN_COLORS.brand;
  return L.divIcon({
    className: 'brand-pin',
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${hex}"/>
      <circle cx="15" cy="15" r="6" fill="white"/>
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

// Recentre la carte sur `center` (zoom rapproché) à chaque changement de `focus` : appui sur « Ma position GPS ».
function Focus({ center, focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView(center, 17, { animate: true });
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [JSON.stringify(points)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * markers: [{ position: [lat, lng], label?: string, color?: 'brand'|'pine'|'amber' }]
 * onPick: si fourni, un clic sur la carte appelle onPick({ latitude, longitude })
 */
export default function MapView({ center = YAOUNDE_CENTER, zoom = 13, markers = [], onPick, height = 280, className = '', focus = 0, draggableMarker = false }) {
  const points = useMemo(() => markers.map((m) => m.position), [markers]);

  return (
    <div className={`overflow-hidden rounded-xl2 border border-line ${className}`} style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onPick && <ClickHandler onPick={onPick} />}
        {points.length > 1 && <FitBounds points={points} />}
        {focus > 0 && <Focus center={center} focus={focus} />}
        {markers.map((m, i) => (
          <Marker
            key={i}
            position={m.position}
            icon={pinIcon(m.color)}
            draggable={Boolean(draggableMarker && onPick)}
            eventHandlers={draggableMarker && onPick ? { dragend: (e) => { const ll = e.target.getLatLng(); onPick({ latitude: ll.lat, longitude: ll.lng }); } } : undefined}
          >
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
