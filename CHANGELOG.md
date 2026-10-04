# Changelog

Todas as mudanças relevantes do projeto. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

Cada versão tem uma tag `vX.Y.Z` no git e uma página em [Releases](https://github.com/Jaimedsf/sombra-guide/releases). Vulnerabilidades corrigidas, quando houver, aparecem numa seção **Segurança** da versão, com o identificador CVE ou GHSA.

## [Não lançado]

### Adicionado

- Aviso "Horários no fuso de Fortaleza (UTC−3)" quando o mapa está num lugar com outro fuso, como Manaus, Acre, Fernando de Noronha ou o exterior
- A busca avisa os leitores de tela quantos resultados apareceram
- Testes de ponta a ponta no Chrome (Playwright), que rodam no CI antes de cada deploy: momento pela URL, lugares polares, busca com sugestões e com o Nominatim, link copiado, mapa fora do ar, falta de WebGL 2, perda do contexto gráfico, painel recolhido e layout de celular

### Alterado

- As torres de `src/extra-buildings.json` deixam de ser desenhadas quando o OSM passa a ter um prédio no mesmo lugar, para não aparecerem duas vezes

### Corrigido

- Se o contexto gráfico era perdido com uma reconstrução dos prédios agendada, aparecia um erro no console. A camada já voltava, mas agora a reconstrução espera o contexto voltar
- O console não acusa mais os ícones que faltam no estilo do mapa (por exemplo, "office")

## [1.3.1] - 2026-10-03

### Corrigido

- Quando o navegador perdia o contexto gráfico (comum no celular ao trocar de app e voltar), o mapa voltava sem os prédios 3D e sem as sombras até recarregar a página. Agora a camada volta sozinha
- Em latitudes polares, no sol da meia-noite ou na noite polar, o painel travava: relógio, barra de hora e bússola paravam de responder. Agora ele mostra "sol o dia todo" ou "sem sol hoje" e a data do próximo nascer, mesmo que seja daqui a semanas
- Longe do fuso de Fortaleza (Japão, norte da Europa no verão), o dia passa da meia-noite no horário de Fortaleza e a barra de hora ficava com o começo depois do fim. Nesses lugares ela agora cobre o dia inteiro
- "Copiar link" no meio de uma animação do mapa copiava a câmera de antes do movimento
- Releases e deploys: uma versão podia ficar sem release quando três versões eram enviadas em sequência rápida, e um push podia interromper um deploy em andamento

### Removido

- O subtítulo do painel, que quebrava em duas linhas no computador desde a chegada do botão "Copiar link"

## [1.3.0] - 2026-10-03

### Adicionado

- No computador, o painel também recolhe com "Menos" e volta com "Mais", deixando mais mapa à vista. A escolha fica salva no aparelho
- Prévia do link (Open Graph) ao compartilhar em conversas e redes sociais, e cor da barra do navegador no celular

### Alterado

- As fontes vêm do próprio site, sem chamadas ao Google Fonts, que recebia o endereço IP de cada visitante
- O site publicado tem uma política de segurança de conteúdo (CSP): scripts, estilos e fontes só do próprio site, e conexões só com os tiles do mapa e os serviços de busca

## [1.2.1] - 2026-10-03

### Alterado

- Animações e giros do mapa mais leves. A bússola reaproveita o caminho do sol do dia em vez de recalculá-lo a cada quadro, e o escurecimento da noite virou uma camada sobre o mapa em vez de um filtro no canvas, que custava uma passada extra a cada quadro. A noite fica levemente azulada
- O código do app (25 KB) vem separado das bibliotecas do mapa e do 3D, então uma versão nova só faz o navegador baixar de novo a parte que mudou
- Testes de propriedade da malha dos prédios: paredes viradas para fora, telhado do tamanho exato da planta e pátios internos abertos

### Corrigido

- Contornos marcados com `hide_3d` no OpenStreetMap (prédios mapeados por partes) eram desenhados como um bloco a mais por cima das partes

## [1.2.0] - 2026-10-03

### Adicionado

- Botão "Copiar link" no topo do painel. No celular ele vira "Compartilhar" e abre o menu de compartilhar do sistema. O link abre a mesma câmera, data e hora
- Botão de localização no mapa, para ir até onde você está
- O marcador da busca mostra o endereço num balão, com um botão para remover o marcador

### Alterado

- Os botões do mapa (aproximar, afastar, bússola, localização) têm as dicas em português

## [1.1.2] - 2026-10-03

### Corrigido

- À noite, "Próximo nascer" mostrava o nascer do sol do mesmo dia, que já tinha passado, e com um minuto de diferença do cartão "Nascer". Agora mostra o de amanhã, com o mesmo arredondamento
- À noite, no modo "agora", a barra de hora parava no pôr do sol como se fosse fim de tarde. Agora ela fica apagada e avisa que é noite
- Leitores de tela liam as barras de hora e de dia como números ("1050", "283"). Agora leem a hora e a data, e o botão "2D" é anunciado como "2D, vista de cima"
- Sem WebGL 2 ou sem conexão, a tela ficava em branco. Agora aparece uma mensagem explicando o que houve, com "Tentar de novo" quando o problema é a conexão

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
