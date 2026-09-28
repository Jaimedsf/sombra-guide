# Política de segurança

## Versões suportadas

Só a versão publicada em https://jaimedsf.github.io/sombra-guide/, que corresponde à branch `main`, recebe correções.

## Como relatar uma vulnerabilidade

Não abra uma issue pública. Use o relato privado do GitHub: **Security › Report a vulnerability**, em https://github.com/Jaimedsf/sombra-guide/security/advisories/new.

Inclua o que for possível:

- o que acontece e qual o impacto
- passos para reproduzir, ou um exemplo mínimo
- navegador e sistema operacional usados

O relato é respondido em até 7 dias. Se a falha for confirmada, a correção é publicada junto com um aviso de segurança que dá crédito a quem relatou, a menos que a pessoa prefira ficar anônima.

## Escopo

O site é estático, roda inteiro no navegador e não tem backend nem login. Os dados do mapa e da busca vêm de serviços externos (OpenFreeMap, Esri e Nominatim). Falhas nesses serviços devem ser relatadas diretamente a eles.
