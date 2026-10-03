# Changelog

Todas as mudanças relevantes do projeto. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

Cada versão tem uma tag `vX.Y.Z` no git e uma página em [Releases](https://github.com/Jaimedsf/sombra-guide/releases). Vulnerabilidades corrigidas, quando houver, aparecem numa seção **Segurança** da versão, com o identificador CVE ou GHSA.

## [1.1.1] - 2026-10-03

### Removido

- A dica de como mexer na câmera, ao lado dos botões, e a linha de créditos no fim do painel. Os créditos do mapa e da busca (Esri e Nominatim) ficam na atribuição do mapa, no canto inferior direito

## [1.1.0] - 2026-10-03

### Adicionado

- Sugestões de endereço enquanto você digita, sem precisar clicar em "Buscar". As setas e o Esc navegam pela lista, e um toque fora fecha
- A data e a hora escolhidas passam a ficar na URL (`?data=&hora=`), então um link copiado abre o mesmo momento. O botão "Agora" tira esses parâmetros
- Releases automáticas: um push na `main` que muda a versão do `package.json` cria a tag e a release, com as notas deste arquivo e o site assinado com Sigstore

### Alterado

- A lista de resultados da busca flutua sobre o painel em vez de empurrar o conteúdo para baixo

### Corrigido

- Em duas buscas seguidas, a resposta mais lenta podia substituir a lista da busca mais nova
- `?data=` com uma data que não existe (por exemplo, mês 13) mostrava "undefined" no painel, e `?hora=12:75` era aceito. Valores inválidos agora são ignorados
- Trocar entre "▶ Dia" e "▶ Ano" sem pausar deixava duas animações rodando ao mesmo tempo, e cada troca somava mais uma
- Durante "▶ Ano", a data escolhida no controle de dia, nos atalhos ou no campo de data voltava no quadro seguinte
- Em anos bissextos, o 31 de dezembro não aparecia no controle de dia do ano nem na animação do ano
- `npm test` no Windows não rodava os testes de propriedade e passava com 0 testes
- A checagem do sol de junho em `check.mjs` não conferia a altura quando o azimute ficava perto de 360°

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
