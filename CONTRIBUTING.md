# Como contribuir

Contribuições são bem-vindas, em português ou em inglês (*contributions in English are welcome too*).

## Relatar um problema ou sugerir melhoria

- **Bugs e sugestões:** abra uma [issue](https://github.com/Jaimedsf/sombra-guide/issues). Diga o que você esperava, o que aconteceu, o link do mapa (a URL já guarda a câmera, a data e a hora) e o navegador usado.
- **Prédio faltando ou com altura errada:** o melhor é corrigir direto no [OpenStreetMap](https://www.openstreetmap.org), e a correção aparece aqui em uma ou duas semanas. Para um prédio novo que ainda não está no OSM, dá para propor uma entrada em `src/extra-buildings.json`.
- **Vulnerabilidades:** não abra issue pública. Siga o [SECURITY.md](SECURITY.md).

Issues e PRs recebem uma primeira resposta em até 14 dias.

## Enviar código

1. Faça um fork e crie uma branch a partir da `main`.
2. Instale e rode localmente:
   ```sh
   npm install
   npm run dev
   ```
3. Antes do PR, rode os testes e o build:
   ```sh
   npm test
   npm run build
   ```
4. Abra o PR contra a `main` descrevendo o que muda e por quê.

O CI roda `npm audit`, os testes, o build e o CodeQL em todo PR. O merge só acontece com tudo verde e depois de uma revisão.

## Versões e releases

As releases são automáticas. Toda mudança que o usuário percebe entra no [CHANGELOG.md](CHANGELOG.md), em `## [Não lançado]`. Para lançar:

1. Troque `## [Não lançado]` por `## [X.Y.Z] - AAAA-MM-DD`. Use patch (`1.1.1`) quando houver só correções e minor (`1.2.0`) quando houver novidades.
2. Ponha a mesma versão no `package.json` e nas duas primeiras ocorrências de `"version"` do `package-lock.json`.
3. Faça o push na `main`. O workflow `release.yml` cria a tag `vX.Y.Z` e a release, usando essa seção do CHANGELOG como notas, e anexa o site assinado com Sigstore.

Se a versão do `package.json` já tiver tag, o workflow não faz nada. Se a seção do CHANGELOG faltar, ele falha antes de publicar.

## Política de testes

- **Toda funcionalidade nova, ou mudança de comportamento, precisa vir com testes automatizados** em `test/` (ou em `check.mjs`), e esses testes precisam passar no `npm test`.
- Para cálculos (horário, posição do sol, geometria), prefira testes de propriedade com [fast-check](https://fast-check.dev), que verificam uma regra em milhares de entradas sorteadas.
- Correções de bug devem vir com um teste que falha sem a correção.
- Mudanças só visuais (CSS, texto) podem vir sem teste automatizado, mas o PR deve mostrar uma captura de tela.

## Estilo de código

- JavaScript em módulos ES, que sempre rodam em modo estrito. Nomes, comentários e mensagens de commit em inglês; textos da interface em português.
- O CodeQL, com as regras de qualidade ligadas, roda em todo PR. Achados novos precisam ser corrigidos antes do merge.
- Nada de segredos ou chaves no repositório. A varredura de segredos do GitHub bloqueia o push se isso acontecer.
