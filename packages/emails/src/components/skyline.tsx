import { color } from '../theme/tokens.js';

/**
 * Skyline stylisée d'une ville portuaire chinoise, dessinée en cellules de tableau :
 * tours serrées, deux antennes, et des conteneurs empilés sur le quai.
 * Purement décorative (aria-hidden) : aucune image à charger, rien à bloquer,
 * et l'email reste complet si les couleurs sont aplaties.
 */
type Building = { height: number; width: number; tone: 'gold' | 'light' | 'dim'; antenna?: number };

const BUILDINGS: Building[] = [
  { height: 12, width: 16, tone: 'dim' },
  { height: 24, width: 11, tone: 'light' },
  { height: 17, width: 20, tone: 'dim' },
  { height: 44, width: 10, tone: 'gold', antenna: 9 },
  { height: 29, width: 14, tone: 'light' },
  { height: 21, width: 9, tone: 'dim' },
  { height: 52, width: 13, tone: 'gold', antenna: 12 },
  { height: 33, width: 11, tone: 'light' },
  { height: 19, width: 17, tone: 'dim' },
  { height: 38, width: 12, tone: 'gold' },
  { height: 26, width: 15, tone: 'light' },
  { height: 14, width: 10, tone: 'dim' },
  { height: 22, width: 18, tone: 'light' },
];

const TONES = {
  gold: 'rgba(212,165,55,0.50)',
  light: 'rgba(255,255,255,0.18)',
  dim: 'rgba(255,255,255,0.09)',
} as const;

const CONTAINERS = ['rgba(200,16,46,0.8)', 'rgba(212,165,55,0.65)', 'rgba(255,255,255,0.22)'];

export function Skyline({ height = 60 }: { height?: number }) {
  const scale = height / 60;

  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} aria-hidden="true" style={{ width: '100%' }}>
      <tbody>
        <tr>
          {BUILDINGS.map((building, index) => {
            const bodyHeight = Math.round(building.height * scale);
            const antennaHeight = building.antenna ? Math.round(building.antenna * scale) : 0;

            return (
              <td
                key={index}
                width={building.width}
                style={{ width: `${building.width}px`, height: `${height}px`, verticalAlign: 'bottom', paddingRight: '2px' }}
              >
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    {building.antenna && (
                      <tr>
                        <td align="center" style={{ height: `${antennaHeight}px` }}>
                          <table role="presentation" cellPadding={0} cellSpacing={0} align="center">
                            <tbody>
                              <tr>
                                <td
                                  width="2"
                                  height={antennaHeight}
                                  style={{
                                    width: '2px',
                                    height: `${antennaHeight}px`,
                                    fontSize: '1px',
                                    lineHeight: '1px',
                                    backgroundColor: color.goldBright,
                                  }}
                                >
                                  &nbsp;
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td
                        height={bodyHeight}
                        style={{
                          height: `${bodyHeight}px`,
                          fontSize: '1px',
                          lineHeight: '1px',
                          backgroundColor: TONES[building.tone],
                          borderTop: building.tone === 'gold' ? `1px solid ${color.goldBright}` : 'none',
                        }}
                      >
                        &nbsp;
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            );
          })}

          {/* Quai : conteneurs empilés au départ du port. */}
          <td style={{ verticalAlign: 'bottom', paddingLeft: '8px' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} align="right">
              <tbody>
                <tr>
                  <td
                    width="16"
                    height="8"
                    style={{ width: '16px', height: '8px', fontSize: '1px', lineHeight: '1px', backgroundColor: CONTAINERS[1] }}
                  >
                    &nbsp;
                  </td>
                  <td width="4" style={{ width: '4px', fontSize: '1px' }}>
                    &nbsp;
                  </td>
                </tr>
                <tr>
                  {CONTAINERS.map((fill, index) => (
                    <td
                      key={index}
                      width="16"
                      height="8"
                      style={{ width: '16px', height: '8px', fontSize: '1px', lineHeight: '1px', backgroundColor: fill, border: '1px solid rgba(12,12,16,0.5)' }}
                    >
                      &nbsp;
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </td>
        </tr>

        {/* Quai : la ligne dorée qui sépare la ville de la mer. */}
        <tr>
          <td
            colSpan={BUILDINGS.length + 1}
            height="2"
            style={{ height: '2px', fontSize: '1px', lineHeight: '1px', backgroundColor: 'rgba(212,165,55,0.4)' }}
          >
            &nbsp;
          </td>
        </tr>
      </tbody>
    </table>
  );
}
