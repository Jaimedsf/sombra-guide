# Changelog

Todas as mudanças relevantes do projeto. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

Cada versão tem uma tag `vX.Y.Z` no git e uma página em [Releases](https://github.com/Jaimedsf/sombra-guide/releases). Vulnerabilidades corrigidas, quando houver, aparecem numa seção **Segurança** da versão, com o identificador CVE ou GHSA.

## [1.0.0] - 2026-09-28

Primeira versão pública.

### Adicionado

- Mapa 3D de Fortaleza com os prédios do OpenStreetMap e sombras reais no chão, nas fachadas e nos telhados, desenhados por uma camada three.js sobre o MapLibre GL
- Posição do sol calculada para qualquer data e hora (horário de Fortaleza, UTC−3), com bússola do céu, nascer e pôr do sol, meio-dia solar e altura máxima do sol
- Barra de hora limitada ao período entre o nascer e o pôr do sol do dia escolhido, controle de dia do ano, animação de um dia ou de um ano e atalhos para solstícios, equinócios e os dias de sol a pino
- Busca de endereço com número exato pela Esri, com o Nominatim de reserva e indicação de precisão em cada resultado
- `src/extra-buildings.json` para prédios que ainda não estão no OSM, começando pelas duas torres do Estilo Passaré
- Link compartilhável: câmera na URL (`#zoom/lat/lng/rumo/inclinação`) e momento fixo (`?data=&hora=`)
- Layout para celular: painel recolhível, controles de câmera compactos, alvos de toque de pelo menos 44 px e perfil 3D mais leve
- Testes de propriedade com fast-check (`npm test`), CodeQL com regras de segurança e qualidade, Dependabot, OpenSSF Scorecard e deploy automático no GitHub Pages
